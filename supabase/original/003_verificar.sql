-- Verificação SOMENTE LEITURA, após o plano aprovado; não instala nem corrige objetos.
begin transaction read only;
do $$
declare tabela text; papel text; funcao text; contrato record;
begin
  if to_regprocedure('public.registrar_tentativa_acesso(uuid)') is null
    or to_regclass('public.fairplay_pontuacao') is null
    or to_regclass('public.fairplay_migration_002_backup') is null then
    raise exception 'Instalação 002 incompleta';
  end if;
  if not exists(select 1 from public.fairplay_migration_002_backup where id=1 and estado='aplicada') then
    raise exception '002 não consta como aplicada';
  end if;
  foreach tabela in array array['gestores','participantes','configuracao_teste',
    'sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas',
    'fairplay_schema_migrations','fairplay_migration_002_backup','fairplay_pontuacao'] loop
    if tabela<>'fairplay_pontuacao' and not coalesce((select relrowsecurity from pg_class
      where oid=to_regclass('public.'||tabela)),false) then
      raise exception 'RLS ausente: %',tabela;
    end if;
    foreach papel in array array['anon','authenticated'] loop
      if has_table_privilege(papel,'public.'||tabela,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(papel,'public.'||tabela,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'Privilégio público efetivo inesperado: % em %; revisar heranças',papel,tabela;
      end if;
    end loop;
  end loop;
  for contrato in select * from (values
    ('gestores',true,false,false),('configuracao_teste',true,false,false),
    ('participantes',true,true,true),('sessoes_participantes',true,true,true),
    ('checkins',true,true,false),('desafios_registros',true,true,true),
    ('solicitacoes_tentativas',false,false,false),('fairplay_pontuacao',true,false,false),
    ('fairplay_schema_migrations',false,false,false),('fairplay_migration_002_backup',false,false,false)
  ) as grants(tabela,leitura,insercao,atualizacao) loop
    if has_table_privilege('service_role','public.'||contrato.tabela,'SELECT') <> contrato.leitura
      or has_table_privilege('service_role','public.'||contrato.tabela,'INSERT') <> contrato.insercao
      or has_table_privilege('service_role','public.'||contrato.tabela,'UPDATE') <> contrato.atualizacao
      or has_table_privilege('service_role','public.'||contrato.tabela,'DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or (not contrato.leitura and has_any_column_privilege('service_role','public.'||contrato.tabela,'SELECT'))
      or (not contrato.insercao and has_any_column_privilege('service_role','public.'||contrato.tabela,'INSERT'))
      or (not contrato.atualizacao and has_any_column_privilege('service_role','public.'||contrato.tabela,'UPDATE'))
      or has_any_column_privilege('service_role','public.'||contrato.tabela,'REFERENCES') then
      raise exception 'Grants da service_role incompatíveis: %; revisar sem ampliar automaticamente',contrato.tabela;
    end if;
  end loop;
  foreach funcao in array array['registrar_tentativa_acesso(uuid)',
    'fairplay_validar_registro()','fairplay_validar_aprovacao()'] loop
    if has_function_privilege('anon','public.'||funcao,'EXECUTE')
      or has_function_privilege('authenticated','public.'||funcao,'EXECUTE') then
      raise exception 'Função exposta: %',funcao;
    end if;
  end loop;
  if not has_function_privilege('service_role','public.registrar_tentativa_acesso(uuid)','EXECUTE')
    or not has_table_privilege('service_role','public.fairplay_pontuacao','SELECT')
    or not coalesce((select reloptions @> array['security_invoker=true'] from pg_class
      where oid='public.fairplay_pontuacao'::regclass),false) then
    raise exception 'RPC/visão sem contrato esperado';
  end if;
  if exists(select 1 from (values
      ('checkins','fairplay_checkin_protegido'),('desafios_registros','fairplay_desafio_protegido'),
      ('sessoes_participantes','fairplay_aprovacao_protegida')) as esperados(tabela,nome)
    where not exists(select 1 from pg_trigger t where t.tgrelid=to_regclass('public.'||esperados.tabela)
      and t.tgname=esperados.nome and not t.tgisinternal and t.tgenabled='O')) then
    raise exception 'Trigger de proteção ausente ou desabilitado';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    if has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
      or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
      raise exception 'EXECUTE de rls_auto_enable requer revisão; não alterar event triggers automaticamente';
    end if;
  end if;
end $$;

-- Comparar com o contrato de grants documentado; sem consultar dados da pesquisa.
select c.relname as objeto,
  has_table_privilege('service_role',c.oid,'SELECT') as leitura,
  has_table_privilege('service_role',c.oid,'INSERT') as insercao,
  has_table_privilege('service_role',c.oid,'UPDATE') as atualizacao,
  has_table_privilege('service_role',c.oid,'DELETE') as exclusao
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('gestores','configuracao_teste','participantes',
  'sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas','fairplay_pontuacao')
order by c.relname;
select evtname,evtevent,evtenabled,evttags,
  evtfoid::regprocedure as funcao,md5(pg_get_functiondef(evtfoid)) as hash_funcao
from pg_event_trigger order by evtname;
commit;
