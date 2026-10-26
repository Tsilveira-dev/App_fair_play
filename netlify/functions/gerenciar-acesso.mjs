import { chavePublicavelValida, identidadeGestor } from "../lib/seguranca.mjs";

/*
 * Fair Play - Netlify Function: gerenciar-acesso
 *
 * Painel do gestor para autorização das sessões dos estudantes.
 *
 * GET  -> lista sessões (filtro opcional ?status=)
 *         e o estado do período.
 *
 * POST -> executa uma ação:
 *         {
 *           "acao": "aprovar" | "recusar" | "revogar",
 *           "sessao_id": "<uuid>"
 *         }
 *
 * Regras:
 * - Somente UIDs cadastrados em public.gestores.
 * - Identidades anônimas não podem acessar o painel.
 * - Aprovar e recusar somente sessões pendentes.
 * - Revogar somente sessões aprovadas.
 * - O status "expirada" é calculado, nunca gravado.
 * - Expiração: final do Dia 8, às 23:59:59, UTC-3.
 * - Nenhum registro é excluído.
 * - O PATCH exige o status anterior para evitar conflitos.
 * - Respostas não incluem UID dos estudantes nem chaves.
 * - A chave secreta permanece no servidor.
 * - O projeto Supabase é validado por ambiente.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

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

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

const TAMANHO_MAXIMO_CORPO = 1024;
const LIMITE_SESSOES = 500;
const LIMITE_PARTICIPANTES = 1000;
const DIAS_ATE_FIM_DA_COLETA = 7;
const CODIGO_UNICO = '23505';

const COLUNAS_SESSAO =
  'id,participante_id,status,tipo_dispositivo,solicitado_em,autorizado_em,expira_em,revogado_em';

const FILTROS_STATUS = new Set([
  'pendente',
  'aprovada',
  'recusada',
  'revogada',
  'expirada'
]);

// Cada ação define o status exigido antes da mudança.
const ACOES = {
  aprovar: { deStatus: 'pendente' },
  recusar: { deStatus: 'pendente' },
  revogar: { deStatus: 'aprovada' }
};

const MSG = {
  metodo: 'Método não permitido.',
  configuracao: 'Configuração indisponível.',
  sessaoAusente: 'Sessão ausente. Entre novamente.',
  sessaoInvalida: 'Sessão inválida ou expirada. Entre novamente.',
  naoGestor: 'Acesso não autorizado.',
  dadosInvalidos: 'Requisição inválida.',
  filtroInvalido: 'Filtro de status inválido.',
  naoEncontrada: 'Solicitação não encontrada.',
  estadoMudou:
    'A situação desta solicitação mudou. Atualize a lista e tente novamente.',
  participanteInativo:
    'Participante inativo. Reative o cadastro antes de autorizar.',
  periodoNaoConfigurado:
    'Configure o período do teste antes de autorizar.',
  periodoEncerrado:
    'O período do teste já terminou. Não é possível autorizar.',
  jaAutorizado:
    'Este participante já tem um acesso autorizado. Revogue o acesso anterior antes de liberar outro dispositivo.',
  autorizado: 'Acesso autorizado.',
  recusado: 'Solicitação recusada.',
  revogado: 'Acesso revogado.',
  erroGenerico:
    'Não foi possível concluir a operação. Tente novamente.'
};

class ErroBanco extends Error {
  constructor(status, codigo) {
    super(`banco respondeu ${status}`);
    this.name = 'ErroBanco';
    this.status = status;
    this.codigo = codigo;
  }
}

/*
 * 1. CONFIGURAÇÃO SEGURA DO SUPABASE
 *
 * Esta função só permite o projeto Supabase de TESTES.
 */
function lerConfiguracao() {
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
    return null;
  }

  const chavePublicavel = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ''
  ).trim();

  const chaveSecreta = (
    process.env.SUPABASE_SECRET_KEY || ''
  ).trim();

  if (
    !chavePublicavel ||
    !chaveSecreta ||
    !chavePublicavelValida(chavePublicavel) ||
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
 * 2. EXTRAÇÃO DO TOKEN
 */
function extrairToken(headers = {}) {
  const cabecalho = (
    headers.authorization ||
    headers.Authorization ||
    ''
  ).trim();

  const partes = cabecalho.split(/\s+/);

  if (
    partes.length !== 2 ||
    partes[0] !== 'Bearer'
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
async function fetchComTimeout(
  url,
  opcoes,
  ms = 5000
) {
  const controle = new AbortController();

  const timer = setTimeout(
    () => controle.abort(),
    ms
  );

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
 * 4. AUTENTICAÇÃO DO USUÁRIO
 */
async function obterUsuario(config, token) {
  const r = await fetchComTimeout(
    `${config.url}/auth/v1/user`,
    {
      method: 'GET',
      headers: {
        apikey: config.chavePublicavel,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
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
      `auth respondeu ${r.status}`
    );
  }

  const usuario = await r.json();

  return usuario &&
    REGEX_UUID.test(usuario.id || '')
    ? usuario
    : null;
}

/*
 * 5. BLOQUEAR IDENTIDADES ANÔNIMAS
 */
/*
 * 6. ACESSO AO BANCO
 *
 * A chave secreta só é usada no servidor.
 */
async function rest(
  config,
  tabela,
  {
    metodo = 'GET',
    parametros = {},
    corpo,
    retornar = false
  } = {}
) {
  const url = new URL(
    `${config.url}/rest/v1/${tabela}`
  );

  for (
    const [chave, valor]
    of Object.entries(parametros)
  ) {
    url.searchParams.set(chave, valor);
  }

  const cabecalhos = {
    apikey: config.chaveSecreta,
    Accept: 'application/json'
  };

  if (corpo !== undefined) {
    cabecalhos['Content-Type'] =
      'application/json';
  }

  if (metodo !== 'GET') {
    cabecalhos.Prefer = retornar
      ? 'return=representation'
      : 'return=minimal';
  }

  const r = await fetchComTimeout(
    url.toString(),
    {
      method: metodo,
      headers: cabecalhos,
      body: corpo !== undefined
        ? JSON.stringify(corpo)
        : undefined
    }
  );

  if (!r.ok) {
    let codigo = null;

    try {
      const erro = await r.json();

      codigo =
        erro &&
        typeof erro.code === 'string'
          ? erro.code
          : null;
    } catch {
      codigo = null;
    }

    throw new ErroBanco(
      r.status,
      codigo
    );
  }

  if (
    metodo !== 'GET' &&
    !retornar
  ) {
    return [];
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
 * 7. VERIFICAR SE O USUÁRIO É GESTOR
 */
async function ehGestor(config, uid) {
  const linhas = await rest(
    config,
    'gestores',
    {
      parametros: {
        select: 'usuario_auth_id',
        usuario_auth_id: `eq.${uid}`,
        limit: '1'
      }
    }
  );

  return linhas.length === 1;
}

/*
 * 8. CALCULAR O PERÍODO DO TESTE
 *
 * Dia 1: data_inicio.
 * Dia 8: data_inicio + 7.
 */
function calcularPeriodo(dataInicio) {
  if (
    typeof dataInicio !== 'string' ||
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
 * 9. CONSULTAR CONFIGURAÇÃO DO PERÍODO
 *
 * Sem configuração válida, não há autorização.
 */
async function lerPeriodo(config) {
  const linhas = await rest(
    config,
    'configuracao_teste',
    {
      parametros: {
        select: 'data_inicio,ativo',
        id: 'eq.1',
        limit: '1'
      }
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

/*
 * 10. STATUS EFETIVO DA SESSÃO
 */
function estadoEfetivo(sessao, agora) {
  if (sessao.status === 'aprovada') {
    const expira = Date.parse(
      sessao.expira_em
    );

    if (
      Number.isNaN(expira) ||
      expira <= agora.getTime()
    ) {
      return 'expirada';
    }
  }

  return sessao.status;
}

/*
 * 11. FORMATAR DADOS PARA O PAINEL
 *
 * Não inclui usuario_auth_id do estudante.
 */
function formatarSessao(
  sessao,
  participante,
  agora
) {
  return {
    id: sessao.id,
    nome: participante
      ? participante.nome
      : null,
    participante_ativo: participante
      ? participante.ativo === true
      : false,
    tipo_dispositivo:
      sessao.tipo_dispositivo,
    status: sessao.status,
    status_efetivo:
      estadoEfetivo(sessao, agora),
    solicitado_em:
      sessao.solicitado_em,
    autorizado_em:
      sessao.autorizado_em,
    expira_em:
      sessao.expira_em,
    revogado_em:
      sessao.revogado_em
  };
}

/*
 * 12. CONSULTAR SESSÃO POR ID
 */
async function lerSessaoPorId(config, id) {
  const linhas = await rest(
    config,
    'sessoes_participantes',
    {
      parametros: {
        select: COLUNAS_SESSAO,
        id: `eq.${id}`,
        limit: '1'
      }
    }
  );

  return linhas[0] || null;
}

/*
 * 13. CONSULTAR PARTICIPANTE
 */
async function lerParticipante(config, id) {
  const linhas = await rest(
    config,
    'participantes',
    {
      parametros: {
        select: 'id,nome,ativo',
        id: `eq.${id}`,
        limit: '1'
      }
    }
  );

  return linhas[0] || null;
}

/*
 * 14. VERIFICAR AUTORIZAÇÃO ATIVA
 */
async function existeAutorizacaoAtiva(
  config,
  participanteId
) {
  const linhas = await rest(
    config,
    'sessoes_participantes',
    {
      parametros: {
        select: 'id',
        participante_id:
          `eq.${participanteId}`,
        status: 'eq.aprovada',
        limit: '1'
      }
    }
  );

  return linhas.length > 0;
}

/*
 * 15. LISTAR SOLICITAÇÕES
 *
 * GET /gerenciar-acesso
 */
async function listar(config, event, agora) {
  const filtro = (
    event.queryStringParameters || {}
  ).status;

  if (
    filtro !== undefined &&
    !FILTROS_STATUS.has(filtro)
  ) {
    return resposta(
      400,
      { erro: MSG.filtroInvalido }
    );
  }

  const parametros = {
    select: COLUNAS_SESSAO,
    order: 'solicitado_em.desc',
    limit: String(LIMITE_SESSOES)
  };

  // "expirada" é um status calculado.
  if (
    filtro &&
    filtro !== 'expirada'
  ) {
    parametros.status =
      `eq.${filtro}`;
  }

  let sessoes = await rest(
    config,
    'sessoes_participantes',
    { parametros }
  );

  if (filtro === 'expirada') {
    sessoes = sessoes.filter(
      s => estadoEfetivo(s, agora) === 'expirada'
    );
  }

  const participantes = await rest(
    config,
    'participantes',
    {
      parametros: {
        select: 'id,nome,ativo',
        limit: String(
          LIMITE_PARTICIPANTES
        )
      }
    }
  );

  const porId = new Map(
    participantes.map(
      p => [p.id, p]
    )
  );

  const periodo = await lerPeriodo(
    config
  );

  return resposta(
    200,
    {
      periodo: periodo
        ? {
            configurado: true,
            inicio:
              periodo.inicio.toISOString(),
            fim:
              periodo.fim.toISOString()
          }
        : {
            configurado: false,
            inicio: null,
            fim: null
          },
      total: sessoes.length,
      sessoes: sessoes.map(
        s => formatarSessao(
          s,
          porId.get(s.participante_id),
          agora
        )
      )
    }
  );
}

/*
 * 16. LER DADOS DO POST
 */
function lerCorpo(event) {
  const bruto = event.isBase64Encoded
    ? Buffer.from(
        event.body || '',
        'base64'
      ).toString('utf8')
    : (
        event.body || ''
      );

  if (
    !bruto ||
    Buffer.byteLength(
      bruto,
      'utf8'
    ) > TAMANHO_MAXIMO_CORPO
  ) {
    return null;
  }

  try {
    const dados = JSON.parse(
      bruto
    );

    return (
      dados &&
      typeof dados === 'object' &&
      !Array.isArray(dados)
    )
      ? dados
      : null;
  } catch {
    return null;
  }
}

/*
 * 17. VALIDAR AÇÃO
 */
function validarAcao(dados) {
  if (!dados) {
    return null;
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      ACOES,
      dados.acao
    )
  ) {
    return null;
  }

  if (
    typeof dados.sessao_id !== 'string' ||
    !REGEX_UUID.test(dados.sessao_id)
  ) {
    return null;
  }

  return {
    acao: dados.acao,
    sessaoId: dados.sessao_id
  };
}

/*
 * 18. ALTERAR STATUS
 *
 * Só atualiza se o status ainda for o esperado.
 */
async function transicionar(
  config,
  sessaoId,
  deStatus,
  campos
) {
  const linhas = await rest(
    config,
    'sessoes_participantes',
    {
      metodo: 'PATCH',
      parametros: {
        id: `eq.${sessaoId}`,
        status: `eq.${deStatus}`,
        select: COLUNAS_SESSAO
      },
      corpo: campos,
      retornar: true
    }
  );

  return linhas[0] || null;
}

/*
 * 19. APROVAR ACESSO
 */
async function aprovar(
  config,
  uid,
  sessao,
  participante,
  agora
) {
  if (
    participante.ativo !== true
  ) {
    return resposta(
      409,
      {
        erro: MSG.participanteInativo
      }
    );
  }

  const periodo = await lerPeriodo(
    config
  );

  if (!periodo) {
    return resposta(
      409,
      {
        erro: MSG.periodoNaoConfigurado
      }
    );
  }

  if (
    agora.getTime() >=
    periodo.fim.getTime()
  ) {
    return resposta(
      409,
      {
        erro: MSG.periodoEncerrado
      }
    );
  }

  if (
    await existeAutorizacaoAtiva(
      config,
      sessao.participante_id
    )
  ) {
    return resposta(
      409,
      {
        erro: MSG.jaAutorizado
      }
    );
  }

  let atualizada;

  try {
    atualizada = await transicionar(
      config,
      sessao.id,
      'pendente',
      {
        status: 'aprovada',
        autorizado_em:
          agora.toISOString(),
        autorizado_por: uid,
        expira_em:
          periodo.fim.toISOString()
      }
    );
  } catch (err) {
    if (
      err instanceof ErroBanco &&
      err.codigo === CODIGO_UNICO
    ) {
      return resposta(
        409,
        {
          erro: MSG.jaAutorizado
        }
      );
    }

    throw err;
  }

  if (!atualizada) {
    return resposta(
      409,
      {
        erro: MSG.estadoMudou
      }
    );
  }

  return resposta(
    200,
    {
      mensagem: MSG.autorizado,
      sessao: formatarSessao(
        atualizada,
        participante,
        agora
      )
    }
  );
}

/*
 * 20. RECUSAR ACESSO
 */
async function recusar(
  config,
  sessao,
  participante,
  agora
) {
  const atualizada = await transicionar(
    config,
    sessao.id,
    'pendente',
    {
      status: 'recusada'
    }
  );

  if (!atualizada) {
    return resposta(
      409,
      {
        erro: MSG.estadoMudou
      }
    );
  }

  return resposta(
    200,
    {
      mensagem: MSG.recusado,
      sessao: formatarSessao(
        atualizada,
        participante,
        agora
      )
    }
  );
}

/*
 * 21. REVOGAR ACESSO
 *
 * Também permite revogar sessões expiradas
 * que ainda estejam gravadas como "aprovada".
 */
async function revogar(
  config,
  sessao,
  participante,
  agora
) {
  const atualizada = await transicionar(
    config,
    sessao.id,
    'aprovada',
    {
      status: 'revogada',
      revogado_em:
        agora.toISOString()
    }
  );

  if (!atualizada) {
    return resposta(
      409,
      {
        erro: MSG.estadoMudou
      }
    );
  }

  return resposta(
    200,
    {
      mensagem: MSG.revogado,
      sessao: formatarSessao(
        atualizada,
        participante,
        agora
      )
    }
  );
}

/*
 * 22. EXECUTAR AÇÃO DO GESTOR
 */
async function executarAcao(
  config,
  uid,
  { acao, sessaoId },
  agora
) {
  const sessao = await lerSessaoPorId(
    config,
    sessaoId
  );

  if (!sessao) {
    return resposta(
      404,
      {
        erro: MSG.naoEncontrada
      }
    );
  }

  if (
    sessao.status !==
    ACOES[acao].deStatus
  ) {
    return resposta(
      409,
      {
        erro: MSG.estadoMudou
      }
    );
  }

  const participante = await lerParticipante(
    config,
    sessao.participante_id
  );

  if (!participante) {
    return resposta(
      404,
      {
        erro: MSG.naoEncontrada
      }
    );
  }

  if (acao === 'aprovar') {
    return aprovar(
      config,
      uid,
      sessao,
      participante,
      agora
    );
  }

  if (acao === 'recusar') {
    return recusar(
      config,
      sessao,
      participante,
      agora
    );
  }

  return revogar(
    config,
    sessao,
    participante,
    agora
  );
}

/*
 * 23. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {
  if (
    event.httpMethod === 'OPTIONS'
  ) {
    return resposta(
      204,
      undefined,
      {
        Allow: 'GET, POST, OPTIONS'
      }
    );
  }

  if (
    event.httpMethod !== 'GET' &&
    event.httpMethod !== 'POST'
  ) {
    return resposta(
      405,
      {
        erro: MSG.metodo
      },
      {
        Allow: 'GET, POST, OPTIONS'
      }
    );
  }

  // Proteção exclusiva do Supabase de TESTES.
  const config = lerConfiguracao();

  if (!config) {
    console.error(
      'gerenciar-acesso: configuração de ambiente inválida.'
    );

    return resposta(
      500,
      {
        erro: MSG.configuracao
      }
    );
  }

  const token = extrairToken(
    event.headers
  );

  if (!token) {
    return resposta(
      401,
      {
        erro: MSG.sessaoAusente
      }
    );
  }

  try {
    // 1. Autenticar pelo Supabase Auth.
    const usuario = await obterUsuario(
      config,
      token
    );

    if (!usuario) {
      return resposta(
        401,
        {
          erro: MSG.sessaoInvalida
        }
      );
    }

    // 2. Bloquear identidades anônimas.
    if (
      !identidadeGestor(usuario)
    ) {
      return resposta(
        403,
        {
          erro: MSG.naoGestor
        }
      );
    }

    // 3. Verificar se o UID é gestor.
    if (
      !(await ehGestor(
        config,
        usuario.id
      ))
    ) {
      return resposta(
        403,
        {
          erro: MSG.naoGestor
        }
      );
    }

    const agora = new Date();

    // 4. Listar solicitações.
    if (
      event.httpMethod === 'GET'
    ) {
      return await listar(
        config,
        event,
        agora
      );
    }

    // 5. Validar e executar ação.
    const dados = validarAcao(
      lerCorpo(event)
    );

    if (!dados) {
      return resposta(
        400,
        {
          erro: MSG.dadosInvalidos
        }
      );
    }

    return await executarAcao(
      config,
      usuario.id,
      dados,
      agora
    );

  } catch (err) {
    const status = err.status
      ? ` ${err.status}`
      : '';

    const codigo = err.codigo
      ? ` ${err.codigo}`
      : '';

    console.error(
      `gerenciar-acesso: falha (${err.name || 'Erro'}${status}${codigo}).`
    );

    return resposta(
      500,
      {
        erro: MSG.erroGenerico
      }
    );
  }
};
