// Netlify Function: salvar-participante
// Ações: cadastrar, corrigir (nome), ativar, desativar.
// 1) Aceita somente POST.
// 2) Valida o token JWT no Supabase Auth.
// 3) Confirma que o usuário está em public.gestores.
// 4) Valida a entrada e só então grava em public.participantes.
// Nunca exclui registros. A SUPABASE_SECRET_KEY é usada somente aqui, no servidor.

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
const ACOES = new Set(['cadastrar', 'corrigir', 'ativar', 'desativar']);
const TAMANHO_MAXIMO_CORPO = 2048;
const CODIGO_DUPLICADO = '23505';

class ErroBanco extends Error {
  constructor(status, codigo) {
    super(`banco respondeu ${status}`);
    this.name = 'ErroBanco';
    this.status = status;
    this.codigo = codigo;
  }
}

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

// Chamadas REST ao Supabase com a chave secreta (somente no servidor).
async function rest(config, tabela, { metodo = 'GET', parametros, corpo, retornarLinhas = false } = {}) {
  const url = new URL(`${config.url}/rest/v1/${tabela}`);
  if (parametros) {
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);
  }

  const cabecalhos = { apikey: config.chaveSecreta, Accept: 'application/json' };
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (retornarLinhas) cabecalhos.Prefer = 'return=representation';

  const r = await fetchComTimeout(url.toString(), {
    method: metodo,
    headers: cabecalhos,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined
  });

  if (!r.ok) {
    let codigo = null;
    try {
      codigo = (await r.json()).code || null;
    } catch (e) {
      codigo = null;
    }
    throw new ErroBanco(r.status, codigo);
  }
  return r.json();
}

// Confere se o usuário está cadastrado como gestor.
async function ehGestor(config, usuarioId) {
  const linhas = await rest(config, 'gestores', {
    parametros: { select: 'usuario_auth_id', usuario_auth_id: `eq.${usuarioId}`, limit: '1' }
  });
  return Array.isArray(linhas) && linhas.length === 1;
}

/* ---------- Validação e normalização ---------- */

// Chave de comparação: sem acentos, sem espaços e sem símbolos, em minúsculas.
// Ex.: "João", "joao" e "JOÃO" geram a mesma chave "joao".
function gerarChave(nome) {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}]/gu, '');
}

function validarNome(valor) {
  if (typeof valor !== 'string') return { erro: 'Informe o primeiro nome.' };
  const nome = valor.trim();
  if (nome.length < 2) return { erro: 'Informe pelo menos 2 letras.' };
  if (nome.length > 40) return { erro: 'Use no máximo 40 caracteres.' };
  if (/\s/.test(nome)) return { erro: 'Informe somente o primeiro nome.' };
  if (!/^\p{L}[\p{L}'’-]*$/u.test(nome)) {
    return { erro: 'Use apenas letras, sem números ou símbolos.' };
  }

  const formatado =
    nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1).toLocaleLowerCase('pt-BR');
  const chave = gerarChave(formatado);
  if (chave.length < 2) return { erro: 'Informe um nome válido.' };

  return { nome: formatado, chave };
}

function validarId(valor) {
  return typeof valor === 'string' && REGEX_UUID.test(valor);
}

// Aceita somente os campos esperados para cada ação. Qualquer outro campo é ignorado.
function validarEntrada(dados) {
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return { erro: 'Requisição inválida.' };
  }

  const acao = dados.acao;
  if (!ACOES.has(acao)) return { erro: 'Ação inválida.' };

  if (acao === 'cadastrar') {
    const nome = validarNome(dados.nome);
    if (nome.erro) return nome;
    return { acao, nome: nome.nome, chave: nome.chave };
  }

  if (!validarId(dados.id)) return { erro: 'Participante inválido.' };

  if (acao === 'corrigir') {
    const nome = validarNome(dados.nome);
    if (nome.erro) return nome;
    return { acao, id: dados.id, nome: nome.nome, chave: nome.chave };
  }

  return { acao, id: dados.id };
}

function lerCorpo(event) {
  const bruto = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');

  if (!bruto || Buffer.byteLength(bruto, 'utf8') > TAMANHO_MAXIMO_CORPO) {
    return { erro: 'Requisição inválida.' };
  }

  try {
    return { dados: JSON.parse(bruto) };
  } catch (e) {
    return { erro: 'Requisição inválida.' };
  }
}

/* ---------- Operações ---------- */

// Verifica se a chave já existe, ignorando opcionalmente um participante (correção).
async function chaveEmUso(config, chave, ignorarId) {
  const parametros = { select: 'id', nome_chave: `eq.${chave}`, limit: '1' };
  if (ignorarId) parametros.id = `neq.${ignorarId}`;
  const linhas = await rest(config, 'participantes', { parametros });
  return Array.isArray(linhas) && linhas.length > 0;
}

// Retorna somente os campos que o painel exibe.
function formatar(p) {
  return {
    id: String(p.id),
    nome: String(p.nome),
    ativo: p.ativo === true,
    criado_em: p.criado_em
  };
}

const DUPLICADO = { erro: 'Já existe um participante com este nome.' };

async function cadastrar(config, v) {
  if (await chaveEmUso(config, v.chave)) return resposta(409, DUPLICADO);

  const linhas = await rest(config, 'participantes', {
    metodo: 'POST',
    corpo: { nome: v.nome, nome_chave: v.chave },
    retornarLinhas: true
  });

  if (!Array.isArray(linhas) || linhas.length !== 1) {
    throw new Error('inserção sem retorno');
  }
  return resposta(201, { participante: formatar(linhas[0]) });
}

async function corrigir(config, v) {
  if (await chaveEmUso(config, v.chave, v.id)) return resposta(409, DUPLICADO);

  const linhas = await rest(config, 'participantes', {
    metodo: 'PATCH',
    parametros: { id: `eq.${v.id}` },
    corpo: { nome: v.nome, nome_chave: v.chave },
    retornarLinhas: true
  });

  if (!Array.isArray(linhas) || linhas.length === 0) {
    return resposta(404, { erro: 'Participante não encontrado.' });
  }
  return resposta(200, { participante: formatar(linhas[0]) });
}

async function alterarAtivo(config, v) {
  const linhas = await rest(config, 'participantes', {
    metodo: 'PATCH',
    parametros: { id: `eq.${v.id}` },
    corpo: { ativo: v.acao === 'ativar' },
    retornarLinhas: true
  });

  if (!Array.isArray(linhas) || linhas.length === 0) {
    return resposta(404, { erro: 'Participante não encontrado.' });
  }
  return resposta(200, { participante: formatar(linhas[0]) });
}

/* ---------- Handler ---------- */

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return resposta(405, { erro: 'Método não permitido.' });
  }

  const config = lerConfiguracao();
  if (!config) {
    console.error('salvar-participante: variáveis de ambiente ausentes ou inválidas.');
    return resposta(500, { erro: 'Configuração indisponível.' });
  }

  const token = extrairToken(event.headers);
  if (!token) {
    return resposta(401, { erro: 'Sessão ausente. Entre novamente.' });
  }

  try {
    // 1) Autenticação
    const usuarioId = await obterUsuarioId(config, token);
    if (!usuarioId) {
      return resposta(401, { erro: 'Sessão inválida ou expirada. Entre novamente.' });
    }

    // 2) Autorização: somente gestores cadastrados
    if (!(await ehGestor(config, usuarioId))) {
      return resposta(403, { erro: 'Acesso não autorizado.' });
    }

    // 3) Validação da entrada
    const corpo = lerCorpo(event);
    if (corpo.erro) return resposta(400, { erro: corpo.erro });

    const v = validarEntrada(corpo.dados);
    if (v.erro) return resposta(400, { erro: v.erro });

    // 4) Operação (sem exclusão)
    switch (v.acao) {
      case 'cadastrar':
        return await cadastrar(config, v);
      case 'corrigir':
        return await corrigir(config, v);
      case 'ativar':
      case 'desativar':
        return await alterarAtivo(config, v);
      default:
        return resposta(400, { erro: 'Ação inválida.' });
    }
  } catch (err) {
    // Duplicidade detectada pelo banco (corrida entre dois gestores)
    if (err instanceof ErroBanco && err.codigo === CODIGO_DUPLICADO) {
      return resposta(409, DUPLICADO);
    }
    // Registra apenas o tipo do erro: sem token, chave, senha ou corpo da requisição.
    console.error(`salvar-participante: falha (${err.name || 'Erro'}: ${err.message}).`);
    return resposta(500, { erro: 'Não foi possível salvar o participante.' });
  }
};