import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { UID, GESTOR, PARTICIPANTE, SESSAO } from './helpers/supabase.mjs';
const baseline=await readFile('supabase/migrations/001_schema.sql','utf8');
const migracao=await readFile('supabase/migrations/002_protecao.sql','utf8');
const reverter=await readFile('supabase/reverter_002.sql','utf8');
const tabelas=['gestores','participantes','configuracao_teste','sessoes_participantes','checkins','desafios_registros','solicitacoes_tentativas'];
const NOVO_UID='55555555-5555-4555-8555-555555555555';
const NOVO_ID='66666666-6666-4666-8666-666666666666';
const NOVA_SESSAO='77777777-7777-4777-8777-777777777777';
const OUTRO_UID='88888888-8888-4888-8888-888888888888';

async function banco(t,predicado="status in ('pendente','aprovada')") {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text,is_anonymous boolean,raw_app_meta_data jsonb);`);
  // Reconstrói apenas em memória as características informadas pelo responsável.
  // Não é introspecção nem cópia do banco hospedado.
  await pg.exec(baseline.replace("where status = 'aprovada';",`where ${predicado};`));
  await pg.exec(`alter index public.checkins_participante_id_dia_numero_key rename to checkin_unique_existente;
    alter index public.desafios_registros_participante_id_dia_numero_key rename to desafio_unique_existente;
    alter table public.solicitacoes_tentativas alter column id drop default;
    grant select(nome) on public.participantes to authenticated;
    create policy legado on public.participantes for select to authenticated using(true);`);
  await pg.query(`insert into auth.users values($1,null,true,'{"provider":"anonymous"}'),
    ($2,'gestor@example.invalid',false,'{"provider":"email"}'),
    ($3,null,true,'{"provider":"anonymous"}'),($4,null,true,'{"provider":"anonymous"}')`,[UID,GESTOR,NOVO_UID,OUTRO_UID]);
  await pg.query('insert into public.gestores(usuario_auth_id) values($1)',[GESTOR]);
  await pg.query("insert into public.participantes(id,nome,nome_chave) values($1,'Exemplo','exemplo')",[PARTICIPANTE]);
  await pg.exec("insert into public.configuracao_teste values(1,(now() at time zone 'America/Fortaleza')::date-30,true)");
  await pg.query(`insert into public.sessoes_participantes(id,participante_id,usuario_auth_id,status,tipo_dispositivo,autorizado_por,autorizado_em,expira_em)
    values($1,$2,$3,'aprovada','individual',$4,now()-interval '30 days',now()-interval '20 days')`,[SESSAO,PARTICIPANTE,UID,GESTOR]);
  await pg.query(`insert into public.checkins(participante_id,dia_numero,data_referencia,respostas,pontuacao,nivel,primeiro_envio_em)
    values($1,1,(now() at time zone 'America/Fortaleza')::date-30,'[{}, {}, {}, {}, {}]',0,'baixo',now()-interval '30 days')`,[PARTICIPANTE]);
  await pg.query(`insert into public.desafios_registros(participante_id,dia_numero,codigo_desafio,nivel_atribuido,status,aceito_em,concluido_em)
    values($1,1,'D01_BAIXO_ROTINA','baixo','concluido',now()-interval '30 days',now()-interval '30 days')`,[PARTICIPANTE]);
  await pg.query("insert into public.solicitacoes_tentativas(id,usuario_auth_id,criado_em) values(gen_random_uuid(),$1,now()-interval '30 days')",[UID]);
  return pg;
}
async function registros(pg) {
  return Object.fromEntries(await Promise.all(tabelas.map(async n=>[n,(await pg.query(`select * from public.${n} order by 1`)).rows])));
}
async function indices(pg) {
  return (await pg.query("select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename=any($1::text[]) order by tablename,indexname",[tabelas])).rows;
}

test('migração incremental: dados existentes, índice pendente/aprovada e reversão seletiva',async t=>{
  const pg=await banco(t);const antes=await registros(pg);const idx=await indices(pg);
  await pg.exec(migracao);
  await t.test('preserva integralmente registros históricos, inclusive expirados',async()=>{
    assert.deepEqual(await registros(pg),antes);
    assert.equal(Number((await pg.query('select pontos from public.fairplay_pontuacao')).rows[0].pontos),30);
  });
  await t.test('reutiliza UNIQUEs existentes sem criar índices redundantes ou enfraquecer o parcial',async()=>{
    assert.deepEqual(await indices(pg),idx);
    assert.deepEqual((await pg.query("select metadados->'indices_criados' as indices from public.fairplay_migration_002_backup")).rows[0].indices,[]);
  });
  await t.test('reaplicação mantém dados, índices e backup originais',async()=>{
    const backup=(await pg.query('select metadados from public.fairplay_migration_002_backup')).rows[0].metadados;
    await pg.exec(migracao);
    assert.deepEqual(await registros(pg),antes);assert.deepEqual(await indices(pg),idx);
    assert.deepEqual((await pg.query('select metadados from public.fairplay_migration_002_backup')).rows[0].metadados,backup);
  });
  await t.test('grants por coluna antigos não permitem contornar a proteção',async()=>{
    await assert.rejects(pg.transaction(async tx=>{
      await tx.exec('set local role authenticated');await tx.exec('select nome from public.participantes');
    }),/permission denied/);
  });
  await t.test('service_role tem apenas as operações necessárias e não lê o backup',async()=>{
    const r=(await pg.query(`select has_table_privilege('service_role','public.checkins','INSERT') as inserir,
      has_table_privilege('service_role','public.checkins','UPDATE') as alterar,
      has_table_privilege('service_role','public.gestores','INSERT') as gestor,
      has_table_privilege('service_role','public.configuracao_teste','UPDATE') as periodo,
      has_table_privilege('service_role','public.solicitacoes_tentativas','INSERT') as tentativas,
      has_table_privilege('service_role','public.fairplay_migration_002_backup','SELECT') as backup`)).rows[0];
    assert.deepEqual(r,{inserir:true,alterar:false,gestor:false,periodo:false,tentativas:false,backup:false});
  });
  await t.test('RPC funciona pela service_role mesmo sem default no ID de tentativas',async()=>{
    const primeira=await pg.transaction(async tx=>{
      await tx.exec('set local role service_role');return tx.query('select public.registrar_tentativa_acesso($1) as r',[UID]);
    });
    assert.equal(primeira.rows[0].r.bloqueado,false);
    assert.equal((await pg.query('select public.registrar_tentativa_acesso($1) as r',[UID])).rows[0].r.bloqueado,true);
    await assert.rejects(pg.query('select public.registrar_tentativa_acesso($1)',[GESTOR]),/Identidade não autorizada/);
  });
  await t.test('triggers não permitem alterar check-in ou reconcluir desafio histórico',async()=>{
    await assert.rejects(pg.exec('update public.checkins set pontuacao=2'),/Check-in definitivo/);
    await assert.rejects(pg.exec("update public.desafios_registros set status='concluido'"),/Transição de desafio inválida/);
  });
  await t.test('índice pendente/aprovada impede um segundo pedido ativo',async()=>{
    await pg.query("insert into public.participantes(id,nome,nome_chave) values($1,'Novo','novo')",[NOVO_ID]);
    await pg.exec("update public.configuracao_teste set data_inicio=(now() at time zone 'America/Fortaleza')::date");
    await pg.query("insert into public.sessoes_participantes(id,participante_id,usuario_auth_id,tipo_dispositivo) values($1,$2,$3,'individual')",[NOVA_SESSAO,NOVO_ID,NOVO_UID]);
    await assert.rejects(pg.query("insert into public.sessoes_participantes(participante_id,usuario_auth_id,tipo_dispositivo) values($1,$2,'individual')",[NOVO_ID,OUTRO_UID]),/sessoes_uma_ativa_por_participante/);
  });
  await t.test('novos registros exigem aprovação e acumulam 10 + 20 pontos',async()=>{
    const checkin=`insert into public.checkins(participante_id,dia_numero,data_referencia,respostas,pontuacao,nivel)
      values('${NOVO_ID}',1,(now() at time zone 'America/Fortaleza')::date,'[{}, {}, {}, {}, {}]',0,'baixo')`;
    await assert.rejects(pg.exec(checkin),/Sessão não autorizada/);
    await pg.query("update public.sessoes_participantes set status='aprovada',autorizado_por=$1 where id=$2",[GESTOR,NOVA_SESSAO]);
    await pg.exec(checkin);
    const pontos=async()=>Number((await pg.query('select pontos from public.fairplay_pontuacao where participante_id=$1',[NOVO_ID])).rows[0].pontos);
    assert.equal(await pontos(),10);
    await pg.query("insert into public.desafios_registros(participante_id,dia_numero,codigo_desafio,nivel_atribuido,status,aceito_em) values($1,1,'D01_BAIXO_ROTINA','baixo','aceito',now())",[NOVO_ID]);
    assert.equal(await pontos(),10);
    await pg.query("update public.desafios_registros set status='concluido',concluido_em=now() where participante_id=$1",[NOVO_ID]);
    assert.equal(await pontos(),30);
  });
  await t.test('Dia 8 permite só recuperar o check-in 7 e recusa novos desafios',async()=>{
    await pg.exec("update public.configuracao_teste set data_inicio=(now() at time zone 'America/Fortaleza')::date-7");
    await pg.query(`insert into public.checkins(participante_id,dia_numero,data_referencia,respostas,pontuacao,nivel,enviado_atrasado)
      values($1,7,(now() at time zone 'America/Fortaleza')::date-1,'[{}, {}, {}, {}, {}]',0,'baixo',true)`,[NOVO_ID]);
    await assert.rejects(pg.query(`insert into public.checkins(participante_id,dia_numero,data_referencia,respostas,pontuacao,nivel)
      values($1,8,(now() at time zone 'America/Fortaleza')::date,'[{}, {}, {}, {}, {}]',0,'baixo')`,[NOVO_ID]),/Dia de check-in inválido/);
    await assert.rejects(pg.query("insert into public.desafios_registros(participante_id,dia_numero,codigo_desafio,status,aceito_em) values($1,7,'D07_NEUTRO','aceito',now())",[NOVO_ID]),/Dia de desafio inválido/);
  });
  await t.test('reversão preserva todas as linhas e restaura grants anteriores sem apagar tabelas',async()=>{
    const linhas=await registros(pg);
    await pg.exec(reverter);await pg.exec(reverter);
    assert.deepEqual(await registros(pg),linhas);assert.deepEqual(await indices(pg),idx);
    assert.equal((await pg.query("select to_regprocedure('public.registrar_tentativa_acesso(uuid)') as rpc")).rows[0].rpc,null);
    assert.equal((await pg.query("select has_column_privilege('authenticated','public.participantes','nome','SELECT') as acesso")).rows[0].acesso,true);
    await pg.exec(migracao);
    assert.deepEqual(await registros(pg),linhas);assert.deepEqual(await indices(pg),idx);
  });
});

test('índice incompatível aborta atomicamente, sem modificar registros ou permissões',async t=>{
  const pg=await banco(t,"status='pendente'");const antes=await registros(pg);const idx=await indices(pg);
  await assert.rejects(pg.exec(migracao),/não satisfaz o contrato/);await pg.exec('rollback');
  assert.deepEqual(await registros(pg),antes);assert.deepEqual(await indices(pg),idx);
  assert.equal((await pg.query("select to_regclass('public.fairplay_migration_002_backup') as backup")).rows[0].backup,null);
});

test('alteração administrativa posterior impede reversão e reaplicação automáticas',async t=>{
  const pg=await banco(t);await pg.exec(migracao);
  await pg.exec('grant select on public.checkins to authenticated');
  await assert.rejects(pg.exec(reverter),/Permissões alteradas/);await pg.exec('rollback');
  await assert.rejects(pg.exec(migracao),/Permissões alteradas/);await pg.exec('rollback');
  assert.equal((await pg.query("select has_table_privilege('authenticated','public.checkins','SELECT') as acesso")).rows[0].acesso,true);
  assert.notEqual((await pg.query("select to_regprocedure('public.registrar_tentativa_acesso(uuid)') as rpc")).rows[0].rpc,null);
});
