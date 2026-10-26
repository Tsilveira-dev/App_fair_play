import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { navegador, catalogo, aguardar } from './helpers/frontend.mjs';
import { preparar, evento, dados, TOKEN, UID, AGORA } from './helpers/supabase.mjs';
import { handler as checkin } from '../netlify/functions/checkin.mjs';
import { handler as desafio } from '../netlify/functions/desafio.mjs';

test('conteúdo preservado: 35 perguntas, alternativas e 28 desafios idênticos à branch recebida',()=>{
  const c=catalogo();
  const hashes={DADOS_QUESTIONARIO:'de821ea982d0814076b9f682546d3b001bbe3409aa0968855de1ac4e8e9a49c6',
    DESAFIOS_POR_DIA:'2c927514b62805fba12d2f92bc8877f7aa653fa382b80cc89593cdc190a80be7',
    CH:'bfa6782053764955d868ff1900752562fdfa66a0b9c87021bb0ac7859aec5d24'};
  for(const [k,v] of Object.entries(hashes)) assert.equal(createHash('sha256').update(JSON.stringify(c[k])).digest('hex'),v,k);
  assert.equal(c.DADOS_QUESTIONARIO.length,7);
  assert(c.DADOS_QUESTIONARIO.every(dia=>dia.length===5));
  assert.equal(c.DESAFIOS_POR_DIA.length,7);
  for(const dia of c.DESAFIOS_POR_DIA) assert.deepEqual(Object.keys(dia).sort(),['alto','baixo','mod','neutro']);
});

test('todas as alternativas existentes têm a mesma pontuação no navegador e servidor',async t=>{
  const {db}=preparar(t); const c=catalogo();
  for(let dia=1;dia<=7;dia++) {
    t.mock.timers.setTime(AGORA+(dia-1)*86400000);
    for(let p=0;p<5;p++) for(let a=0;a<c.DADOS_QUESTIONARIO[dia-1][p][1].length;a++) {
      db.checkins=[];
      const ids=c.PERGUNTAS_POR_DIA[dia-1].map((pergunta,i)=>pergunta.o[i===p?a:0].id);
      const r=await checkin(evento('POST',{respostas:ids}));
      assert.equal(r.statusCode,201,`Dia ${dia} pergunta ${p+1} alternativa ${a+1}`);
      const resposta=dados(r).checkin.respostas[p];
      const codigo=c.DADOS_QUESTIONARIO[dia-1][p][1][a][1];
      assert.equal(resposta.valor,typeof codigo==='number'?codigo:null);
      assert.equal(resposta.tipo,typeof codigo==='number'?'pontuavel':codigo==='i'?'informativa':'nao_aplicavel');
    }
  }
});

test('pontuação: apenas dados sincronizados, dez por check-in e vinte por conclusão; máximo 210',async t=>{
  const {fp}=await navegador(t);
  const dias=Object.fromEntries(Array.from({length:7},(_,i)=>[i+1,{
    checkin:{origem:'supabase'},desafios:[{origem:'supabase',status:'concluido',nivel:'baixo'}]
  }]));
  fp.configurar({dias,ativo:null},false,false); assert.equal(fp.estatisticas().pontos,0);
  fp.configurar({dias,ativo:null},true,false); assert.equal(fp.estatisticas().pontos,70);
  fp.configurar({dias,ativo:null},true,true); assert.equal(fp.estatisticas().pontos,210);
  for(const dia of Object.values(dias)) {dia.checkin.origem='local';dia.desafios[0].origem='local';}
  assert.equal(fp.estatisticas().pontos,0);
});
test('cronômetro: terminar contagem não conclui desafio nem concede pontos',async t=>{
  const {fp,window}=await navegador(t); let requisicoes=0;
  window.fetch=async()=>{requisicoes++;throw new Error('Não deveria chamar API');};
  fp.configurar({dias:{1:{checkin:null,desafios:[{origem:'supabase',nivel:'baixo',status:'aceito',rem:0,prazo:null}]}},ativo:{dia:1,idx:0}});
  fp.tick(); assert.equal(fp.estado.dias[1].desafios[0].status,'aceito');
  assert.equal(fp.estatisticas().pontos,0); assert.equal(requisicoes,0); assert.equal(fp.running,false);
  assert.equal(window.document.getElementById('finish').disabled,false);
});

test('interface e APIs: responder cinco perguntas, confirmar check-in, aceitar/concluir e restaurar registros',async t=>{
  const {db}=preparar(t);
  const {fp,window}=await navegador(t);
  const cliente={auth:{getSession:async()=>({data:{session:{access_token:TOKEN,user:{id:UID}}}})}};
  const fetchUI=async(url,opcoes={})=>{
    const handler=url==='/api/checkin'?checkin:url==='/api/desafio'?desafio:null;
    assert(handler,`Rota inesperada: ${url}`);
    const e=evento(opcoes.method||'GET',opcoes.body?JSON.parse(opcoes.body):undefined);
    const r=await handler(e);
    return {ok:r.statusCode>=200&&r.statusCode<300,status:r.statusCode,json:async()=>dados(r)};
  };
  window.fetch=fetchUI; fp.setClient(cliente); fp.configurar(); fp.renderQuiz(1);
  for(let i=0;i<5;i++) window.document.querySelector(`.opt[data-q="${i}"][data-v="0"]`).click();
  window.document.getElementById('seeResult').click();
  await aguardar(()=>fp.estado.dias[1]?.checkin?.origem==='supabase');
  assert.equal(db.checkins.length,1); assert.equal(fp.estatisticas().pontos,10);
  fp.renderChallenge(); window.document.getElementById('accept').click();
  await aguardar(()=>fp.estado.dias[1]?.desafios[0]?.status==='aceito');
  assert.equal(fp.running,false); assert.equal(fp.estatisticas().pontos,10);
  window.document.getElementById('finish').click();
  await aguardar(()=>fp.estado.dias[1]?.desafios[0]?.status==='concluido');
  assert.equal(fp.estatisticas().pontos,30); assert.equal(db.desafios_registros.length,1);
  fp.renderProgress(); assert.equal(window.document.getElementById('stPts').textContent,'30');
  const segundo=await navegador(t); segundo.window.fetch=fetchUI; segundo.fp.setClient(cliente);
  segundo.fp.configurar(undefined,false,false);
  await segundo.fp.carregarCheckinsServidor(); await segundo.fp.carregarDesafiosServidor();
  assert.equal(segundo.fp.estatisticas().pontos,30);
});

test('painel: inicializa sem travar quando falta configuração e escapa nomes na listagem',async t=>{
  const dom=new JSDOM(await readFile('public/admin.html','utf8'),{url:'https://fairplay.example.invalid',runScripts:'outside-only'});
  t.after(()=>dom.window.close()); dom.window.fetch=async()=>({ok:false,status:500});
  const s=(await readFile('public/admin.js','utf8')).replace(/^import .*;$/m,'');
  runInContext(s+`\nglobalThis.adminTeste={criarItemParticipante,criarItemSolicitacao};`,dom.getInternalVMContext());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(dom.window.document.getElementById('btn-login').disabled,true);
  assert(dom.window.document.getElementById('overlay-carregando').classList.contains('oculto'));
  const item=dom.window.adminTeste.criarItemParticipante({id:'fixture',nome:'<img src=x onerror=alert(1)>',ativo:true});
  assert.equal(item.querySelector('img'),null); assert(item.textContent.includes('<img'));
});
