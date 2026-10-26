-- Baseline SEM DADOS para um projeto Supabase vazio. Não executar no ORIGINAL sem aprovação.
-- Em bases existentes, compare o esquema antes; use 002 apenas após conferir os contratos.
begin;
create table if not exists public.fairplay_schema_migrations (
  versao text primary key,
  aplicado_em timestamptz not null default now()
);
do $$
begin
  if not exists (select 1 from public.fairplay_schema_migrations where versao = '001')
     and (to_regclass('public.participantes') is not null
       or to_regclass('public.gestores') is not null
       or to_regclass('public.configuracao_teste') is not null
       or to_regclass('public.sessoes_participantes') is not null
       or to_regclass('public.checkins') is not null
       or to_regclass('public.desafios_registros') is not null
       or to_regclass('public.solicitacoes_tentativas') is not null) then
    raise exception 'Base existente: interrompido para comparação do esquema; nenhum dado foi alterado.';
  end if;
end $$;

create table if not exists public.gestores (
  usuario_auth_id uuid primary key references auth.users(id),
  criado_em timestamptz not null default now()
);
create table if not exists public.participantes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 40 and nome !~ '\s'),
  nome_chave text not null unique check (char_length(nome_chave) >= 2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
-- Nome histórico mantido para preservar o contrato, inclusive no ORIGINAL.
create table if not exists public.configuracao_teste (
  id integer primary key check (id = 1),
  data_inicio date not null,
  ativo boolean not null default false
);
create table if not exists public.sessoes_participantes (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id),
  usuario_auth_id uuid not null unique references auth.users(id),
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada','revogada')),
  tipo_dispositivo text not null check (tipo_dispositivo in ('individual','compartilhado')),
  solicitado_em timestamptz not null default now(),
  autorizado_em timestamptz,
  autorizado_por uuid references public.gestores(usuario_auth_id),
  expira_em timestamptz,
  revogado_em timestamptz,
  check (status <> 'aprovada' or (autorizado_em is not null and autorizado_por is not null and expira_em > autorizado_em))
);
create unique index if not exists sessoes_uma_ativa_por_participante
  on public.sessoes_participantes(participante_id) where status = 'aprovada';
create table if not exists public.solicitacoes_tentativas (
  id uuid primary key default gen_random_uuid(),
  usuario_auth_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);
create index if not exists tentativas_usuario_data on public.solicitacoes_tentativas(usuario_auth_id, criado_em desc);
create index if not exists tentativas_data on public.solicitacoes_tentativas(criado_em desc);
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id),
  dia_numero integer not null check (dia_numero between 1 and 7),
  data_referencia date not null,
  respostas jsonb not null check (jsonb_typeof(respostas) = 'array' and jsonb_array_length(respostas) = 5),
  pontuacao integer check (pontuacao between 0 and 10),
  nivel text check (nivel in ('baixo','moderado','alto')),
  enviado_atrasado boolean not null default false,
  primeiro_envio_em timestamptz not null default now(),
  unique (participante_id, dia_numero),
  check ((pontuacao is null and nivel is null) or
    (pontuacao is not null and nivel is not null and nivel = case
      when pontuacao <= 3 then 'baixo' when pontuacao <= 7 then 'moderado' else 'alto' end))
);
create table if not exists public.desafios_registros (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references public.participantes(id),
  dia_numero integer not null check (dia_numero between 1 and 7),
  codigo_desafio text not null,
  nivel_atribuido text check (nivel_atribuido in ('baixo','moderado','alto')),
  status text not null check (status in ('oferecido','aceito','concluido')),
  oferecido_em timestamptz not null default now(),
  aceito_em timestamptz,
  concluido_em timestamptz,
  unique (participante_id, dia_numero),
  check (status = 'oferecido' or aceito_em is not null),
  check ((status = 'concluido' and concluido_em is not null) or
    (status <> 'concluido' and concluido_em is null))
);
-- Proteção já na baseline, antes de qualquer configuração ou dado real.
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
insert into public.fairplay_schema_migrations(versao) values ('001') on conflict do nothing;
commit;
