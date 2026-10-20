// Netlify Function: verificar-gestor
// 1) Valida o token do usuário no Supabase Auth.
// 2) Confirma se o usuário existe na tabela public.gestores.
// A SUPABASE_SECRET_KEY é usada somente aqui, no servidor, e nunca é devolvida.

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: CABECALHOS,
  body: JSON.stringify(corpo)
});

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;

function extrairToken(headers = {}) {
  const cabecalho = (headers.authorization || headers.Authorization || '').trim();
  const partes = cabecalho.split(/\s+/);
  if (partes.length !== 2 || partes[0] !== 'Bearer') return null;
  if (!REGEX_TOKEN.test(partes[1]) || partes[1].length > 4096) return null;
  return partes[1];
}

async function fetchComTimeout(url, opcoes, ms = 5000) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { ...opcoes, signal: controle.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return resposta(405, { erro: 'Método não permitido.' });
  }

  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chavePublicavel = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const chaveSecreta = (process.env.SUPABASE_SECRET_KEY || '').trim();

  if (!/^https:\/\/[^\s/]+$/.test(url) || !chavePublicavel || !chaveSecreta) {
    console.error('verificar-gestor: variáveis de ambiente ausentes ou inválidas.');
    return resposta(500, { erro: 'Configuração indisponível.' });
  }

  const token = extrairToken(event.headers);
  if (!token) {
    return resposta(401, { erro: 'Sessão ausente. Entre novamente.' });
  }

  // 1) Identifica o usuário a partir do token (Supabase Auth).
  let usuarioId;
  try {
    const r = await fetchComTimeout(`${url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: chavePublicavel,
        Authorization: `Bearer ${token}`
      }
    });

    if (r.status === 401 || r.status === 403) {
      return resposta(401, { erro: 'Sessão inválida ou expirada. Entre novamente.' });
    }
    if (!r.ok) {
      console.error(`verificar-gestor: auth respondeu ${r.status}.`);
      return resposta(500, { erro: 'Não foi possível verificar o acesso.' });
    }

    const usuario = await r.json();
    usuarioId = usuario && usuario.id;
  } catch (err) {
    console.error(`verificar-gestor: falha ao validar token (${err.name}).`);
    return resposta(500, { erro: 'Não foi possível verificar o acesso.' });
  }

  if (!usuarioId || !REGEX_UUID.test(usuarioId)) {
    return resposta(401, { erro: 'Sessão inválida ou expirada. Entre novamente.' });
  }

  // 2) Confere se o usuário está cadastrado como gestor.
  //    A consulta usa a chave secreta no servidor. A tabela gestores não tem acesso
  //    direto para anon/authenticated, então esta é a única forma de leitura.
  try {
    const consulta = new URL(`${url}/rest/v1/gestores`);
    consulta.searchParams.set('select', 'usuario_auth_id');
    consulta.searchParams.set('usuario_auth_id', `eq.${usuarioId}`);
    consulta.searchParams.set('limit', '1');

    const r = await fetchComTimeout(consulta.toString(), {
      method: 'GET',
      headers: {
        apikey: chaveSecreta,
        Accept: 'application/json'
      }
    });

    if (!r.ok) {
      console.error(`verificar-gestor: consulta a gestores respondeu ${r.status}.`);
      return resposta(500, { erro: 'Não foi possível verificar o acesso.' });
    }

    const linhas = await r.json();
    if (!Array.isArray(linhas) || linhas.length !== 1) {
      return resposta(403, { erro: 'Acesso não autorizado.' });
    }
  } catch (err) {
    console.error(`verificar-gestor: falha ao consultar gestores (${err.name}).`);
    return resposta(500, { erro: 'Não foi possível verificar o acesso.' });
  }

  // 3) Autorizado. Retorna somente a confirmação, sem dados do usuário.
  return resposta(200, { autorizado: true });
};