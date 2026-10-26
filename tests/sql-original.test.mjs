import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { UID, GESTOR, PARTICIPANTE, SESSAO } from './helpers/supabase.mjs';
const baseline=await readFile('supabase/migrations/001_schema.sql','utf8');
const antes002=await readFile('supabase/original/000_pre_002.sql','utf8');
const protecao=await readFile('supabase/migrations/002_protecao.sql','utf8');
const grantsVisao=await readFile('supabase/original/002b_grants_visao.sql','utf8');
const verificar=await readFile('supabase/original/003_verificar.sql','utf8');

async function fixture(t) {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,is_anonymous boolean,raw_app_meta_data jsonb);
    create function public.rls_auto_enable() returns event_trigger language plpgsql security definer as $$
    declare comando record;
    begin
      for comando in select * from pg_event_trigger_ddl_commands() loop
        if comando.object_type='table' and comando.schema_name='public' then
          execute format('alter table %s enable row level security',comando.objid::regclass);
        end if;
      end loop;
    end $$;
    create event trigger fixture_original_rls on ddl_command_end when tag in ('CREATE TABLE')
      execute function public.rls_auto_enable();
    revoke execute on function public.rls_auto_enable() from public,anon,authenticated;`);
  // Modelo local das características informadas, sem copiar/introspectar o ORIGINAL.
  const legado=baseline.replace(/create table if not exists public\.solicitacoes_tentativas \([\s\S]*?create index if not exists tentativas_data[^;]*;/,'')
    .replaceAll(",'solicitacoes_tentativas'",'')
    .replace("where status = 'aprovada';","where status in ('pendente','aprovada');");
  await pg.exec(legado);
  await pg.exec('create table public.fixture_legado_extra(id integer primary key,valor text)');
  await pg.query("insert into auth.users values($1,null,true,'{\"provider\":\"anonymous\"}')",[UID]);
  await pg.query("insert into public.participantes(id,nome,nome_chave) values($1,'Exemplo','exemplo')",[PARTICIPANTE]);
  await pg.exec("insert into public.fixture_legado_extra values(1,'preservar')");
  return pg;
}
async function metadados(pg) {
  return (await pg.query(`select evtname,evtenabled,evtevent,evttags,evtfoid,
    md5(pg_get_functiondef(evtfoid)) as hash from pg_event_trigger order by evtname`)).rows;
}

test('plano ORIGINAL isolado: pré-requisito + 002 preservam dados, índice e event trigger',async t=>{
  const pg=await fixture(t);
  const eventos=await metadados(pg);
  const participantes=(await pg.query('select * from public.participantes')).rows;
  const indice=(await pg.query("select indexdef from pg_indexes where indexname='sessoes_uma_ativa_por_participante'")).rows;
  assert.equal((await pg.query("select count(*) as n from pg_tables where schemaname='public'")).rows[0].n,8);
  await pg.exec(antes002);
  assert.equal((await pg.query('select count(*) as n from public.solicitacoes_tentativas')).rows[0].n,0);
  await pg.exec(protecao);await pg.exec(grantsVisao);await pg.exec(verificar);
  assert.deepEqual((await pg.query('select * from public.participantes')).rows,participantes);
  assert.deepEqual((await pg.query('select * from public.fixture_legado_extra')).rows,[{id:1,valor:'preservar'}]);
  assert.deepEqual(await metadados(pg),eventos);
  assert.deepEqual((await pg.query("select indexdef from pg_indexes where indexname='sessoes_uma_ativa_por_participante'")).rows,indice);
  assert.deepEqual((await pg.query("select metadados->'indices_criados' as indices from public.fairplay_migration_002_backup")).rows[0].indices,[]);
  await pg.transaction(async tx=>{
    await tx.exec('set local role service_role');
    const r=await tx.query('select public.registrar_tentativa_acesso($1) as r',[UID]);
    assert.equal(r.rows[0].r.bloqueado,false);
  });
  await assert.rejects(pg.transaction(async tx=>{
    await tx.exec('set local role service_role');await tx.exec('select * from public.solicitacoes_tentativas');
  }),/permission denied/);
});

test('pré-requisito isolado: repetível antes da 002 e bloqueado após a proteção',async t=>{
  const pg=await fixture(t);await pg.exec(antes002);
  await pg.query('insert into public.solicitacoes_tentativas(usuario_auth_id) values($1)',[UID]);
  const registros=(await pg.query('select * from public.solicitacoes_tentativas')).rows;
  const indices=(await pg.query("select indexname,indexdef from pg_indexes where tablename='solicitacoes_tentativas' order by indexname")).rows;
  await pg.exec(antes002);
  assert.deepEqual((await pg.query('select * from public.solicitacoes_tentativas')).rows,registros);
  assert.deepEqual((await pg.query("select indexname,indexdef from pg_indexes where tablename='solicitacoes_tentativas' order by indexname")).rows,indices);
  await pg.exec(protecao);
  await assert.rejects(pg.exec(antes002),/Proteções já presentes/);await pg.exec('rollback');
  assert.deepEqual((await pg.query('select * from public.solicitacoes_tentativas')).rows,registros);
});

test('pré-requisito isolado: contrato divergente e índice homônimo abortam sem alterar dados',async t=>{
  const pg=await fixture(t);
  await pg.exec('create table public.solicitacoes_tentativas(id text primary key,usuario_auth_id uuid not null,criado_em timestamptz not null)');
  await assert.rejects(pg.exec(antes002),/Tentativas incompatível/);await pg.exec('rollback');
  assert.equal((await pg.query("select atttypid::regtype::text as tipo from pg_attribute where attrelid='public.solicitacoes_tentativas'::regclass and attname='id'")).rows[0].tipo,'text');
  // DDL somente na fixture vazia em memória, nunca em um projeto hospedado.
  await pg.exec('drop table public.solicitacoes_tentativas;create index tentativas_data on public.fixture_legado_extra(id)');
  await assert.rejects(pg.exec(antes002),/Índice de tentativas incompatível/);await pg.exec('rollback');
  assert.equal((await pg.query("select to_regclass('public.solicitacoes_tentativas') as tabela")).rows[0].tabela,null);
  assert.deepEqual((await pg.query('select * from public.fixture_legado_extra')).rows,[{id:1,valor:'preservar'}]);
});

test('pré-requisito isolado: RLS ou índice de sessões inesperado interrompe antes de criar tabela',async t=>{
  const pg=await fixture(t);
  await pg.exec('alter table public.checkins disable row level security');
  await assert.rejects(pg.exec(antes002),/Tabela ou RLS incompatível/);await pg.exec('rollback');
  await pg.exec(`alter table public.checkins enable row level security;
    drop index public.sessoes_uma_ativa_por_participante;
    create unique index sessoes_uma_ativa_por_participante on public.sessoes_participantes(participante_id) where status='aprovada'`);
  await assert.rejects(pg.exec(antes002),/Índice pendente\/aprovada não reconhecido/);await pg.exec('rollback');
  assert.equal((await pg.query("select to_regclass('public.solicitacoes_tentativas') as tabela")).rows[0].tabela,null);
});

test('verificação somente leitura recusa privilégios herdados e event trigger exposto',async t=>{
  const pg=await fixture(t);await pg.exec(antes002);await pg.exec(protecao);
  await pg.exec('create role legado;grant legado to authenticated;grant select(nome) on public.participantes to legado');
  await assert.rejects(pg.exec(verificar),/Privilégio público efetivo inesperado/);await pg.exec('rollback');
  await pg.exec('revoke select(nome) on public.participantes from legado;grant execute on function public.rls_auto_enable() to anon');
  await assert.rejects(pg.exec(verificar),/EXECUTE de rls_auto_enable requer revisão/);await pg.exec('rollback');
  assert.equal((await pg.query("select has_function_privilege('anon','public.rls_auto_enable()','EXECUTE') as exposto")).rows[0].exposto,true);
});

test('plano ORIGINAL isolado: grants da visão normalizados sem alterar defaults globais',async t=>{
  const pg=await fixture(t);await pg.exec(antes002);
  await pg.exec('alter default privileges in schema public grant all on tables to service_role');
  await pg.exec(protecao);
  await assert.rejects(pg.exec(verificar),/Grants da service_role incompatíveis: fairplay_pontuacao/);await pg.exec('rollback');
  const definicao=(await pg.query("select pg_get_viewdef('public.fairplay_pontuacao'::regclass) as v")).rows;
  await pg.exec(grantsVisao);await pg.exec(grantsVisao);await pg.exec(verificar);
  assert.deepEqual((await pg.query("select pg_get_viewdef('public.fairplay_pontuacao'::regclass) as v")).rows,definicao);
  await pg.exec('create table public.fixture_default_preservado(id integer)');
  assert.equal((await pg.query("select has_table_privilege('service_role','public.fixture_default_preservado','DELETE') as d")).rows[0].d,true);
});

test('ORIGINAL com pré-requisito aplicado: 002 → grants → verificação preserva 3 participantes, gestor, sessão e Auth',async t=>{
  const pg=await fixture(t);
  await pg.exec(antes002); // Estado inicial reproduzido somente em memória, uma única vez.
  await pg.exec(`alter table auth.users add column encrypted_password text;
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),criado_em timestamptz);
    create table auth.identities(id uuid primary key,user_id uuid references auth.users(id),provider text);`);
  await pg.query(`insert into auth.users(id,email,is_anonymous,raw_app_meta_data,encrypted_password)
    values($1,'gestor@example.invalid',false,'{"provider":"email"}','sentinela-local-sem-credencial')`,[GESTOR]);
  await pg.query('insert into public.gestores(usuario_auth_id) values($1)',[GESTOR]);
  await pg.exec(`insert into public.participantes(nome,nome_chave) values('FicticioB','ficticiob'),('FicticioC','ficticioc');
    insert into public.configuracao_teste values(1,(now() at time zone 'America/Fortaleza')::date-20,false);`);
  await pg.query(`insert into public.sessoes_participantes(id,participante_id,usuario_auth_id,status,tipo_dispositivo,
      autorizado_por,autorizado_em,expira_em)
    values($1,$2,$3,'aprovada','individual',$4,now()-interval '20 days',now()-interval '10 days')`,[SESSAO,PARTICIPANTE,UID,GESTOR]);
  await pg.query('insert into auth.sessions values($1,$2,now())',[SESSAO,GESTOR]);
  await pg.query("insert into auth.identities values($1,$2,'email')",[GESTOR,GESTOR]);
  const tabelas=['auth.users','auth.sessions','auth.identities','public.gestores','public.participantes',
    'public.sessoes_participantes','public.configuracao_teste','public.checkins','public.desafios_registros',
    'public.solicitacoes_tentativas'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(tabelas.map(async nome=>
    [nome,(await pg.query(`select * from ${nome} order by 1`)).rows])));
  const antes=await snapshot();
  assert.equal(antes['public.participantes'].length,3);
  assert.equal(antes['public.gestores'].length,1);assert.equal(antes['public.sessoes_participantes'].length,1);
  const eventos=await metadados(pg);
  await pg.exec(protecao);
  assert.equal((await pg.query('select estado from public.fairplay_migration_002_backup where id=1')).rows[0].estado,'aplicada');
  await pg.exec(grantsVisao);await pg.exec(verificar);
  assert.deepEqual(await snapshot(),antes); // Inclui UID, vínculo, senha sentinela e sessão expirada, sem renovação.
  assert.deepEqual(await metadados(pg),eventos);
  await assert.rejects(pg.transaction(async tx=>{
    await tx.exec('set local role authenticated');await tx.exec('select * from public.participantes');
  }),/permission denied/);
});
