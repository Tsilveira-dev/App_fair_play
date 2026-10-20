// Netlify Function: listar-participantes
// 1) Aceita somente GET.
// 2) Valida o token JWT no Supabase Auth.
// 3) Confirma que o usuário está em public.gestores.
// 4) Só então consulta public.participantes, retornando apenas id, nome, ativo e criado_em.
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
const LIMITE_PARTICIPANTES = 500;

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

function lerConfiguracao() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chavePublicavel = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const chaveSecreta = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!/^https:\/\/[^\s/]+$/.test(url) || !chavePublicavel || !chaveSecreta) return null;
  return { url, chavePublicavel, chaveSecreta };
}

// Retorna o ID do usuário autenticado, ou null se o token for inválido.
async function obterUsuarioId(config, token) {
  const r = await fetchComTimeout(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.chavePublicavel,
      Authorization: `Bearer ${token}`
    }
  });

  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw new Error(`auth respondeu ${r.status}`);

  const usuario = await r.json();
  const id = usuario && usuario.id;
  return REGEX_UUID.test(id || '') ? id : null;
}

// Confere se o usuário está cadastrado como gestor.
async function ehGestor(config, usuarioId) {
  const consulta = new URL(`${config.url}/rest/v1/gestores`);
  consulta.searchParams.set('select', 'usuario_auth_id');
  consulta.searchParams.set('usuario_auth_id', `eq.${usuarioId}`);
  consulta.searchParams.set('limit', '1');

  const r = await fetchComTimeout(consulta.toString(), {
    method: 'GET',
    headers: { apikey: config.chaveSecreta, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`gestores respondeu ${r.status}`);

  const linhas = await r.json();
  return Array.isArray(linhas) && linhas.length === 1;
}

// Lista participantes, somente com as colunas do painel.
async function listarParticipantes(config) {
  const consulta = new URL(`${config.url}/rest/v1/participantes`);
  consulta.searchParams.set('select', 'id,nome,ativo,criado_em');
  consulta.searchParams.set('order', 'nome.asc');
  consulta.searchParams.set('limit', String(LIMITE_PARTICIPANTES));

  const r = await fetchComTimeout(consulta.toString(), {
    method: 'GET',
    headers: { apikey: config.chaveSecreta, Accept: 'application/json' }
  });
  if (!r.ok) throw new Error(`participantes respondeu ${r.status}`);

  const linhas = await r.json();
  if (!Array.isArray(linhas)) throw new Error('resposta inesperada de participantes');

  return linhas.map(p => ({
    id: String(p.id),
    nome: String(p.nome),
    ativo: p.ativo === true,
    criado_em: p.criado_em
  }));
}

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return resposta(405, { erro: 'Método não permitido.' });
  }

  const config = lerConfiguracao();
  if (!config) {
    console.error('listar-participantes: variáveis de ambiente ausentes ou inválidas.');
    return resposta(500, { erro: 'Configuração indisponível.' });
  }

  const token = extrairToken(event.headers);
  if (!token) {
    return resposta(401, { erro: 'Sessão ausente. Entre novamente.' });
  }

  try {
    // Autenticação
    const usuarioId = await obterUsuarioId(config, token);
    if (!usuarioId) {
      return resposta(401, { erro: 'Sessão inválida ou expirada. Entre novamente.' });
    }

    // Autorização: somente gestores cadastrados
    if (!(await ehGestor(config, usuarioId))) {
      return resposta(403, { erro: 'Acesso não autorizado.' });
    }

    // Consulta somente após autorização
    const participantes = await listarParticipantes(config);
    return resposta(200, { participantes });
  } catch (err) {
    // Registra apenas o tipo do erro: sem token, chave, senha ou corpo da resposta.
    console.error(`listar-participantes: falha (${err.name || 'Erro'}: ${err.message}).`);
    return resposta(500, { erro: 'Não foi possível carregar os participantes.' });
  }
};