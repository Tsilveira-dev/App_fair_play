-- Correção pontual de ACL. Não reaplica 002, não reescreve a definição da função ou seus event triggers.
-- Preparada para revisão administrativa; confirmar o projeto e os metadados antes de aplicar.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog,public;
do $$
declare alvo oid; definicao_antes text; eventos_antes jsonb; eventos_depois jsonb;
begin
  alvo:=to_regprocedure('public.rls_auto_enable()');
  if alvo is null then raise exception 'Função esperada não encontrada; nenhuma função será criada'; end if;
  if (select prorettype from pg_proc where oid=alvo) <> 'pg_catalog.event_trigger'::regtype then
    raise exception 'Assinatura inesperada: revisar a finalidade antes de restringir privilégios';
  end if;
  definicao_antes:=md5(pg_get_functiondef(alvo));
  select jsonb_agg(jsonb_build_object('nome',evtname,'evento',evtevent,'owner',evtowner,
    'habilitado',evtenabled,'tags',evttags) order by evtname)
    into eventos_antes from pg_event_trigger where evtfoid=alvo;

  -- Revogar só dos papéis diretos não basta se PUBLIC continuar concedendo EXECUTE.
  revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

  if has_function_privilege('anon',alvo,'EXECUTE') or has_function_privilege('authenticated',alvo,'EXECUTE') then
    raise exception 'EXECUTE ainda herdado de outro papel: revisão necessária; transação cancelada';
  end if;
  select jsonb_agg(jsonb_build_object('nome',evtname,'evento',evtevent,'owner',evtowner,
    'habilitado',evtenabled,'tags',evttags) order by evtname)
    into eventos_depois from pg_event_trigger where evtfoid=alvo;
  if md5(pg_get_functiondef(alvo)) is distinct from definicao_antes
    or eventos_depois is distinct from eventos_antes then
    raise exception 'Definição ou event triggers alterados inesperadamente; transação cancelada';
  end if;
end $$;
commit;
