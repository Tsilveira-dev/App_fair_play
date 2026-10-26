-- Somente metadados. Pode ser usado nos projetos autorizados, inclusive ORIGINAL,
-- sem chamar rls_auto_enable(), alterar ACLs ou consultar registros da pesquisa.
begin transaction read only;
select n.nspname as esquema,p.proname as funcao,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  pg_get_function_result(p.oid) as retorno,
  pg_get_userbyid(p.proowner) as proprietario,p.prosecdef as security_definer,
  p.proconfig as configuracao,md5(pg_get_functiondef(p.oid)) as hash_definicao,
  p.proacl as acl_direta,
  exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE') as execute_public,
  has_function_privilege('anon',p.oid,'EXECUTE') as execute_anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as execute_authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.oid=to_regprocedure('public.rls_auto_enable()');

select evtname as event_trigger,evtevent as evento,evtenabled as habilitado,
  evttags as comandos,pg_get_userbyid(evtowner) as proprietario
from pg_event_trigger where evtfoid=to_regprocedure('public.rls_auto_enable()') order by evtname;
commit;
