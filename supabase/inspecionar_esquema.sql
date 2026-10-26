-- SOMENTE LEITURA. Execute no SQL Editor do projeto de TESTE para comparar o esquema.
-- Não consulta registros, nomes, respostas, usuários ou valores de credenciais.
begin transaction read only;
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas')
order by table_name, ordinal_position;

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas')
order by tablename, indexname;

select c.relname as tabela, c.relrowsecurity as rls_ativo
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas');

select event_object_table as tabela, trigger_name, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public' and event_object_table in (
  'sessoes_participantes','checkins','desafios_registros');

select to_regprocedure('public.registrar_tentativa_acesso(uuid)') as rpc_de_tentativas;
commit;
