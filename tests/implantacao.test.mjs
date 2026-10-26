import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { verificarAmbienteLocal } from '../scripts/verificar-ambiente.mjs';
import { verificarDeploy } from '../scripts/verificar-deploy.mjs';

const urlTeste='https://jzxltkjxdefuptutpkfx.supabase.co';
const configurado={AMBIENTE:'teste',SUPABASE_URL:urlTeste,
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SECRET_KEY:'sb_secret_fixture'};

test('preparação local: credenciais ausentes impedem início pelo VS Code',()=>{
  const erros=verificarAmbienteLocal({});
  assert(erros.some(e=>e.includes('AMBIENTE/SUPABASE_URL')));
  assert(erros.some(e=>e.includes('SUPABASE_PUBLISHABLE_KEY')));
  assert(erros.some(e=>e.includes('SUPABASE_SECRET_KEY')));
});
test('preparação local: configuração de TESTE preenchida é aceita sem consultar banco',()=>{
  assert.deepEqual(verificarAmbienteLocal(configurado),[]);
});
test('preparação local: ORIGINAL e chave secreta no campo público são recusados sem imprimir valores',()=>{
  const erros=verificarAmbienteLocal({...configurado,AMBIENTE:'original',
    SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_ORIGINAL_URL_ESPERADA:'https://abcdefghijklmnopqrst.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:configurado.SUPABASE_SECRET_KEY});
  assert(erros.some(e=>e.includes('AMBIENTE/SUPABASE_URL')));
  assert(erros.some(e=>e.includes('SUPABASE_PUBLISHABLE_KEY')));
  assert(!erros.join('\n').includes(configurado.SUPABASE_SECRET_KEY));
});

async function servidor(t,url=urlTeste) {
  const caminhos=[];
  const http=createServer((req,res)=>{
    caminhos.push(req.url);
    assert(!req.headers.authorization,'A conferência não envia credenciais');
    res.setHeader('Cache-Control','no-store');
    if(['/','/admin.html'].includes(req.url)) {
      res.setHeader('Content-Type','text/html'); res.end('<html>Fair Play</html>'); return;
    }
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/config-public') {
      res.end(JSON.stringify({ambiente:'teste',supabaseUrl:url,supabasePublishableKey:'sb_publishable_fixture'})); return;
    }
    res.statusCode=401;res.end(JSON.stringify({erro:'Sessão ausente.'}));
  });
  http.listen(0,'127.0.0.1'); await once(http,'listening');
  t.after(()=>new Promise(resolve=>http.close(resolve)));
  return {url:`http://127.0.0.1:${http.address().port}`,caminhos};
}
test('conferência do deploy: páginas, configuração TESTE e autenticação são exercitadas por HTTP',async t=>{
  const http=await servidor(t);
  const resultado=await verificarDeploy(http.url);
  assert.equal(resultado.length,4);
  assert.deepEqual(http.caminhos,['/','/admin.html','/api/config-public','/api/checkin']);
  assert(resultado.every(r=>!r.includes('sb_')));
});
test('conferência do deploy: banco diferente interrompe validação antes de acessar check-ins',async t=>{
  const http=await servidor(t,'https://abcdefghijklmnopqrst.supabase.co');
  await assert.rejects(verificarDeploy(http.url),/outro banco/);
  assert(!http.caminhos.includes('/api/checkin'));
});
