import { chavePublicavelValida, identidadeGestor } from "../lib/seguranca.mjs";

/*
 * Fair Play - Netlify Function: listar-participantes
 *
 * 1. Aceita somente GET.
 * 2. Valida o token no Supabase Auth.
 * 3. Confirma que o usuário é gestor.
 * 4. Lista apenas os participantes cadastrados.
 *
 * A chave secreta permanece no servidor.
 * O projeto Supabase é validado por ambiente.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const CABECALHOS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: CABECALHOS,
  body: JSON.stringify(corpo)
});

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;

const LIMITE_PARTICIPANTES = 500;

/*
 * 1. CONFIGURAÇÃO SEGURA
 *
 * Permite somente o Supabase de TESTES.
 */
function lerConfiguracao() {
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
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
 * 2. EXTRAIR TOKEN DE AUTENTICAÇÃO
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
 * 4. VALIDAR USUÁRIO NO SUPABASE AUTH
 *
 * Retorna o UID validado ou null.
 */
async function obterUsuarioId(config, token) {
  const r = await fetchComTimeout(
    `${config.url}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: config.chavePublicavel,
        Authorization: `Bearer ${token}`
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

  const id = usuario && usuario.id;

  return identidadeGestor(usuario) && REGEX_UUID.test(id || "")
    ? id
    : null;
}

/*
 * 5. VERIFICAR SE O USUÁRIO É GESTOR
 *
 * Consulta public.gestores pelo UID autenticado.
 */
async function ehGestor(config, usuarioId) {
  const consulta = new URL(
    `${config.url}/rest/v1/gestores`
  );

  consulta.searchParams.set(
    "select",
    "usuario_auth_id"
  );

  consulta.searchParams.set(
    "usuario_auth_id",
    `eq.${usuarioId}`
  );

  consulta.searchParams.set(
    "limit",
    "1"
  );

  const r = await fetchComTimeout(
    consulta.toString(),
    {
      method: "GET",
      headers: {
        apikey: config.chaveSecreta,
        Accept: "application/json"
      }
    }
  );

  if (!r.ok) {
    throw new Error(
      `Gestores respondeu ${r.status}`
    );
  }

  const linhas = await r.json();

  return (
    Array.isArray(linhas) &&
    linhas.length === 1
  );
}

/*
 * 6. LISTAR PARTICIPANTES
 *
 * Retorna somente:
 * id, nome, ativo e criado_em.
 */
async function listarParticipantes(config) {
  const consulta = new URL(
    `${config.url}/rest/v1/participantes`
  );

  consulta.searchParams.set(
    "select",
    "id,nome,ativo,criado_em"
  );

  consulta.searchParams.set(
    "order",
    "nome.asc"
  );

  consulta.searchParams.set(
    "limit",
    String(LIMITE_PARTICIPANTES)
  );

  const r = await fetchComTimeout(
    consulta.toString(),
    {
      method: "GET",
      headers: {
        apikey: config.chaveSecreta,
        Accept: "application/json"
      }
    }
  );

  if (!r.ok) {
    throw new Error(
      `Participantes respondeu ${r.status}`
    );
  }

  const linhas = await r.json();

  if (!Array.isArray(linhas)) {
    throw new Error(
      "Resposta inesperada de participantes"
    );
  }

  return linhas.map((p) => ({
    id: String(p.id),
    nome: String(p.nome),
    ativo: p.ativo === true,
    criado_em: p.criado_em
  }));
}

/*
 * 7. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {
  // Aceita somente GET.
  if (event.httpMethod !== "GET") {
    return resposta(
      405,
      {
        erro: "Método não permitido."
      }
    );
  }

  // Confere se o ambiente é o de TESTES.
  const config = lerConfiguracao();

  if (!config) {
    console.error(
      "listar-participantes: configuração de ambiente inválida."
    );

    return resposta(
      500,
      {
        erro: "Configuração indisponível."
      }
    );
  }

  // Extrai o token do usuário.
  const token = extrairToken(
    event.headers
  );

  if (!token) {
    return resposta(
      401,
      {
        erro: "Sessão ausente. Entre novamente."
      }
    );
  }

  try {
    // 1. Valida o usuário no Supabase Auth.
    const usuarioId = await obterUsuarioId(
      config,
      token
    );

    if (!usuarioId) {
      return resposta(
        401,
        {
          erro: "Sessão inválida ou expirada. Entre novamente."
        }
      );
    }

    // 2. Confirma que é gestor cadastrado.
    const gestorAutorizado = await ehGestor(
      config,
      usuarioId
    );

    if (!gestorAutorizado) {
      return resposta(
        403,
        {
          erro: "Acesso não autorizado."
        }
      );
    }

    // 3. Lista participantes autorizados ao painel.
    const participantes = await listarParticipantes(
      config
    );

    return resposta(
      200,
      {
        participantes
      }
    );

  } catch (err) {
    // Não registra tokens, senhas ou chaves.
    console.error(
      `listar-participantes: falha (${err.name || "Erro"}).`
    );

    return resposta(
      500,
      {
        erro: "Não foi possível carregar os participantes."
      }
    );
  }
};
