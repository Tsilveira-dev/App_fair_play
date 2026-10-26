-- PLANO ORIGINAL: executar SOMENTE após aprovação, em swbwbkslcotoecjlbqxe.
-- Confirmar o projeto no painel administrativo: SQL não identifica a URL da conexão.
-- Não executar no TESTE. Não executar 001 em bases existentes.
-- Cria apenas o pré-requisito ausente da 002, sem seeds ou alteração de registros.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog,public;
select pg_advisory_xact_lock(761220262);

do $$
declare tabela text;
begin
  if to_regprocedure('public.registrar_tentativa_acesso(uuid)') is not null
    or to_regclass('public.fairplay_pontuacao') is not null then
    raise exception 'Proteções já presentes; não executar pré-requisito ou reaplicar 002';
  end if;
  foreach tabela in array array['gestores','participantes','configuracao_teste',
    'sessoes_participantes','checkins','desafios_registros'] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=tabela and c.relkind='r' and c.relrowsecurity) then
      raise exception 'Tabela ou RLS incompatível: public.%; revisar metadados',tabela;
    end if;
  end loop;
  if not exists(select 1 from pg_index i
    where i.indrelid='public.sessoes_participantes'::regclass
      and i.indisunique and i.indisvalid and i.indisready and i.indnkeyatts=1
      and i.indkey[0]=(select attnum from pg_attribute
        where attrelid=i.indrelid and attname='participante_id')
      and regexp_replace(replace(pg_get_expr(i.indpred,i.indrelid),'::text',''),
        '[[:space:]()]','','g') in (
          'status=ANYARRAY[''pendente'',''aprovada'']',
          'status=ANYARRAY[''aprovada'',''pendente'']')) then
    raise exception 'Índice pendente/aprovada não reconhecido; preservar e revisar antes de continuar';
  end if;
end $$;

create table if not exists public.solicitacoes_tentativas (
  id uuid primary key default gen_random_uuid(),
  usuario_auth_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);
-- IF NOT EXISTS não prova compatibilidade: recusar tabela preexistente divergente.
do $$
declare contrato record;
begin
  for contrato in select * from (values
    ('id','uuid'),('usuario_auth_id','uuid'),('criado_em','timestamptz')
  ) as colunas(nome,tipo) loop
    if not exists(select 1 from pg_attribute where attrelid='public.solicitacoes_tentativas'::regclass
      and attname=contrato.nome and atttypid=to_regtype(contrato.tipo) and attnotnull
      and attnum>0 and not attisdropped) then
      raise exception 'Tentativas incompatível: coluna %; transação cancelada',contrato.nome;
    end if;
  end loop;
  if not exists(select 1 from pg_constraint k where k.conrelid='public.solicitacoes_tentativas'::regclass
    and k.contype='p' and k.conkey=array[(select attnum from pg_attribute
      where attrelid=k.conrelid and attname='id')])
    or not exists(select 1 from pg_constraint k where k.conrelid='public.solicitacoes_tentativas'::regclass
      and k.contype='f' and k.convalidated and k.confrelid='auth.users'::regclass
      and k.conkey=array[(select attnum from pg_attribute where attrelid=k.conrelid and attname='usuario_auth_id')]
      and k.confkey=array[(select attnum from pg_attribute where attrelid=k.confrelid and attname='id')]
      and k.confdeltype='a') then
    raise exception 'Tentativas incompatível: PK/FK esperada ausente; transação cancelada';
  end if;
end $$;

create index if not exists tentativas_usuario_data on public.solicitacoes_tentativas(usuario_auth_id,criado_em desc);
create index if not exists tentativas_data on public.solicitacoes_tentativas(criado_em desc);
do $$
declare contrato record;
begin
  for contrato in select * from (values
    ('tentativas_usuario_data','usuario_auth_id, criado_em DESC'),
    ('tentativas_data','criado_em DESC')
  ) as indices(nome,colunas) loop
    if not exists(select 1 from pg_index i where i.indexrelid=to_regclass('public.'||contrato.nome)
      and i.indrelid='public.solicitacoes_tentativas'::regclass and i.indisvalid and i.indisready
      and not i.indisunique and i.indpred is null
      and pg_get_indexdef(i.indexrelid) like '% USING btree ('||contrato.colunas||')') then
      raise exception 'Índice de tentativas incompatível: %; transação cancelada',contrato.nome;
    end if;
  end loop;
end $$;
alter table public.solicitacoes_tentativas enable row level security;
revoke all on table public.solicitacoes_tentativas from public,anon,authenticated,service_role;
do $$
declare colunas text;
begin
  select string_agg(format('%I',attname),',') into colunas from pg_attribute
    where attrelid='public.solicitacoes_tentativas'::regclass and attnum>0 and not attisdropped;
  execute format('revoke all (%s) on public.solicitacoes_tentativas from public,anon,authenticated,service_role',colunas);
end $$;
-- Nenhum GRANT direto: a 002 instalará a RPC exclusiva da service_role.
-- Se a 002 falhar depois, esta tabela pode permanecer vazia, com RLS e sem grants.
commit;
