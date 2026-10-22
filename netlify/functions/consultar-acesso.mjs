// Netlify Function: consultar-acesso
// Informa ao estudante, somente sobre a própria sessão, se pode entrar no app
// e se os check-ins estão liberados. Não grava nada no banco.
//
// Regras:
// - O UID vem somente do token validado pelo Supabase Auth.
// - Só consulta a sessão desse UID. Nunca aceita nome, UID ou ID enviados pelo navegador.
// - 'expirada' é calculado a partir de expira_em. O status gravado não é alterado.
// - pode_entrar e coleta_liberada são decisões separadas:
//     pode_entrar: aprovada, não expirada, participante ativo, período configurado e não encerrado.
//     coleta_liberada: pode_entrar e data atual entre o início (Dia 1) e o fim (Dia 8, 23:59:59).
// - Sem configuração válida, pode_entrar e coleta_liberada são sempre false.
// - A SUPABASE_SECRET_KEY é usada somente aqui, no servidor, e nunca é devolvida.

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const resposta = (statusCode, corpo, extras = {}) => ({
  statusCode,
  headers: { ...CABECALHOS, ...extras },
  body: corpo === undefined ? '' : JSON.stringify(corpo)
});

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Dia 1 = data_inicio. Dia 8 = data_inicio + 7, reservado para recuperar o check-in do Dia 7.
const DIAS_ATE_FIM_DA_COLETA = 7;

const STATUS_GRAVADOS = new Set(['pendente', 'aprovada', 'recusada', 'revogada']);

const MSG = {
  metodo: 'Método não permitido.',
  configuracao: 'Configuração indisponível.',
  sessaoAusente: 'Sessão ausente. Recarregue a página e tente novamente.',
  sessaoInvalida: 'Sessão inválida ou expirada. Recarregue a página e tente novamente.',
  naoAnonima: 'Sessão inválida para consultar o acesso. Recarregue a página e tente novamente.',
  erroGenerico: 'Não foi possível verificar seu acesso. Tente novamente.',
  semSolicitacao: 'Ainda não há solicitação para este dispositivo. Informe seu nome para solicitar acesso.',
  aguardando: 'Solicitação enviada. Aguarde a autorização da equipe.',
  recusada: 'Sua solicitação não foi aceita. Procure a equipe.',
  revogada: 'Seu acesso foi encerrado. Procure a equipe.',
  expirada: 'Seu acesso expirou. Procure a equipe.',
  participanteInativo: 'Seu cadastro não está disponível. Procure a equipe.',
  periodoNaoConfigurado: 'O período do teste ainda não foi definido. Aguarde a equipe.',
  periodoEncerrado: 'O período do teste foi encerrado.',
  aprovadaAntesDoInicio: 'Acesso liberado. Os check-ins ainda não começaram.',
  aprovadaEmColeta: 'Acesso liberado. Você já pode fazer os check-ins de hoje.'
};

class ErroBanco extends Error {
  constructor(status) {
    super(`banco respondeu ${status}`);
    this.name = 'ErroBanco';
    this.status = status;
  }
}

/* ---------- Configuração e rede ---------- */

function lerConfiguracao() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const chavePublicavel = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  const chaveSecreta = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!/^https:\/\/[^\s/]+$/.test(url) || !chavePublicavel || !chaveSecreta) return null;
  return { url, chavePublicavel, chaveSecreta };
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

// Usuário autenticado pelo token, ou null se o token for inválido.
async function obterUsuario(config, token) {
  const r = await fetchComTimeout(`${config.url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: config.chavePublicavel,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
  if (r.status === 401 || r.status === 403) return null;
  if (!r.ok) throw new Error(`auth respondeu ${r.status}`);

  const usuario = await r.json();
  return usuario && REGEX_UUID.test(usuario.id || '') ? usuario : null;
}

function ehIdentidadeAnonima(usuario) {
  return usuario.is_anonymous === true
    || (usuario.app_metadata && usuario.app_metadata.provider === 'anonymous');
}

// Leitura REST com a chave secreta (somente no servidor).
// Erros não incluem o corpo da resposta do banco.
async function lerTabela(config, tabela, parametros) {
  const url = new URL(`${config.url}/rest/v1/${tabela}`);
  for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);

  const r = await fetchComTimeout(url.toString(), {
    method: 'GET',
    headers: { apikey: config.chaveSecreta, Accept: 'application/json' }
  });
  if (!r.ok) throw new ErroBanco(r.status);

  const texto = await r.text();
  if (!texto) return [];
  try {
    const dados = JSON.parse(texto);
    return Array.isArray(dados) ? dados : [];
  } catch (e) {
    return [];
  }
}

/* ---------- Período oficial ---------- */

// Início: 00:00 do data_inicio. Fim: 23:59:59 do Dia 8. Fuso fixo UTC-3 (sem horário de verão).
// Retorna null se a data for ausente ou inválida.
function calcularPeriodo(dataInicio) {
  if (typeof dataInicio !== 'string' || !REGEX_DATA.test(dataInicio)) return null;

  const base = new Date(`${dataInicio}T00:00:00Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 10) !== dataInicio) return null;

  const diaFim = new Date(base);
  diaFim.setUTCDate(diaFim.getUTCDate() + DIAS_ATE_FIM_DA_COLETA);
  const dataFim = diaFim.toISOString().slice(0, 10);

  return {
    inicio: new Date(`${dataInicio}T00:00:00-03:00`),
    fim: new Date(`${dataFim}T23:59:59-03:00`)
  };
}

// Retorna o período somente se a configuração estiver ativa e válida. Caso contrário, null.
async function lerPeriodo(config) {
  const linhas = await lerTabela(config, 'configuracao_teste', {
    select: 'data_inicio,ativo',
    id: 'eq.1',
    limit: '1'
  });
  const configuracao = linhas[0];
  if (!configuracao || configuracao.ativo !== true) return null;
  return calcularPeriodo(configuracao.data_inicio);
}

function faseDoPeriodo(periodo, agora) {
  if (!periodo) return 'nao_configurado';
  if (agora < periodo.inicio) return 'antes_do_inicio';
  if (agora <= periodo.fim) return 'coleta';
  return 'encerrado';
}

/* ---------- Sessão e participante do próprio UID ---------- */

async function lerSessao(config, uid) {
  const linhas = await lerTabela(config, 'sessoes_participantes', {
    select: 'participante_id,status,expira_em',
    usuario_auth_id: `eq.${uid}`,
    limit: '1'
  });
  return linhas[0] || null;
}

async function lerParticipante(config, participanteId) {
  const linhas = await lerTabela(config, 'participantes', {
    select: 'nome,ativo',
    id: `eq.${participanteId}`,
    limit: '1'
  });
  return linhas[0] || null;
}

// Status efetivo: 'aprovada' sem validade futura (ou sem expira_em) vira 'expirada'.
// Falha fechada: expira_em ausente ou inválido também conta como expirado.
function statusEfetivo(sessao, agora) {
  if (sessao.status === 'aprovada') {
    const expira = Date.parse(sessao.expira_em);
    if (Number.isNaN(expira) || expira <= agora.getTime()) return 'expirada';
  }
  return sessao.status;
}

/* ---------- Decisão de acesso ---------- */

function decidirAcesso({ sessao, participante, periodo, agora }) {
  const fase = faseDoPeriodo(periodo, agora);
  const periodoResumo = periodo
    ? { inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() }
    : null;

  const negado = (status, motivo, nome = null) => ({
    status, motivo, pode_entrar: false, coleta_liberada: false, fase, periodo: periodoResumo, nome
  });

  if (!sessao) {
    return negado('sem_solicitacao', 'sem_solicitacao');
  }

  const status = STATUS_GRAVADOS.has(sessao.status) ? statusEfetivo(sessao, agora) : null;
  if (!status) {
    console.error('consultar-acesso: status desconhecido encontrado.');
    return negado('indisponivel', 'erro_interno');
  }

  // Participante inativo bloqueia qualquer status, sem revelar o nome.
  if (!participante || participante.ativo !== true) {
    return negado(status, 'participante_inativo');
  }

  const nome = participante.nome;

  switch (status) {
    case 'pendente':
      return negado(status, 'aguardando_autorizacao', nome);
    case 'recusada':
      return negado(status, 'recusada', nome);
    case 'revogada':
      return negado(status, 'revogada', nome);
    case 'expirada':
      return negado(status, 'expirada', nome);
    case 'aprovada':
      break;
    default:
      return negado('indisponivel', 'erro_interno');
  }

  // Aprovada e não expirada: a configuração precisa estar válida e o período não pode ter terminado.
  if (fase === 'nao_configurado') {
    return negado(status, 'periodo_nao_configurado', nome);
  }
  if (fase === 'encerrado') {
    return negado(status, 'periodo_encerrado', nome);
  }

  return {
    status,
    motivo: null,
    pode_entrar: true,
    coleta_liberada: fase === 'coleta',
    fase,
    periodo: periodoResumo,
    nome
  };
}

function mensagemPara(estado) {
  switch (estado.motivo) {
    case 'sem_solicitacao': return MSG.semSolicitacao;
    case 'aguardando_autorizacao': return MSG.aguardando;
    case 'recusada': return MSG.recusada;
    case 'revogada': return MSG.revogada;
    case 'expirada': return MSG.expirada;
    case 'participante_inativo': return MSG.participanteInativo;
    case 'periodo_nao_configurado': return MSG.periodoNaoConfigurado;
    case 'periodo_encerrado': return MSG.periodoEncerrado;
    case 'erro_interno': return MSG.erroGenerico;
    default:
      return estado.coleta_liberada ? MSG.aprovadaEmColeta : MSG.aprovadaAntesDoInicio;
  }
}

/* ---------- Handler ---------- */

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return resposta(204, undefined, { Allow: 'POST, OPTIONS' });
  }
  if (event.httpMethod !== 'POST') {
    return resposta(405, { erro: MSG.metodo }, { Allow: 'POST, OPTIONS' });
  }

  const config = lerConfiguracao();
  if (!config) {
    console.error('consultar-acesso: variáveis de ambiente ausentes ou inválidas.');
    return resposta(500, { erro: MSG.configuracao });
  }

  const token = extrairToken(event.headers);
  if (!token) {
    return resposta(401, { erro: MSG.sessaoAusente });
  }

  try {
    // 1) Autenticação: o UID vem somente do token validado pelo Supabase Auth.
    const usuario = await obterUsuario(config, token);
    if (!usuario) {
      return resposta(401, { erro: MSG.sessaoInvalida });
    }
    if (!ehIdentidadeAnonima(usuario)) {
      return resposta(403, { erro: MSG.naoAnonima });
    }

    // 2) Leituras somente sobre a sessão desse UID.
    const agora = new Date();
    const sessao = await lerSessao(config, usuario.id);
    const participante = sessao ? await lerParticipante(config, sessao.participante_id) : null;
    const periodo = await lerPeriodo(config);

    // 3) Decisão e resposta. Sem IDs, sem UID e sem dados de outros participantes.
    const estado = decidirAcesso({ sessao, participante, periodo, agora });
    return resposta(200, { ...estado, mensagem: mensagemPara(estado) });
  } catch (err) {
    // Falha fechada: em erro de leitura, o acesso não é liberado.
    // Registra somente o tipo do erro e o status HTTP.
    const status = err.status ? ` ${err.status}` : '';
    console.error(`consultar-acesso: falha (${err.name || 'Erro'}${status}).`);
    return resposta(500, { erro: MSG.erroGenerico });
  }
};