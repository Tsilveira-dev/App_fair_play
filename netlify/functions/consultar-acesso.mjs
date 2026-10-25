
/*
 * Fair Play - Netlify Function: consultar-acesso
 *
 * Informa ao estudante se pode entrar no aplicativo
 * e se os check-ins estão liberados.
 *
 * Consulta somente a sessão do usuário autenticado.
 * Não grava informações no banco.
 *
 * A chave secreta permanece exclusivamente no servidor.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const CABECALHOS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const resposta = (statusCode, corpo, extras = {}) => ({
  statusCode,
  headers: { ...CABECALHOS, ...extras },
  body: corpo === undefined ? "" : JSON.stringify(corpo)
});

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Dia 8: recuperação do check-in do Dia 7.
const DIAS_ATE_FIM_DA_COLETA = 7;

const STATUS_GRAVADOS = new Set([
  "pendente",
  "aprovada",
  "recusada",
  "revogada"
]);

const MSG = {
  metodo: "Método não permitido.",
  configuracao: "Configuração indisponível.",
  sessaoAusente:
    "Sessão ausente. Recarregue a página e tente novamente.",
  sessaoInvalida:
    "Sessão inválida ou expirada. Recarregue a página e tente novamente.",
  naoAnonima:
    "Sessão inválida para consultar o acesso. Recarregue a página e tente novamente.",
  erroGenerico:
    "Não foi possível verificar seu acesso. Tente novamente.",
  semSolicitacao:
    "Ainda não há solicitação para este dispositivo. Informe seu nome para solicitar acesso.",
  aguardando:
    "Solicitação enviada. Aguarde a autorização da equipe.",
  recusada:
    "Sua solicitação não foi aceita. Procure a equipe.",
  revogada:
    "Seu acesso foi encerrado. Procure a equipe.",
  expirada:
    "Seu acesso expirou. Procure a equipe.",
  participanteInativo:
    "Seu cadastro não está disponível. Procure a equipe.",
  periodoNaoConfigurado:
    "O período do teste ainda não foi definido. Aguarde a equipe.",
  periodoEncerrado:
    "O período do teste foi encerrado.",
  aprovadaAntesDoInicio:
    "Acesso liberado. Os check-ins ainda não começaram.",
  aprovadaEmColeta:
    "Acesso liberado. Você já pode fazer os check-ins de hoje."
};

class ErroBanco extends Error {
  constructor(status) {
    super(`Banco respondeu ${status}`);
    this.name = "ErroBanco";
    this.status = status;
  }
}

/*
 * 1. CONFIGURAÇÃO SEGURA DO SUPABASE
 *
 * Somente o Supabase de TESTES é permitido.
 */
function lerConfiguracao() {
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
    console.error(
      "consultar-acesso: ambiente inválido:",
      ambiente.erro
    );

    return null;
  }

  const chavePublicavel = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const chaveSecreta = (
    process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  if (
    !chavePublicavel ||
    !chaveSecreta ||
    chavePublicavel.startsWith("sb_secret_") ||
    chavePublicavel === chaveSecreta
  ) {
    return null;
  }

  return {
    url: ambiente.url,
    chavePublicavel,
    chaveSecreta
  };
}

/*
 * 2. EXTRAIR TOKEN DO ESTUDANTE
 */
function extrairToken(headers = {}) {
  const cabecalho = (
    headers.authorization ||
    headers.Authorization ||
    ""
  ).trim();

  const partes = cabecalho.split(/\s+/);

  if (
    partes.length !== 2 ||
    partes[0] !== "Bearer"
  ) {
    return null;
  }

  if (
    !REGEX_TOKEN.test(partes[1]) ||
    partes[1].length > 4096
  ) {
    return null;
  }

  return partes[1];
}

/*
 * 3. REQUISIÇÕES COM TEMPO LIMITE
 */
async function fetchComTimeout(url, opcoes, ms = 5000) {
  const controle = new AbortController();

  const timer = setTimeout(() => {
    controle.abort();
  }, ms);

  try {
    return await fetch(url, {
      ...opcoes,
      signal: controle.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

/*
 * 4. VALIDAR USUÁRIO NO SUPABASE AUTH
 */
async function obterUsuario(config, token) {
  const r = await fetchComTimeout(
    `${config.url}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: config.chavePublicavel,
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  if (
    r.status === 401 ||
    r.status === 403
  ) {
    return null;
  }

  if (!r.ok) {
    throw new Error(
      `Auth respondeu ${r.status}`
    );
  }

  const usuario = await r.json();

  return usuario && REGEX_UUID.test(usuario.id || "")
    ? usuario
    : null;
}

/*
 * 5. VERIFICAR IDENTIDADE ANÔNIMA
 */
function ehIdentidadeAnonima(usuario) {
  return (
    usuario.is_anonymous === true ||
    (
      usuario.app_metadata &&
      usuario.app_metadata.provider === "anonymous"
    )
  );
}

/*
 * 6. CONSULTAR TABELAS
 *
 * A chave secreta é utilizada apenas no servidor.
 */
async function lerTabela(config, tabela, parametros) {
  const url = new URL(
    `${config.url}/rest/v1/${tabela}`
  );

  for (
    const [chave, valor]
    of Object.entries(parametros)
  ) {
    url.searchParams.set(chave, valor);
  }

  const r = await fetchComTimeout(
    url.toString(),
    {
      method: "GET",
      headers: {
        apikey: config.chaveSecreta,
        Accept: "application/json"
      }
    }
  );

  if (!r.ok) {
    throw new ErroBanco(r.status);
  }

  const texto = await r.text();

  if (!texto) {
    return [];
  }

  try {
    const dados = JSON.parse(texto);

    return Array.isArray(dados)
      ? dados
      : [];
  } catch {
    return [];
  }
}

/*
 * 7. CALCULAR PERÍODO OFICIAL
 *
 * Dia 1: data_inicio
 * Dia 8: data_inicio + 7
 *
 * Horário de Fortaleza (UTC-3).
 */
function calcularPeriodo(dataInicio) {
  if (
    typeof dataInicio !== "string" ||
    !REGEX_DATA.test(dataInicio)
  ) {
    return null;
  }

  const base = new Date(
    `${dataInicio}T00:00:00Z`
  );

  if (
    Number.isNaN(base.getTime()) ||
    base.toISOString().slice(0, 10) !== dataInicio
  ) {
    return null;
  }

  const diaFim = new Date(base);

  diaFim.setUTCDate(
    diaFim.getUTCDate() +
    DIAS_ATE_FIM_DA_COLETA
  );

  const dataFim =
    diaFim.toISOString().slice(0, 10);

  return {
    inicio: new Date(
      `${dataInicio}T00:00:00-03:00`
    ),
    fim: new Date(
      `${dataFim}T23:59:59-03:00`
    )
  };
}

/*
 * 8. LER CONFIGURAÇÃO DO PERÍODO
 */
async function lerPeriodo(config) {
  const linhas = await lerTabela(
    config,
    "configuracao_teste",
    {
      select: "data_inicio,ativo",
      id: "eq.1",
      limit: "1"
    }
  );

  const configuracao = linhas[0];

  if (
    !configuracao ||
    configuracao.ativo !== true
  ) {
    return null;
  }

  return calcularPeriodo(
    configuracao.data_inicio
  );
}

function faseDoPeriodo(periodo, agora) {
  if (!periodo) {
    return "nao_configurado";
  }

  if (agora < periodo.inicio) {
    return "antes_do_inicio";
  }

  if (agora <= periodo.fim) {
    return "coleta";
  }

  return "encerrado";
}

/*
 * 9. CONSULTAR SESSÃO DO ESTUDANTE
 */
async function lerSessao(config, uid) {
  const linhas = await lerTabela(
    config,
    "sessoes_participantes",
    {
      select: "participante_id,status,expira_em",
      usuario_auth_id: `eq.${uid}`,
      limit: "1"
    }
  );

  return linhas[0] || null;
}

/*
 * 10. CONSULTAR PARTICIPANTE
 */
async function lerParticipante(
  config,
  participanteId
) {
  const linhas = await lerTabela(
    config,
    "participantes",
    {
      select: "nome,ativo",
      id: `eq.${participanteId}`,
      limit: "1"
    }
  );

  return linhas[0] || null;
}

/*
 * 11. VERIFICAR SE A SESSÃO EXPIROU
 */
function statusEfetivo(sessao, agora) {
  if (sessao.status === "aprovada") {
    const expira = Date.parse(
      sessao.expira_em
    );

    if (
      Number.isNaN(expira) ||
      expira <= agora.getTime()
    ) {
      return "expirada";
    }
  }

  return sessao.status;
}

/*
 * 12. DECIDIR ACESSO DO ESTUDANTE
 */
function decidirAcesso({
  sessao,
  participante,
  periodo,
  agora
}) {
  const fase = faseDoPeriodo(
    periodo,
    agora
  );

  const periodoResumo = periodo
    ? {
        inicio: periodo.inicio.toISOString(),
        fim: periodo.fim.toISOString()
      }
    : null;

  const negado = (
    status,
    motivo,
    nome = null
  ) => ({
    status,
    motivo,
    pode_entrar: false,
    coleta_liberada: false,
    fase,
    periodo: periodoResumo,
    nome
  });

  if (!sessao) {
    return negado(
      "sem_solicitacao",
      "sem_solicitacao"
    );
  }

  const status = STATUS_GRAVADOS.has(
    sessao.status
  )
    ? statusEfetivo(sessao, agora)
    : null;

  if (!status) {
    console.error(
      "consultar-acesso: status desconhecido."
    );

    return negado(
      "indisponivel",
      "erro_interno"
    );
  }

  if (
    !participante ||
    participante.ativo !== true
  ) {
    return negado(
      status,
      "participante_inativo"
    );
  }

  const nome = participante.nome;

  switch (status) {
    case "pendente":
      return negado(
        status,
        "aguardando_autorizacao",
        nome
      );

    case "recusada":
      return negado(
        status,
        "recusada",
        nome
      );

    case "revogada":
      return negado(
        status,
        "revogada",
        nome
      );

    case "expirada":
      return negado(
        status,
        "expirada",
        nome
      );

    case "aprovada":
      break;

    default:
      return negado(
        "indisponivel",
        "erro_interno"
      );
  }

  if (fase === "nao_configurado") {
    return negado(
      status,
      "periodo_nao_configurado",
      nome
    );
  }

  if (fase === "encerrado") {
    return negado(
      status,
      "periodo_encerrado",
      nome
    );
  }

  return {
    status,
    motivo: null,
    pode_entrar: true,
    coleta_liberada:
      fase === "coleta",
    fase,
    periodo: periodoResumo,
    nome
  };
}

/*
 * 13. MENSAGEM PARA O ESTUDANTE
 */
function mensagemPara(estado) {
  switch (estado.motivo) {
    case "sem_solicitacao":
      return MSG.semSolicitacao;

    case "aguardando_autorizacao":
      return MSG.aguardando;

    case "recusada":
      return MSG.recusada;

    case "revogada":
      return MSG.revogada;

    case "expirada":
      return MSG.expirada;

    case "participante_inativo":
      return MSG.participanteInativo;

    case "periodo_nao_configurado":
      return MSG.periodoNaoConfigurado;

    case "periodo_encerrado":
      return MSG.periodoEncerrado;

    case "erro_interno":
      return MSG.erroGenerico;

    default:
      return estado.coleta_liberada
        ? MSG.aprovadaEmColeta
        : MSG.aprovadaAntesDoInicio;
  }
}

/*
 * 14. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return resposta(
      204,
      undefined,
      { Allow: "POST, OPTIONS" }
    );
  }

  if (event.httpMethod !== "POST") {
    return resposta(
      405,
      { erro: MSG.metodo },
      { Allow: "POST, OPTIONS" }
    );
  }

  // Configuração validada para o Supabase de TESTES.
  const config = lerConfiguracao();

  if (!config) {
    console.error(
      "consultar-acesso: configuração indisponível."
    );

    return resposta(
      500,
      { erro: MSG.configuracao }
    );
  }

  const token = extrairToken(
    event.headers
  );

  if (!token) {
    return resposta(
      401,
      { erro: MSG.sessaoAusente }
    );
  }

  try {
    /*
     * Autenticação do estudante.
     */
    const usuario = await obterUsuario(
      config,
      token
    );

    if (!usuario) {
      return resposta(
        401,
        { erro: MSG.sessaoInvalida }
      );
    }

    if (!ehIdentidadeAnonima(usuario)) {
      return resposta(
        403,
        { erro: MSG.naoAnonima }
      );
    }

    /*
     * Consultar somente os dados deste UID.
     */
    const agora = new Date();

    const sessao = await lerSessao(
      config,
      usuario.id
    );

    const participante = sessao
      ? await lerParticipante(
          config,
          sessao.participante_id
        )
      : null;

    const periodo = await lerPeriodo(
      config
    );

    /*
     * Decisão final de acesso.
     */
    const estado = decidirAcesso({
      sessao,
      participante,
      periodo,
      agora
    });

    return resposta(
      200,
      {
        ...estado,
        mensagem: mensagemPara(estado)
      }
    );

  } catch (err) {
    const status = err.status
      ? ` ${err.status}`
      : "";

    console.error(
      `consultar-acesso: falha (${err.name || "Erro"}${status}).`
    );

    return resposta(
      500,
      { erro: MSG.erroGenerico }
    );
  }
};
