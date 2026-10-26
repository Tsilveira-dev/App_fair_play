import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chavePublicavelValida } from '../netlify/lib/seguranca.mjs';

export async function verificarDeploy(endereco, requisitar = fetch) {
  let base;
  try { base = new URL(endereco); } catch { throw new Error('Informe a URL HTTPS do deploy de TESTE.'); }
  const local = ['127.0.0.1','localhost','[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))) {
    throw new Error('Use a URL raiz HTTPS do deploy, sem credenciais, parâmetros ou caminho.');
  }
  const resultado = [];
  const obter = async caminho => {
    const r = await requisitar(new URL(caminho, base), {
      redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' }
    });
    resultado.push(`${caminho}: HTTP ${r.status}`);
    return r;
  };
  for (const pagina of ['/','/admin.html']) {
    const r = await obter(pagina);
    assert.equal(r.status, 200, `${pagina} indisponível: confira o domínio e a proteção de acesso da Vercel.`);
    assert.match(r.headers.get('content-type') || '', /text\/html/i, `${pagina} não retornou uma página HTML.`);
    const html = await r.text();
    assert(html.includes('Fair Play'), `${pagina} não parece ser uma página do Fair Play.`);
  }
  const config = await obter('/api/config-public');
  assert.equal(config.status, 200, 'Configuração indisponível: confira branch e variáveis de TESTE e faça Redeploy.');
  const dados = await config.json();
  assert.deepEqual(Object.keys(dados).sort(), ['ambiente','supabasePublishableKey','supabaseUrl']);
  assert.equal(dados.ambiente, 'teste', 'O endereço não é do ambiente TESTE.');
  assert.equal(dados.supabaseUrl, 'https://jzxltkjxdefuptutpkfx.supabase.co', 'O deploy aponta para outro banco.');
  assert(chavePublicavelValida(dados.supabasePublishableKey), 'Configuração pública inválida.');
  assert.equal(config.headers.get('cache-control'), 'no-store', 'A configuração pública não deve ser armazenada em cache.');
  const acesso = await obter('/api/checkin');
  assert.equal(acesso.status, 401, 'A API de check-in deve rejeitar chamadas sem autenticação.');
  return resultado;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const linhas = await verificarDeploy(process.argv[2]);
    console.log(linhas.join('\n'));
    console.log('Páginas, configuração TESTE e bloqueio sem autenticação conferidos. Login e persistência real ainda exigem o teste com a equipe.');
  } catch (erro) {
    // AssertionError pode conter valores da resposta; mostrar apenas a mensagem controlada.
    console.error('Deploy de TESTE não validado. Confira domínio, branch, variáveis e proteção de acesso.');
    process.exitCode = 1;
  }
}
