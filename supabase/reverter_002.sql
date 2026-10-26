-- Reversão seletiva da nova 002. Somente em janela de manutenção e no mesmo banco.
-- Não exclui tabelas, linhas de pesquisa, usuários ou índices preexistentes.
-- Falha se definições/permissões foram alteradas por outra migração após a 002.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path = pg_catalog,public;
select pg_advisory_xact_lock(761220262);
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
declare backup jsonb; estado_atual text; item record; esperado jsonb; tabela jsonb; direito jsonb; papel text; indice text;
begin
  select estado,metadados into estado_atual,backup from public.fairplay_migration_002_backup where id=1 for update;
  if estado_atual='revertida' then return; end if;
  if estado_atual is distinct from 'aplicada' then raise exception 'Backup 002 aplicado não encontrado'; end if;
  if pg_temp.fairplay_acl_snapshot() is distinct from backup->'depois' then
    raise exception 'Permissões alteradas após 002; revisão necessária antes de reverter';
  end if;
  select jsonb_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) into esperado
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
      and p.proname in ('registrar_tentativa_acesso','fairplay_validar_registro','fairplay_validar_aprovacao');
  if esperado is distinct from backup->'funcoes' then raise exception 'Funções alteradas após 002'; end if;
  select jsonb_object_agg(t.tgname,md5(pg_get_triggerdef(t.oid))) into esperado from pg_trigger t
    where t.tgrelid in ('public.checkins'::regclass,'public.desafios_registros'::regclass,'public.sessoes_participantes'::regclass)
      and t.tgname in ('fairplay_checkin_protegido','fairplay_desafio_protegido','fairplay_aprovacao_protegida');
  if esperado is distinct from backup->'triggers' then raise exception 'Triggers alterados após 002'; end if;
  if to_regclass('public.fairplay_pontuacao') is null or
    to_jsonb(md5(pg_get_viewdef('public.fairplay_pontuacao'::regclass,true))) is distinct from backup->'view' then
    raise exception 'Visão alterada após 002';
  end if;

  drop trigger fairplay_checkin_protegido on public.checkins;
  drop trigger fairplay_desafio_protegido on public.desafios_registros;
  drop trigger fairplay_aprovacao_protegida on public.sessoes_participantes;
  drop function public.fairplay_validar_registro();
  drop function public.fairplay_validar_aprovacao();
  drop function public.registrar_tentativa_acesso(uuid);
  drop view public.fairplay_pontuacao;
  for indice in select jsonb_array_elements_text(backup->'indices_criados') loop
    execute format('drop index public.%I',indice);
  end loop;
  for tabela in select jsonb_array_elements(backup->'antes') loop
    execute format('revoke all on table public.%I from public,anon,authenticated,service_role',tabela->>'tabela');
    -- A migração já removeu os grants de coluna; restaura os originais sem ampliar direitos.
    for direito in select jsonb_array_elements(tabela->'grants') loop
      papel:=case when direito->>'role'='public' then 'public' else format('%I',direito->>'role') end;
      execute format('grant %s on public.%I to %s%s',direito->>'privilegio',tabela->>'tabela',papel,
        case when (direito->>'grantable')::boolean then ' with grant option' else '' end);
    end loop;
    for direito in select jsonb_array_elements(tabela->'column_grants') loop
      papel:=case when direito->>'role'='public' then 'public' else format('%I',direito->>'role') end;
      execute format('grant %s (%I) on public.%I to %s%s',direito->>'privilegio',direito->>'coluna',tabela->>'tabela',papel,
        case when (direito->>'grantable')::boolean then ' with grant option' else '' end);
    end loop;
    execute format('alter table public.%I %s row level security',tabela->>'tabela',
      case when (tabela->>'rls')::boolean then 'enable' else 'disable' end);
  end loop;
  update public.fairplay_migration_002_backup set estado='revertida' where id=1;
  insert into public.fairplay_schema_migrations(versao) values('002_revertida') on conflict do nothing;
end $$;
commit;
