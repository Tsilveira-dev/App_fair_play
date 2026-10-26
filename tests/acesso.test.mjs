import test from 'node:test';
import assert from 'node:assert/strict';
import { lerAmbienteSupabase } from '../netlify/lib/ambiente.mjs';
import { preparar, evento, dados, TOKEN, TOKEN_GESTOR, GESTOR, UID, SESSAO, PUBLICA, SECRETA, URL_TESTE, AGORA } from './helpers/supabase.mjs';
const nomes=['config-public','solicitar-acesso','consultar-acesso','verificar-gestor','listar-participantes','salvar-participante','gerenciar-acesso','checkin','desafio'];
const funcoes=Object.fromEntries(await Promise.all(nomes.map(async n=>[n,(await import(`../netlify/functions/${n}.mjs`)).handler])));

test('ambientes: TESTE fixo, ORIGINAL explícito e diferente; preview nunca usa ORIGINAL',()=>{
  assert.equal(lerAmbienteSupabase({}).erro,'ambiente_invalido');
  assert.equal(lerAmbienteSupabase({AMBIENTE:'teste',SUPABASE_URL:URL_TESTE}).ambiente,'teste');
  assert(lerAmbienteSupabase({AMBIENTE:'teste',SUPABASE_URL:'https://outro.supabase.co'}).erro);
  assert(lerAmbienteSupabase({AMBIENTE:'original',SUPABASE_URL:URL_TESTE,SUPABASE_ORIGINAL_URL_ESPERADA:URL_TESTE}).erro);
  const env={AMBIENTE:'original',SUPABASE_URL:'https://swbwbkslcotoecjlbqxe.supabase.co',SUPABASE_ORIGINAL_URL_ESPERADA:'https://swbwbkslcotoecjlbqxe.supabase.co'};
  assert.equal(lerAmbienteSupabase(env).ambiente,'original');
  assert(lerAmbienteSupabase({...env,SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',SUPABASE_ORIGINAL_URL_ESPERADA:'https://abcdefghijklmnopqrst.supabase.co'}).erro);
  assert(lerAmbienteSupabase({...env,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'teste-supabase'}).erro);
  assert(lerAmbienteSupabase({...env,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'teste-supabase'}).erro);
  assert.equal(lerAmbienteSupabase({...env,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main'}).ambiente,'original');
  assert(lerAmbienteSupabase({AMBIENTE:'teste',SUPABASE_URL:URL_TESTE,VERCEL_GIT_COMMIT_REF:'main'}).erro);
});

test('config pública: retorna somente ambiente, URL e chave publicável',async t=>{
  preparar(t); const r=await funcoes['config-public'](evento());
  assert.equal(r.statusCode,200); assert.deepEqual(dados(r),{ambiente:'teste',supabaseUrl:URL_TESTE,supabasePublishableKey:PUBLICA});
  assert(!r.body.includes(SECRETA)); assert.equal(r.headers['Cache-Control'],'no-store');
});
for(const valor of [SECRETA,`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.assinatura`]) {
  test('config pública: jamais publica chave secreta ou JWT service_role',async t=>{
    preparar(t); process.env.SUPABASE_PUBLISHABLE_KEY=valor;
    const r=await funcoes['config-public'](evento()); assert.equal(r.statusCode,500); assert(!r.body.includes(valor));
  });
}
for(const nome of nomes.filter(n=>n!=='config-public')) {
  test(`${nome}: rejeita falta de autenticação`,async t=>{
    preparar(t);
    const method=['listar-participantes','gerenciar-acesso','checkin','desafio'].includes(nome)?'GET':'POST';
    const r=await funcoes[nome](evento(method,undefined,null)); assert.equal(r.statusCode,401);
  });
}
for(const nome of ['verificar-gestor','listar-participantes','salvar-participante','gerenciar-acesso']) {
  test(`${nome}: estudante nunca vira gestor, mesmo com cadastro acidental`,async t=>{
    const {db,chamadas}=preparar(t); db.gestores.push({usuario_auth_id:UID});
    const method=['listar-participantes','gerenciar-acesso'].includes(nome)?'GET':'POST';
    const r=await funcoes[nome](evento(method,{acao:'cadastrar',nome:'Exemplo'},TOKEN));
    assert([401,403].includes(r.statusCode));
    assert(!chamadas.some(c=>c.url.pathname.endsWith('/gestores')),'Rejeição antes da consulta de gestores');
  });
  test(`${nome}: e-mail autenticado sem cadastro não é gestor`,async t=>{
    const {db}=preparar(t); db.gestores=[];
    const method=['listar-participantes','gerenciar-acesso'].includes(nome)?'GET':'POST';
    const r=await funcoes[nome](evento(method,undefined,TOKEN_GESTOR)); assert.equal(r.statusCode,403);
  });
}
test('gestor: e-mail autenticado e cadastrado acessa painel',async t=>{
  preparar(t); const r=await funcoes['verificar-gestor'](evento('POST',undefined,TOKEN_GESTOR));
  assert.equal(r.statusCode,200); assert.equal(dados(r).autorizado,true);
});
test('solicitação: normaliza primeiro nome e cria apenas sessão pendente',async t=>{
  const {db}=preparar(t); db.sessoes_participantes=[];
  const r=await funcoes['solicitar-acesso'](evento('POST',{nome:'EXEMPLO',tipo_dispositivo:'individual',status:'aprovada'}));
  assert.equal(r.statusCode,202); assert.equal(db.sessoes_participantes[0].status,'pendente');
  assert.equal(db.sessoes_participantes[0].usuario_auth_id,UID);
});
test('solicitação: nome inexistente retorna mesma resposta sem criar cadastro',async t=>{
  const {db}=preparar(t); db.sessoes_participantes=[];
  const r=await funcoes['solicitar-acesso'](evento('POST',{nome:'Inexistente',tipo_dispositivo:'individual'}));
  assert.equal(r.statusCode,202); assert.equal(db.sessoes_participantes.length,0); assert.equal(db.participantes.length,1);
});
test('solicitação: não troca vínculo de UID existente',async t=>{
  const {db}=preparar(t); const anterior=db.sessoes_participantes[0].participante_id;
  db.participantes.push({id:crypto.randomUUID(),nome:'Outro',nome_chave:'outro',ativo:true});
  assert.equal((await funcoes['solicitar-acesso'](evento('POST',{nome:'Outro',tipo_dispositivo:'individual'}))).statusCode,202);
  assert.equal(db.sessoes_participantes[0].participante_id,anterior);
});
test('solicitação: RPC limita tentativas e devolve Retry-After',async t=>{
  preparar(t,{limite:{bloqueado:true,espera:30,motivo:'intervalo'}});
  const r=await funcoes['solicitar-acesso'](evento('POST',{nome:'Exemplo',tipo_dispositivo:'individual'}));
  assert.equal(r.statusCode,429); assert.equal(r.headers['Retry-After'],'30');
});
for (const nome of ['Nome Sobrenome','<script>','a','1234']) {
  test(`solicitação: recusa nome inválido ${nome}`,async t=>{
    const {chamadas}=preparar(t);
    assert.equal((await funcoes['solicitar-acesso'](evento('POST',{nome,tipo_dispositivo:'individual'}))).statusCode,400);
    assert.equal(chamadas.length,0);
  });
}
test('consulta: aprovação é necessária e revogação bloqueia imediatamente',async t=>{
  const {db}=preparar(t); db.sessoes_participantes[0].status='pendente';
  let r=await funcoes['consultar-acesso'](evento('POST')); assert.equal(dados(r).pode_entrar,false);
  db.sessoes_participantes[0].status='aprovada'; r=await funcoes['consultar-acesso'](evento('POST'));
  assert.equal(dados(r).pode_entrar,true); assert.equal(dados(r).coleta_liberada,true);
  db.sessoes_participantes[0].status='revogada'; r=await funcoes['consultar-acesso'](evento('POST'));
  assert.equal(dados(r).pode_entrar,false); assert(!r.body.includes(UID));
});
test('consulta: antes do início permite explorar, sem gravar check-ins',async t=>{
  preparar(t); t.mock.timers.setTime(AGORA-86400000);
  const r=await funcoes['consultar-acesso'](evento('POST'));
  assert.equal(dados(r).pode_entrar,true); assert.equal(dados(r).coleta_liberada,false);
});
test('gestor: aprovação exige pendente e retorna sessão sem UID',async t=>{
  const {db}=preparar(t); db.sessoes_participantes[0].status='pendente';
  const r=await funcoes['gerenciar-acesso'](evento('POST',{acao:'aprovar',sessao_id:SESSAO},TOKEN_GESTOR));
  assert.equal(r.statusCode,200); assert.equal(db.sessoes_participantes[0].status,'aprovada');
  assert(!r.body.includes(UID)); assert(!r.body.includes(SECRETA));
  assert.equal((await funcoes['gerenciar-acesso'](evento('POST',{acao:'aprovar',sessao_id:SESSAO},TOKEN_GESTOR))).statusCode,409);
});
test('gestor: revoga sem excluir histórico e lista por filtro',async t=>{
  const {db}=preparar(t);
  assert.equal((await funcoes['gerenciar-acesso'](evento('POST',{acao:'revogar',sessao_id:SESSAO},TOKEN_GESTOR))).statusCode,200);
  assert.equal(db.sessoes_participantes.length,1);
  const r=await funcoes['gerenciar-acesso'](evento('GET',undefined,TOKEN_GESTOR,{status:'revogada'}));
  assert.equal(dados(r).sessoes.length,1); assert(!r.body.includes(UID));
});


test('Netlify: previews e branch deploys nunca podem usar ORIGINAL',()=>{
  const original={AMBIENTE:'original',SUPABASE_URL:'https://swbwbkslcotoecjlbqxe.supabase.co',
    SUPABASE_ORIGINAL_URL_ESPERADA:'https://swbwbkslcotoecjlbqxe.supabase.co',NETLIFY:'true'};
  assert(lerAmbienteSupabase({...original,CONTEXT:'deploy-preview',HEAD:'teste-supabase',BRANCH:'main'}).erro);
  assert(lerAmbienteSupabase({...original,CONTEXT:'branch-deploy',HEAD:'teste-supabase'}).erro);
  assert(lerAmbienteSupabase({...original,CONTEXT:'production',HEAD:'teste-supabase'}).erro);
  assert.equal(lerAmbienteSupabase({...original,CONTEXT:'production',HEAD:'main'}).ambiente,'original');
});
test('Netlify: contexto de TESTE usa apenas seu banco e sua branch',()=>{
  const teste={AMBIENTE:'teste',SUPABASE_URL:URL_TESTE,NETLIFY:'true',CONTEXT:'deploy-preview'};
  assert.equal(lerAmbienteSupabase({...teste,HEAD:'teste-supabase',BRANCH:'main'}).ambiente,'teste');
  assert(lerAmbienteSupabase({...teste,HEAD:'main'}).erro);
});
