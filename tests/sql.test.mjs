import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { UID, GESTOR, PARTICIPANTE, SESSAO } from './helpers/supabase.mjs';

test('PostgreSQL isolado: migrações, privacidade, duplicidade e pontuação',async t=>{
  const pg=new PGlite(); t.after(()=>pg.close());
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, is_anonymous boolean default false, raw_app_meta_data jsonb);`);
  const baseline=await readFile('supabase/migrations/001_schema.sql','utf8');
  const protecao=await readFile('supabase/migrations/002_protecao.sql','utf8');
  await pg.exec(baseline); await pg.exec(protecao);
  await pg.exec(baseline); await pg.exec(protecao);
  await t.test('migrações repetíveis, sem participantes ou dados de TESTE',async()=>{
    assert.equal((await pg.query('select count(*) as n from public.participantes')).rows[0].n,0);
    assert.equal((await pg.query('select count(*) as n from public.fairplay_schema_migrations')).rows[0].n,2);
  });
  await pg.query(`insert into auth.users values ($1,null,true,'{"provider":"anonymous"}'),($2,'gestor@example.invalid',false,'{"provider":"email"}')`,[UID,GESTOR]);
  await pg.query('insert into public.gestores(usuario_auth_id) values ($1)',[GESTOR]);
  await pg.query("insert into public.participantes(id,nome,nome_chave) values ($1,'Exemplo','exemplo')",[PARTICIPANTE]);
  await pg.exec("insert into public.configuracao_teste values(1,(now() at time zone 'America/Fortaleza')::date,true)");
  await pg.query("insert into public.sessoes_participantes(id,participante_id,usuario_auth_id,tipo_dispositivo) values($1,$2,$3,'individual')",[SESSAO,PARTICIPANTE,UID]);
  const checkin=`insert into public.checkins(participante_id,dia_numero,data_referencia,respostas,pontuacao,nivel)
    values('${PARTICIPANTE}',1,(now() at time zone 'America/Fortaleza')::date,'[{}, {}, {}, {}, {}]',0,'baixo')`;
  await t.test('sessão pendente não grava check-in',async()=>{
    await assert.rejects(pg.exec(checkin),/Sessão não autorizada/);
  });
  await pg.query("update public.sessoes_participantes set status='aprovada',autorizado_por=$1 where id=$2",[GESTOR,SESSAO]);
  await t.test('aprovação recebe expiração do Dia 8 no banco',async()=>{
    const r=await pg.query("select expira_em > now()+interval '6 days' as valido from public.sessoes_participantes");
    assert.equal(r.rows[0].valido,true);
  });
  await t.test('check-in vale dez pontos, é único e imutável',async()=>{
    await pg.exec(checkin);
    await assert.rejects(pg.exec(checkin),/unique constraint/);
    await assert.rejects(pg.exec('update public.checkins set pontuacao=10'),/Check-in definitivo/);
    await assert.rejects(pg.exec('delete from public.checkins'),/exclusão não permitida/);
    assert.equal(Number((await pg.query('select pontos from public.fairplay_pontuacao')).rows[0].pontos),10);
  });
  const desafio=`insert into public.desafios_registros(participante_id,dia_numero,codigo_desafio,nivel_atribuido,status,aceito_em)
    values('${PARTICIPANTE}',1,'D01_BAIXO_ROTINA','baixo','aceito',now())`;
  await t.test('aceite não soma pontos; conclusão manual acrescenta vinte uma só vez',async()=>{
    await pg.exec(desafio);
    await assert.rejects(pg.exec(desafio),/unique constraint/);
    assert.equal(Number((await pg.query('select pontos from public.fairplay_pontuacao')).rows[0].pontos),10);
    await pg.exec("update public.desafios_registros set status='concluido',concluido_em=now() where status='aceito'");
    assert.equal(Number((await pg.query('select pontos from public.fairplay_pontuacao')).rows[0].pontos),30);
    await assert.rejects(pg.exec("update public.desafios_registros set status='concluido',concluido_em=now()"),/Transição de desafio inválida/);
    await assert.rejects(pg.exec('delete from public.desafios_registros'),/exclusão não permitida/);
  });
  await t.test('um segundo dispositivo não recebe autorização simultânea',async()=>{
    const outro='55555555-5555-4555-8555-555555555555';
    await pg.query("insert into auth.users(id,is_anonymous,raw_app_meta_data) values($1,true,'{\"provider\":\"anonymous\"}')",[outro]);
    await pg.query("insert into public.sessoes_participantes(participante_id,usuario_auth_id,tipo_dispositivo) values($1,$2,'individual')",[PARTICIPANTE,outro]);
    await assert.rejects(pg.query("update public.sessoes_participantes set status='aprovada',autorizado_por=$1 where usuario_auth_id=$2",[GESTOR,outro]),/unique constraint/);
  });
  for(const role of ['anon','authenticated']) {
    await t.test(`${role} não lê nem escreve dados pessoais, respostas ou pontuação`,async()=>{
      for(const tabela of ['gestores','participantes','sessoes_participantes','checkins','desafios_registros','fairplay_pontuacao']) {
        await assert.rejects(pg.transaction(async tx=>{
          await tx.exec(`set local role ${role}`); await tx.exec(`select * from public.${tabela}`);
        }),/permission denied/);
      }
      await assert.rejects(pg.transaction(async tx=>{
        await tx.exec(`set local role ${role}`); await tx.query('select public.registrar_tentativa_acesso($1)',[UID]);
      }),/permission denied/);
    });
  }
  await t.test('limite de acesso persiste no banco e impede requisições simultâneas',async()=>{
    const r=await Promise.all([pg.query('select public.registrar_tentativa_acesso($1) as limite',[UID]),pg.query('select public.registrar_tentativa_acesso($1) as limite',[UID])]);
    assert.deepEqual(r.map(v=>v.rows[0].limite.bloqueado).sort(),[false,true]);
    assert.equal((await pg.query('select count(*) as n from public.solicitacoes_tentativas')).rows[0].n,1);
  });
  await t.test('limite de dez solicitações por hora e limite global de 300',async()=>{
    await pg.exec("update public.solicitacoes_tentativas set criado_em=now()-interval '2 minutes'");
    await pg.query("insert into public.solicitacoes_tentativas(usuario_auth_id,criado_em) select $1,now()-interval '3 minutes' from generate_series(1,9)",[UID]);
    let r=await pg.query('select public.registrar_tentativa_acesso($1) as limite',[UID]); assert.equal(r.rows[0].limite.motivo,'limite');
    const outro='55555555-5555-4555-8555-555555555555';
    await pg.query("insert into public.solicitacoes_tentativas(usuario_auth_id,criado_em) select $1,now()-interval '3 minutes' from generate_series(1,290)",[UID]);
    r=await pg.query('select public.registrar_tentativa_acesso($1) as limite',[outro]); assert.equal(r.rows[0].limite.bloqueado,true);
  });
  await t.test('revogação e desativação preservam o histórico',async()=>{
    await pg.exec("update public.sessoes_participantes set status='revogada' where status='aprovada'; update public.participantes set ativo=false");
    assert.equal((await pg.query('select count(*) as n from public.checkins')).rows[0].n,1);
    assert.equal(Number((await pg.query('select pontos from public.fairplay_pontuacao')).rows[0].pontos),30);
  });
});

test('baseline recusa banco existente sem histórico de migração, sem alterar dados',async t=>{
  const pg=new PGlite(); t.after(()=>pg.close());
  await pg.exec('create table public.participantes(id integer); insert into public.participantes values(42)');
  await assert.rejects(pg.exec(await readFile('supabase/migrations/001_schema.sql','utf8')),/Base existente/);
  await pg.exec('rollback');
  assert.deepEqual((await pg.query('select * from public.participantes')).rows,[{id:42}]);
});
