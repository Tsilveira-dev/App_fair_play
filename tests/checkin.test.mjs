import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/checkin.mjs';
import { preparar, evento, alternativas, dados, AGORA, PARTICIPANTE, UID, TOKEN_GESTOR } from './helpers/supabase.mjs';

for (const [escolha,nivel,pontos] of [[1,'baixo',0],[2,'moderado',5],[3,'alto',10],[4,null,null]]) {
  test(`check-in: classificação ${nivel || 'neutra'} calculada no servidor`,async t=>{
    const {db}=preparar(t);
    const r=await handler(evento('POST',{respostas:escolha === 4 ? alternativas(1,4).map((v,i)=>i===0||i===4 ? alternativas()[i] : v) : alternativas(1,escolha),nivel:'alto',pontuacao:999,participante_id:crypto.randomUUID(),dia_numero:7}));
    assert.equal(r.statusCode,201); assert.equal(dados(r).checkin.nivel,nivel);
    assert.equal(dados(r).checkin.pontuacao,pontos);
    assert.equal(db.checkins[0].participante_id,PARTICIPANTE);
    assert.equal(db.checkins[0].dia_numero,1);
    assert.equal(db.checkins[0].respostas.length,5);
  });
}
test('check-in: um registro por participante/dia, inclusive envios concorrentes',async t=>{
  const {db}=preparar(t);
  const resultados=await Promise.all([handler(evento('POST',{respostas:alternativas()})),handler(evento('POST',{respostas:alternativas()}))]);
  assert.deepEqual(resultados.map(r=>r.statusCode).sort(),[201,409]); assert.equal(db.checkins.length,1);
});
for (const respostas of [[], alternativas().slice(1), [...alternativas(),'extra'], ['errado',...alternativas().slice(1)], alternativas(2), alternativas(1,9)]) {
  test(`check-in: recusa respostas inválidas ${JSON.stringify(respostas)}`,async t=>{
    const {db}=preparar(t); assert.equal((await handler(evento('POST',{respostas}))).statusCode,400); assert.equal(db.checkins.length,0);
  });
}
test('check-in: Dia 8 recupera apenas Dia 7 e não cria oitavo check-in',async t=>{
  const {db}=preparar(t); t.mock.timers.setTime(AGORA+7*86400000);
  const r=await handler(evento('POST',{respostas:alternativas(7)}));
  assert.equal(r.statusCode,201); assert.equal(db.checkins[0].dia_numero,7);
  assert.equal(db.checkins[0].enviado_atrasado,true); assert.equal(db.checkins[0].data_referencia,'2026-01-07');
  assert.equal((await handler(evento('POST',{respostas:alternativas(7)}))).statusCode,409);
});
for (const deslocamento of [-86400000,8*86400000]) {
  test(`check-in: recusa fora da coleta (${deslocamento})`,async t=>{
    preparar(t); t.mock.timers.setTime(AGORA+deslocamento);
    assert.equal((await handler(evento('POST',{respostas:alternativas()}))).statusCode,403);
  });
}
for (const status of ['pendente','recusada','revogada']) {
  test(`check-in: recusa sessão ${status}`,async t=>{
    const {db}=preparar(t); db.sessoes_participantes[0].status=status;
    assert.equal((await handler(evento('POST',{respostas:alternativas()}))).statusCode,403); assert.equal(db.checkins.length,0);
  });
}
for (const validade of [null,'inválida','2025-01-01T00:00:00Z']) {
  test(`check-in: validade ${validade} bloqueada`,async t=>{
    const {db}=preparar(t); db.sessoes_participantes[0].expira_em=validade;
    assert.equal((await handler(evento())).statusCode,403);
  });
}
test('check-in: rejeita participante inativo e data impossível',async t=>{
  const {db}=preparar(t); db.participantes[0].ativo=false;
  assert.equal((await handler(evento())).statusCode,403);
  db.participantes[0].ativo=true; db.configuracao_teste[0].data_inicio='2026-02-30';
  assert.equal((await handler(evento())).statusCode,500);
});
test('check-in: consulta é limitada ao UID autenticado e não expõe IDs',async t=>{
  const {db,chamadas}=preparar(t);
  db.checkins.push({participante_id:crypto.randomUUID(),dia_numero:1,respostas:['secreto']});
  const r=await handler(evento('GET',undefined,undefined,{participante_id:'outro'}));
  assert.equal(r.statusCode,200); assert.deepEqual(dados(r).checkins,[]);
  const sessao=chamadas.find(c=>c.url.pathname.endsWith('sessoes_participantes'));
  assert.equal(sessao.url.searchParams.get('usuario_auth_id'),`eq.${UID}`);
});
test('check-in: ausência, token inválido, gestor e método indevido bloqueados',async t=>{
  preparar(t);
  assert.equal((await handler(evento('GET',undefined,null))).statusCode,401);
  assert.equal((await handler(evento('GET',undefined,'token-invalido'))).statusCode,401);
  assert.equal((await handler(evento('GET',undefined,TOKEN_GESTOR))).statusCode,403);
  assert.equal((await handler(evento('DELETE'))).statusCode,405);
});
test('check-in: indisponibilidade do Supabase não confirma gravação',async t=>{
  const {db}=preparar(t,{falha:true});
  assert.equal((await handler(evento('POST',{respostas:alternativas()}))).statusCode,500); assert.equal(db.checkins.length,0);
});
