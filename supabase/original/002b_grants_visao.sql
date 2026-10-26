-- ORIGINAL, somente após aprovação e após 002. Sem dados ou default privileges globais.
-- CREATE VIEW pode herdar grants mais amplos dos defaults do projeto existente.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog,public;
select pg_advisory_xact_lock(761220262);
do $$
begin
  if not exists(select 1 from public.fairplay_migration_002_backup where id=1 and estado='aplicada')
    or not coalesce((select reloptions @> array['security_invoker=true'] from pg_class
      where oid=to_regclass('public.fairplay_pontuacao') and relkind='v'),false) then
    raise exception '002/visão incompatível; não criar ou substituir objetos';
  end if;
end $$;
revoke all on public.fairplay_pontuacao from public,anon,authenticated,service_role;
revoke all (participante_id,pontos) on public.fairplay_pontuacao from public,anon,authenticated,service_role;
grant select on public.fairplay_pontuacao to service_role;
commit;
