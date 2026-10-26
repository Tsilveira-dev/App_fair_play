-- Migração incremental: não executar a baseline 001 sobre o banco existente.
-- Execute em janela de manutenção, após comparar metadados. Nenhum registro de
-- pesquisa é atualizado. Falhas revertem a transação inteira.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog,public;
select pg_advisory_xact_lock(761220262);

do $$
declare contrato record; coluna text;
begin
  for contrato in select * from (values
    ('gestores',array['usuario_auth_id']),
    ('participantes',array['id','nome','nome_chave','ativo','criado_em']),
    ('configuracao_teste',array['id','data_inicio','ativo']),
    ('sessoes_participantes',array['id','participante_id','usuario_auth_id','status',
      'tipo_dispositivo','solicitado_em','autorizado_em','autorizado_por','expira_em','revogado_em']),
    ('checkins',array['id','participante_id','dia_numero','data_referencia','respostas',
      'pontuacao','nivel','enviado_atrasado','primeiro_envio_em']),
    ('desafios_registros',array['id','participante_id','dia_numero','codigo_desafio',
      'nivel_atribuido','status','oferecido_em','aceito_em','concluido_em']),
    ('solicitacoes_tentativas',array['id','usuario_auth_id','criado_em'])
  ) as contratos(tabela,colunas) loop
    foreach coluna in array contrato.colunas loop
      if not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name=contrato.tabela and column_name=coluna) then
        raise exception 'Contrato incompatível: public.%.%; transação cancelada',contrato.tabela,coluna;
      end if;
    end loop;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema='auth'
    and table_name='users' and column_name='is_anonymous' and data_type='boolean') then
    raise exception 'Contrato incompatível: auth.users.is_anonymous';
  end if;
end $$;

create table if not exists public.fairplay_schema_migrations (
  versao text primary key,
  aplicado_em timestamptz not null default now()
);
-- Somente metadados para reversão seletiva; sem registros ou credenciais da pesquisa.
create table if not exists public.fairplay_migration_002_backup (
  id integer primary key check (id=1),
  estado text not null check (estado in ('preparada','aplicada','revertida')),
  metadados jsonb not null
);
alter table public.fairplay_migration_002_backup enable row level security;
alter table public.fairplay_schema_migrations enable row level security;
revoke all on public.fairplay_migration_002_backup, public.fairplay_schema_migrations
  from public, anon, authenticated, service_role;

create or replace function pg_temp.fairplay_acl_snapshot()
returns jsonb language sql as $snapshot$
select jsonb_agg(jsonb_build_object('tabela',c.relname,'rls',c.relrowsecurity,
  'grants',coalesce((select jsonb_agg(jsonb_build_object('role',case when a.grantee=0 then 'public'
      else pg_get_userbyid(a.grantee) end,'privilegio',a.privilege_type,'grantable',a.is_grantable)
      order by a.grantee,a.privilege_type)
    from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    where a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),'[]'::jsonb),
  'column_grants',coalesce((select jsonb_agg(jsonb_build_object('coluna',at.attname,
      'role',case when a.grantee=0 then 'public' else pg_get_userbyid(a.grantee) end,
      'privilegio',a.privilege_type,'grantable',a.is_grantable)
      order by at.attnum,a.grantee,a.privilege_type)
    from pg_attribute at cross join lateral aclexplode(at.attacl) a
    where at.attrelid=c.oid and at.attnum>0 and not at.attisdropped
      and a.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),'[]'::jsonb))
  order by c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('gestores','participantes','configuracao_teste',
  'sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas')
$snapshot$;

do $$
begin
  if not exists (select 1 from public.fairplay_migration_002_backup where id=1 and estado='aplicada') then
    if to_regprocedure('public.registrar_tentativa_acesso(uuid)') is not null
      or to_regprocedure('public.fairplay_validar_registro()') is not null
      or to_regprocedure('public.fairplay_validar_aprovacao()') is not null
      or to_regclass('public.fairplay_pontuacao') is not null
      or exists (select 1 from pg_trigger where tgrelid in
        ('public.checkins'::regclass,'public.desafios_registros'::regclass,'public.sessoes_participantes'::regclass)
        and tgname in ('fairplay_checkin_protegido','fairplay_desafio_protegido','fairplay_aprovacao_protegida')) then
      raise exception 'Objetos 002 preexistentes sem backup compatível; revisar antes de aplicar';
    end if;
    insert into public.fairplay_migration_002_backup values
      (1,'preparada',jsonb_build_object('antes',pg_temp.fairplay_acl_snapshot(),'indices_criados','[]'::jsonb))
      on conflict(id) do update set estado=excluded.estado,metadados=excluded.metadados;
  else
    if pg_temp.fairplay_acl_snapshot() is distinct from
      (select metadados->'depois' from public.fairplay_migration_002_backup where id=1) then
      raise exception 'Permissões alteradas após 002; não sobrescrever alterações de terceiros';
    end if;
    if (select jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid)))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('registrar_tentativa_acesso','fairplay_validar_registro','fairplay_validar_aprovacao'))
      is distinct from (select metadados->'funcoes' from public.fairplay_migration_002_backup where id=1) then
      raise exception 'Funções alteradas após 002; revisão necessária';
    end if;
    if (select jsonb_object_agg(t.tgname,md5(pg_get_triggerdef(t.oid))) from pg_trigger t
      where t.tgrelid in ('public.checkins'::regclass,'public.desafios_registros'::regclass,'public.sessoes_participantes'::regclass)
        and t.tgname in ('fairplay_checkin_protegido','fairplay_desafio_protegido','fairplay_aprovacao_protegida'))
      is distinct from (select metadados->'triggers' from public.fairplay_migration_002_backup where id=1) then
      raise exception 'Triggers alterados após 002; revisão necessária';
    end if;
    if to_regclass('public.fairplay_pontuacao') is null or
      to_jsonb(md5(pg_get_viewdef('public.fairplay_pontuacao'::regclass,true))) is distinct from
      (select metadados->'view' from public.fairplay_migration_002_backup where id=1) then
      raise exception 'Visão alterada após 002; revisão necessária';
    end if;
  end if;
end $$;

-- Reutiliza UNIQUEs equivalentes, independentemente do nome e ordem das colunas.
-- Preserva o índice existente que cobre pendente+aprovada, sem torná-lo mais fraco.
create or replace function pg_temp.fairplay_unique(tabela text, colunas text[], nome text, parcial boolean default false)
returns void language plpgsql as $$
declare indice record; predicado text; lista text;
begin
  for indice in select i.*,pg_get_expr(i.indpred,i.indrelid) as predicado
    from pg_index i where i.indrelid=format('public.%I',tabela)::regclass
      and i.indisunique and i.indisvalid and i.indisready
      and i.indnkeyatts=cardinality(colunas)
      and array(select a.attname::text from unnest(i.indkey) with ordinality k(num,ord)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.num
        where k.ord<=i.indnkeyatts order by a.attname)
        = array(select unnest(colunas) order by 1)
  loop
    if indice.indpred is null then return; end if;
    predicado:=regexp_replace(replace(indice.predicado,'::text',''),'[[:space:]()]','','g');
    if parcial and predicado in ('status=''aprovada''',
      'status=ANYARRAY[''aprovada'']',
      'status=ANYARRAY[''pendente'',''aprovada'']',
      'status=ANYARRAY[''aprovada'',''pendente'']') then return; end if;
  end loop;
  if to_regclass(format('public.%I',nome)) is not null then
    raise exception 'Índice % existente não satisfaz o contrato; revisão necessária',nome;
  end if;
  select string_agg(format('%I',coluna),',') into lista from unnest(colunas) coluna;
  execute format('create unique index %I on public.%I (%s)%s',nome,tabela,lista,
    case when parcial then ' where status = ''aprovada''' else '' end);
  update public.fairplay_migration_002_backup set metadados=jsonb_set(metadados,'{indices_criados}',
    (metadados->'indices_criados')||jsonb_build_array(nome)) where id=1;
end $$;
select pg_temp.fairplay_unique('checkins',array['participante_id','dia_numero'],'checkins_um_por_dia');
select pg_temp.fairplay_unique('desafios_registros',array['participante_id','dia_numero'],'desafios_um_por_dia');
select pg_temp.fairplay_unique('sessoes_participantes',array['participante_id'],'sessoes_uma_ativa_por_participante',true);
select pg_temp.fairplay_unique('sessoes_participantes',array['usuario_auth_id'],'sessoes_um_uid');
select pg_temp.fairplay_unique('participantes',array['nome_chave'],'participantes_nome_unico');

-- Privilégios mínimos para os caminhos usados pela API; tentativas somente via RPC.
do $$
declare tabela text; colunas text;
begin
  foreach tabela in array array['gestores','participantes','configuracao_teste',
    'sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas'] loop
    execute format('alter table public.%I enable row level security',tabela);
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',tabela);
    select string_agg(format('%I',attname),',') into colunas from pg_attribute
      where attrelid=format('public.%I',tabela)::regclass and attnum>0 and not attisdropped;
    execute format('revoke all (%s) on table public.%I from public,anon,authenticated,service_role',colunas,tabela);
  end loop;
end $$;
grant select on public.gestores,public.configuracao_teste to service_role;
grant select,insert,update on public.participantes,public.sessoes_participantes to service_role;
grant select,insert on public.checkins to service_role;
grant select,insert,update on public.desafios_registros to service_role;

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
  insert into public.solicitacoes_tentativas(id,usuario_auth_id,criado_em) values(gen_random_uuid(),p_usuario,agora);
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
       or old.status is distinct from 'aceito' or new.status is distinct from 'concluido' then
      raise exception 'Transição de desafio inválida';
    end if;
  end if;
  perform 1 from public.participantes where id = new.participante_id and ativo is true for share;
  if not found then raise exception 'Participante indisponível'; end if;
  perform 1 from public.sessoes_participantes where participante_id = new.participante_id
    and status = 'aprovada' and expira_em > now() for share;
  if not found then raise exception 'Sessão não autorizada'; end if;
  select data_inicio into inicio from public.configuracao_teste where id = 1 and ativo is true for share;
  if inicio is null then raise exception 'Período não configurado'; end if;
  dia := (now() at time zone 'America/Fortaleza')::date - inicio + 1;
  if tg_table_name = 'checkins' then
    if dia not between 1 and 8 or new.dia_numero is distinct from least(dia,7)
       or new.data_referencia is distinct from inicio + new.dia_numero - 1
       or new.enviado_atrasado is distinct from (dia = 8) then
      raise exception 'Dia de check-in inválido';
    end if;
  elsif dia not between 1 and 7 or new.dia_numero is distinct from dia then
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
    select data_inicio into inicio from public.configuracao_teste where id = 1 and ativo is true for share;
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
-- Detecta alterações posteriores antes da reversão seletiva.
update public.fairplay_migration_002_backup set estado='aplicada',
  metadados=metadados||jsonb_build_object('depois',pg_temp.fairplay_acl_snapshot(),
    'funcoes',(select jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid)))
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('registrar_tentativa_acesso','fairplay_validar_registro','fairplay_validar_aprovacao')),
    'triggers',(select jsonb_object_agg(t.tgname,md5(pg_get_triggerdef(t.oid))) from pg_trigger t
      where t.tgrelid in ('public.checkins'::regclass,'public.desafios_registros'::regclass,'public.sessoes_participantes'::regclass)
        and t.tgname in ('fairplay_checkin_protegido','fairplay_desafio_protegido','fairplay_aprovacao_protegida')),
    'view',md5(pg_get_viewdef('public.fairplay_pontuacao'::regclass,true)))
where id=1;
commit;
