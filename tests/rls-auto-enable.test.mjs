import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const correcao=await readFile('supabase/restringir_rls_auto_enable.sql','utf8');
const inspecao=await readFile('supabase/inspecionar_rls_auto_enable.sql','utf8');

async function fixture(t) {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon;create role authenticated;
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$
    declare comando record;
    begin
      for comando in select * from pg_event_trigger_ddl_commands() loop
        if comando.object_type='table' and comando.schema_name='public' then
          execute format('alter table %s enable row level security',comando.objid::regclass);
        end if;
      end loop;
    end $$;
    create event trigger fixture_rls on ddl_command_end when tag in ('CREATE TABLE')
      execute function public.rls_auto_enable();
    grant execute on function public.rls_auto_enable() to anon,authenticated;`);
  return pg;
}
test('ACL de rls_auto_enable: revoga PUBLIC/anon/authenticated e mantém RLS automático no CREATE TABLE',async t=>{
  const pg=await fixture(t);
  const hash=async()=>(await pg.query("select md5(pg_get_functiondef('public.rls_auto_enable()'::regprocedure)) as hash")).rows[0].hash;
  const antes=await hash();
  await pg.exec(inspecao);await pg.exec(correcao);await pg.exec(correcao);await pg.exec(inspecao);
  assert.equal(await hash(),antes);
  const direitos=(await pg.query(`select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as anon,
    has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') as authenticated`)).rows[0];
  assert.deepEqual(direitos,{anon:false,authenticated:false});
  await pg.exec('grant usage,create on schema public to authenticated');
  await pg.transaction(async tx=>{
    await tx.exec('set local role authenticated');await tx.exec('create table public.fixture_depois(id integer)');
  });
  assert.equal((await pg.query("select relrowsecurity from pg_class where oid='public.fixture_depois'::regclass")).rows[0].relrowsecurity,true);
  assert.equal((await pg.query("select evtenabled from pg_event_trigger where evtname='fixture_rls'")).rows[0].evtenabled,'O');
});
test('ACL de rls_auto_enable: função com outra assinatura permanece intacta',async t=>{
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec('create role anon;create role authenticated;create function public.rls_auto_enable() returns integer language sql as $$select 1$$');
  await assert.rejects(pg.exec(correcao),/Assinatura inesperada/);await pg.exec('rollback');
  assert.equal((await pg.query('select public.rls_auto_enable() as valor')).rows[0].valor,1);
  assert.equal((await pg.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as permitido")).rows[0].permitido,true);
});
test('ACL de rls_auto_enable: herança inesperada aborta sem ampliar a correção',async t=>{
  const pg=await fixture(t);
  await pg.exec('create role legado;grant legado to authenticated;grant execute on function public.rls_auto_enable() to legado');
  await assert.rejects(pg.exec(correcao),/herdado de outro papel/);await pg.exec('rollback');
  assert.equal((await pg.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as permitido")).rows[0].permitido,true);
});
