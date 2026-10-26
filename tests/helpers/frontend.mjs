import { readFile } from 'node:fs/promises';
import { runInContext, runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
export const source=await readFile('public/script.js','utf8');
export function catalogo() {
  return runInNewContext(source.slice(source.indexOf('const DADOS_QUESTIONARIO'),source.indexOf('const C ='))+
    '; ({DADOS_QUESTIONARIO,DESAFIOS_POR_DIA,CH,PERGUNTAS_POR_DIA});');
}
export async function navegador(t) {
  const dom=new JSDOM(await readFile('public/index.html','utf8'),{url:'https://fairplay.example.invalid',runScripts:'outside-only',pretendToBeVisual:true});
  t.after(()=>dom.window.close());
  dom.window.scrollTo=()=>{};
  dom.window.fetch=async()=>({ok:false,status:500,json:async()=>({})});
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  runInContext(source+`\n;globalThis.fp={
    catalogo:DADOS_QUESTIONARIO,desafios:DESAFIOS_POR_DIA,
    estatisticas,tick,startTimer,renderProgress,renderChallenge,renderQuiz,
    carregarCheckinsServidor,carregarDesafiosServidor,
    get estado(){return S;}, get running(){return running;},
    setClient(cliente){supa=cliente;},
    configurar(s={dias:{},ativo:null,rascunho:null},ci=true,di=true){
      S=s;checkinsSincronizados=ci;desafiosSincronizados=di;uidAtual='11111111-1111-4111-8111-111111111111';
      acesso={pode_entrar:true,coleta_liberada:true,periodo:{inicio:hojeFortaleza()+'T00:00:00-03:00'}};
      acessoConfirmado=true;telaAtual='app';
    }
  };`,dom.getInternalVMContext());
  await new Promise(resolve=>setImmediate(resolve));
  return {dom,window:dom.window,fp:dom.window.fp};
}
export async function aguardar(condicao) {
  for(let i=0;i<100;i++) {
    if(condicao()) return;
    await new Promise(resolve=>setTimeout(resolve,5));
  }
  throw new Error('A interface não confirmou o resultado esperado');
}
