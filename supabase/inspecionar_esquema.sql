-- SOMENTE LEITURA. Comparação de metadados nos projetos TESTE/ORIGINAL autorizados.
-- Confirmar a referência no painel/API antes da consulta; não executar migrações no ORIGINAL.
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
select c.relname as tabela,k.conname as restricao,k.contype as tipo,
  pg_get_constraintdef(k.oid,true) as definicao
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas') order by c.relname,k.conname;

select table_name,grantee,privilege_type,is_grantable from information_schema.role_table_grants
where table_schema='public' and table_name in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas') order by table_name,grantee,privilege_type;

select table_name,column_name,grantee,privilege_type,is_grantable from information_schema.role_column_grants
where table_schema='public' and table_name in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas') order by table_name,column_name,grantee,privilege_type;

select tablename,policyname,roles,cmd,permissive,qual,with_check from pg_policies
where schemaname='public' and tablename in (
  'gestores','participantes','configuracao_teste','sessoes_participantes',
  'checkins','desafios_registros','solicitacoes_tentativas') order by tablename,policyname;

select p.proname as funcao,pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid) as retorno,pg_get_userbyid(p.proowner) as proprietario,
  p.prosecdef as security_definer,p.proconfig as configuracao,
  md5(pg_get_functiondef(p.oid)) as hash_definicao,
  has_function_privilege('anon',p.oid,'EXECUTE') as execute_anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as execute_authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.proname in ('registrar_tentativa_acesso','fairplay_validar_registro','fairplay_validar_aprovacao','rls_auto_enable')
order by p.proname,argumentos;

select c.relname as visao,pg_get_userbyid(c.relowner) as proprietario,c.reloptions as opcoes,
  md5(pg_get_viewdef(c.oid,true)) as hash_definicao from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' and c.relname='fairplay_pontuacao';

commit;
