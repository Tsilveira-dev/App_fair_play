import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { server } from '../scripts/dev.mjs';
import { adaptar } from '../lib/vercel-adapter.mjs';
import { preparar, TOKEN_GESTOR, PUBLICA } from './helpers/supabase.mjs';

function requisitar(port,path,method='GET',body,headers={}) {
  return new Promise((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port,path,method,headers},res=>{
      const parts=[]; res.on('data',p=>parts.push(p));
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString()}));
    }); req.on('error',reject); req.end(body);
  });
}
test('HTTP real: arquivos públicos, nove APIs, URLs legadas e isolamento de arquivos',async t=>{
  preparar(t); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve))); const {port}=server.address();
  for(const [path,text] of [['/','Fair Play'],['/admin.html','gestor'],['/script.js','DADOS_QUESTIONARIO'],['/style.css','{']]) {
    const r=await requisitar(port,path); assert.equal(r.status,200,path); assert(r.body.includes(text),path);
  }
  for(const path of ['/.env.local','/../package.json','/netlify/lib/ambiente.mjs','/supabase/migrations/001_schema.sql']) {
    assert.equal((await requisitar(port,path)).status,404,path);
  }
  for(const prefixo of ['/api/','/.netlify/functions/']) {
    const r=await requisitar(port,prefixo+'config-public'); assert.equal(r.status,200);
    assert.equal(JSON.parse(r.body).supabasePublishableKey,PUBLICA); assert.equal(r.headers['cache-control'],'no-store');
    for(const nome of ['solicitar-acesso','consultar-acesso','verificar-gestor','listar-participantes','salvar-participante','gerenciar-acesso','checkin','desafio']) {
      assert.equal((await requisitar(port,prefixo+nome,'DELETE')).status,405,nome);
    }
  }
  const filtro=await requisitar(port,'/api/gerenciar-acesso?status=incorreto','GET',undefined,{authorization:`Bearer ${TOKEN_GESTOR}`});
  assert.equal(filtro.status,400);
  const enorme=await requisitar(port,'/api/checkin','POST','x'.repeat(5000)); assert.equal(enorme.status,413);
  assert.equal((await requisitar(port,'/api/inexistente')).status,404);
});

test('adaptador Vercel: req.body objeto, Buffer, texto e stream preservam contrato',async()=>{
  for(const body of [{acao:'aceitar'},Buffer.from('{"acao":"aceitar"}'),'{"acao":"aceitar"}',undefined]) {
    const req=Readable.from(body===undefined?['{"acao":"aceitar"}']:[]);
    Object.assign(req,{body,url:'/api/desafio?status=pendente',method:'POST',headers:{Authorization:'Bearer fixture-token'}});
    const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};
    await adaptar(async event=>{
      assert.deepEqual(JSON.parse(event.body),{acao:'aceitar'});
      assert.equal(event.headers.authorization,'Bearer fixture-token');
      assert.equal(event.queryStringParameters.status,'pendente');
      return {statusCode:201,headers:{'Retry-After':'30'},body:'{"ok":true}'};
    })(req,res);
    assert.equal(res.statusCode,201); assert.equal(res.headers['Retry-After'],'30');
  }
});
test('adaptador: exceção não revela informações internas',async()=>{
  const req=Readable.from([]); Object.assign(req,{url:'/api/checkin',method:'GET',headers:{}});
  const res={setHeader(){},end(body){this.body=body;}};
  await adaptar(()=>{throw new Error('credencial privada');})(req,res);
  assert.equal(res.statusCode,500); assert(!res.body.includes('credencial'));
});
