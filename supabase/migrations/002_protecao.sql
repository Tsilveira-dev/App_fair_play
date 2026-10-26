-- Revisar e testar antes de executar em um banco existente. Não copia ou apaga registros.
-- Faltas de colunas, duplicidades ou dados incompatíveis interrompem a transação.
begin;
create table if not exists public.fairplay_schema_migrations (
  versao text primary key,
  aplicado_em timestamptz not null default now()
);
create unique index if not exists checkins_um_por_dia on public.checkins(participante_id, dia_numero);
create unique index if not exists desafios_um_por_dia on public.desafios_registros(participante_id, dia_numero);
create unique index if not exists sessoes_uma_ativa_por_participante on public.sessoes_participantes(participante_id) where status = 'aprovada';
create unique index if not exists sessoes_um_uid on public.sessoes_participantes(usuario_auth_id);
create unique index if not exists participantes_nome_unico on public.participantes(nome_chave);

-- Nenhuma tabela da pesquisa é acessível diretamente ao navegador, nem aos gestores
-- via chave pública. Toda operação passa pelas funções autenticadas do servidor.
do $$
declare tabela text;
begin
  foreach tabela in array array['gestores','participantes','configuracao_teste',
    'sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas',
    'fairplay_schema_migrations'] loop
    execute format('alter table public.%I enable row level security', tabela);
    execute format('revoke all on table public.%I from public, anon, authenticated', tabela);
    execute format('grant select, insert, update on table public.%I to service_role', tabela);
  end loop;
end $$;

-- Serializa o contador global e por UID; não depende de memória de uma instância Vercel.
create or replace function public.registrar_tentativa_acesso(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  agora timestamptz := clock_timestamp();
  quantidade integer;
  ultima timestamptz;
  primeira timestamptz;
begin
  perform pg_advisory_xact_lock(761220261);
  agora := clock_timestamp();
  if not exists (select 1 from auth.users where id = p_usuario and is_anonymous is true) then
    raise exception 'Identidade não autorizada';
  end if;
  select count(*), max(criado_em), min(criado_em) into quantidade, ultima, primeira
    from public.solicitacoes_tentativas
    where usuario_auth_id = p_usuario and criado_em >= agora - interval '1 hour';
  if ultima > agora - interval '30 seconds' then
    return jsonb_build_object('bloqueado',true,'motivo','intervalo','espera',
      greatest(1,ceil(extract(epoch from ultima + interval '30 seconds' - agora))::integer));
  end if;
  if quantidade >= 10 then
    return jsonb_build_object('bloqueado',true,'motivo','limite','espera',
      greatest(1,ceil(extract(epoch from primeira + interval '1 hour' - agora))::integer));
  end if;
  if (select count(*) from public.solicitacoes_tentativas where criado_em >= agora - interval '1 hour') >= 300 then
    return jsonb_build_object('bloqueado',true,'motivo','limite','espera',3600);
  end if;
  insert into public.solicitacoes_tentativas(usuario_auth_id,criado_em) values(p_usuario,agora);
  return jsonb_build_object('bloqueado',false);
end $$;
revoke all on function public.registrar_tentativa_acesso(uuid) from public, anon, authenticated;
grant execute on function public.registrar_tentativa_acesso(uuid) to service_role;

-- Revalida a autorização na mesma transação que grava os dados diários.
create or replace function public.fairplay_validar_registro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  inicio date;
  dia integer;
begin
  if tg_op = 'DELETE' then raise exception 'Histórico preservado: exclusão não permitida'; end if;
  if tg_op = 'UPDATE' then
    if tg_table_name = 'checkins' then raise exception 'Check-in definitivo'; end if;
    if (new.participante_id,new.dia_numero,new.codigo_desafio,new.nivel_atribuido,new.aceito_em,new.oferecido_em)
       is distinct from
       (old.participante_id,old.dia_numero,old.codigo_desafio,old.nivel_atribuido,old.aceito_em,old.oferecido_em)
       or old.status <> 'aceito' or new.status <> 'concluido' then
      raise exception 'Transição de desafio inválida';
    end if;
  end if;
  perform 1 from public.participantes where id = new.participante_id and ativo is true for share;
  if not found then raise exception 'Participante indisponível'; end if;
  perform 1 from public.sessoes_participantes where participante_id = new.participante_id
    and status = 'aprovada' and expira_em > now() for share;
  if not found then raise exception 'Sessão não autorizada'; end if;
  select data_inicio into inicio from public.configuracao_teste where id = 1 and ativo is true;
  if inicio is null then raise exception 'Período não configurado'; end if;
  dia := (now() at time zone 'America/Fortaleza')::date - inicio + 1;
  if tg_table_name = 'checkins' then
    if dia not between 1 and 8 or new.dia_numero <> least(dia,7)
       or new.data_referencia <> inicio + new.dia_numero - 1
       or new.enviado_atrasado is distinct from (dia = 8) then
      raise exception 'Dia de check-in inválido';
    end if;
  elsif dia not between 1 and 7 or new.dia_numero <> dia then
    raise exception 'Dia de desafio inválido';
  end if;
  return new;
end $$;
create or replace trigger fairplay_checkin_protegido before insert or update or delete on public.checkins
  for each row execute function public.fairplay_validar_registro();
create or replace trigger fairplay_desafio_protegido before insert or update or delete on public.desafios_registros
  for each row execute function public.fairplay_validar_registro();

create or replace function public.fairplay_validar_aprovacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inicio date;
begin
  if new.status = 'aprovada' then
    if tg_op = 'INSERT' or old.status <> 'pendente' then
      raise exception 'Aprovação exige solicitação pendente';
    end if;
    perform 1 from public.participantes where id = new.participante_id and ativo is true for share;
    if not found then raise exception 'Participante inativo'; end if;
    if not exists (select 1 from public.gestores g join auth.users u on u.id = g.usuario_auth_id
      where g.usuario_auth_id = new.autorizado_por and u.is_anonymous is false
        and u.email is not null and u.raw_app_meta_data->>'provider' = 'email') then
      raise exception 'Gestor não autorizado';
    end if;
    select data_inicio into inicio from public.configuracao_teste where id = 1 and ativo is true;
    if inicio is null or now() >= ((inicio + 7)::text || 'T23:59:59-03:00')::timestamptz then
      raise exception 'Período indisponível';
    end if;
    new.expira_em := ((inicio + 7)::text || 'T23:59:59-03:00')::timestamptz;
    new.autorizado_em := now();
  end if;
  return new;
end $$;
create or replace trigger fairplay_aprovacao_protegida before insert or update on public.sessoes_participantes
  for each row execute function public.fairplay_validar_aprovacao();

-- Pontos derivados dos registros confirmados; nenhuma pontuação enviada pelo cliente.
create or replace view public.fairplay_pontuacao with (security_invoker = true) as
select p.id as participante_id,
  (select count(*) from public.checkins c where c.participante_id = p.id) * 10 +
  (select count(*) from public.desafios_registros d where d.participante_id = p.id and d.status = 'concluido') * 20 as pontos
from public.participantes p;
revoke all on public.fairplay_pontuacao from public, anon, authenticated;
grant select on public.fairplay_pontuacao to service_role;
revoke all on function public.fairplay_validar_registro() from public, anon, authenticated;
revoke all on function public.fairplay_validar_aprovacao() from public, anon, authenticated;
insert into public.fairplay_schema_migrations(versao) values ('002') on conflict do nothing;
commit;
