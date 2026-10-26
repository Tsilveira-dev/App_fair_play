import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/desafio.mjs';
import { preparar, evento, dados, AGORA, PARTICIPANTE } from './helpers/supabase.mjs';

for (const [nivel,sufixo] of [[null,'NEUTRO'],['baixo','BAIXO_ROTINA'],['moderado','MODERADO_PAUSA'],['alto','ALTO_ATIVIDADE']]) {
  test(`desafio: nível ${nivel || 'neutro'} escolhido pelo servidor`,async t=>{
    const {db}=preparar(t);
    if(nivel) db.checkins.push({participante_id:PARTICIPANTE,dia_numero:1,nivel});
    const r=await handler(evento('POST',{acao:'aceitar',nivel:'alto',dia_numero:7,pontos:999}));
    assert.equal(r.statusCode,201); assert.equal(dados(r).desafio.codigo_desafio,`D01_${sufixo}`);
    assert.equal(dados(r).desafio.nivel_atribuido,nivel); assert.equal(dados(r).pontos,0);
  });
}
test('desafio: aceite único e conclusão manual única, sem exigir cronômetro',async t=>{
  const {db}=preparar(t);
  const aceitar=await handler(evento('POST',{acao:'aceitar'})); assert.equal(aceitar.statusCode,201);
  assert.equal(db.desafios_registros[0].status,'aceito');
  assert.equal((await handler(evento('POST',{acao:'aceitar'}))).statusCode,409);
  const concluido=await handler(evento('POST',{acao:'concluir'}));
  assert.equal(concluido.statusCode,200); assert.equal(dados(concluido).pontos,20);
  assert.equal(db.desafios_registros[0].status,'concluido');
  assert.equal((await handler(evento('POST',{acao:'concluir'}))).statusCode,409);
  assert.equal(db.desafios_registros.length,1);
});
test('desafio: duas aceitações simultâneas produzem só um registro',async t=>{
  const {db}=preparar(t);
  const r=await Promise.all([handler(evento('POST',{acao:'aceitar'})),handler(evento('POST',{acao:'aceitar'}))]);
  assert.deepEqual(r.map(x=>x.statusCode).sort(),[201,409]); assert.equal(db.desafios_registros.length,1);
});
test('desafio: não conclui sem aceite e não aceita ação arbitrária',async t=>{
  preparar(t); assert.equal((await handler(evento('POST',{acao:'concluir'}))).statusCode,409);
  assert.equal((await handler(evento('POST',{acao:'apagar'}))).statusCode,400);
});
for (const valor of [null,'inválida','2025-01-01T00:00:00Z']) {
  test(`desafio: expiração inválida ou ausente (${valor}) falha fechada`,async t=>{
    const {db}=preparar(t); db.sessoes_participantes[0].expira_em=valor;
    assert.equal((await handler(evento('POST',{acao:'aceitar'}))).statusCode,403);
    assert.equal(db.desafios_registros.length,0);
  });
}
for (const dia of [0,8,9]) {
  test(`desafio: não cria nem conclui no Dia ${dia}`,async t=>{
    const {db}=preparar(t); t.mock.timers.setTime(AGORA+(dia-1)*86400000);
    for (const acao of ['aceitar','concluir']) assert.equal((await handler(evento('POST',{acao}))).statusCode,403);
    assert.equal(db.desafios_registros.length,0);
  });
}
test('desafio: não reaproveita classificação do dia anterior',async t=>{
  const {db}=preparar(t); db.checkins.push({participante_id:PARTICIPANTE,dia_numero:1,nivel:'alto'});
  t.mock.timers.setTime(AGORA+86400000);
  const r=await handler(evento('POST',{acao:'aceitar'}));
  assert.equal(dados(r).desafio.codigo_desafio,'D02_NEUTRO');
});
test('desafio: data impossível e participante inativo bloqueados',async t=>{
  const {db}=preparar(t); db.configuracao_teste[0].data_inicio='2026-02-30';
  assert.equal((await handler(evento())).statusCode,403);
  db.configuracao_teste[0].data_inicio='2026-01-01'; db.participantes[0].ativo=false;
  assert.equal((await handler(evento())).statusCode,403);
});
test('desafio: nunca lista registros de outro participante',async t=>{
  const {db}=preparar(t); db.desafios_registros.push({participante_id:crypto.randomUUID(),dia_numero:1});
  const r=await handler(evento()); assert.equal(r.statusCode,200); assert.deepEqual(dados(r).desafios,[]);
});
