
/*
 * Fair Play - Netlify Function: verificar-gestor
 *
 * 1. Valida o token do usuário no Supabase Auth.
 * 2. Confirma se o usuário está cadastrado em public.gestores.
 * 3. Libera o acesso somente para gestores autorizados.
 *
 * Ambiente exclusivo de TESTES.
 * A SUPABASE_SECRET_KEY permanece no servidor.
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

/*
 * 1. EXTRAIR TOKEN DO USUÁRIO
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
    partes[0].toLowerCase() !== "bearer"
  ) {
    return null;
  }

  const token = partes[1];

  if (
    !REGEX_TOKEN.test(token) ||
    token.length > 4096
  ) {
    return null;
  }

  return token;
}

/*
 * 2. REQUISIÇÕES COM TEMPO LIMITE
 */
async function fetchComTimeout(
  url,
  opcoes,
  ms = 5000
) {
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
 * 3. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {

  // Aceita somente POST.
  if (event.httpMethod !== "POST") {
    return resposta(405, {
      erro: "Método não permitido."
    });
  }

  /*
   * 4. VALIDAR AMBIENTE DO SUPABASE
   *
   * Somente o Supabase de TESTES é permitido.
   */
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
    console.error(
      "verificar-gestor: ambiente inválido.",
      ambiente.erro
    );

    return resposta(500, {
      erro: "Configuração indisponível."
    });
  }

  const url = ambiente.url;

  const chavePublicavel = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const chaveSecreta = (
    process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  /*
   * Impede configurações ausentes ou que
   * utilizem a chave secreta no campo público.
   */
  const chavesInvalidas =
    !chavePublicavel ||
    !chaveSecreta ||
    chavePublicavel.startsWith("sb_secret_") ||
    chavePublicavel === chaveSecreta;

  if (chavesInvalidas) {
    console.error(
      "verificar-gestor: configuração das chaves inválida."
    );

    return resposta(500, {
      erro: "Configuração indisponível."
    });
  }

  /*
   * 5. EXTRAIR TOKEN
   */
  const token = extrairToken(event.headers);

  if (!token) {
    return resposta(401, {
      erro: "Sessão ausente. Entre novamente."
    });
  }

  /*
   * 6. VALIDAR TOKEN NO SUPABASE AUTH
   */
  let usuarioId;

  try {
    const r = await fetchComTimeout(
      `${url}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: chavePublicavel,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (
      r.status === 401 ||
      r.status === 403
    ) {
      return resposta(401, {
        erro: "Sessão inválida ou expirada. Entre novamente."
      });
    }

    if (!r.ok) {
      console.error(
        `verificar-gestor: Supabase Auth respondeu ${r.status}.`
      );

      return resposta(500, {
        erro: "Não foi possível verificar o acesso."
      });
    }

    const usuario = await r.json();

    usuarioId = usuario?.id;

  } catch (err) {
    console.error(
      `verificar-gestor: falha ao validar token (${err.name || "Erro"}).`
    );

    return resposta(500, {
      erro: "Não foi possível verificar o acesso."
    });
  }

  /*
   * 7. CONFERIR ID DO USUÁRIO
   */
  if (
    !usuarioId ||
    !REGEX_UUID.test(usuarioId)
  ) {
    return resposta(401, {
      erro: "Sessão inválida ou expirada. Entre novamente."
    });
  }

  /*
   * 8. CONSULTAR PUBLIC.GESTORES
   *
   * Somente o servidor utiliza a chave secreta.
   * O UID foi obtido do token autenticado.
   */
  try {
    const consulta = new URL(
      `${url}/rest/v1/gestores`
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
          apikey: chaveSecreta,
          Accept: "application/json"
        }
      }
    );

    if (!r.ok) {
      console.error(
        `verificar-gestor: consulta a gestores respondeu ${r.status}.`
      );

      return resposta(500, {
        erro: "Não foi possível verificar o acesso."
      });
    }

    const linhas = await r.json();

    if (
      !Array.isArray(linhas) ||
      linhas.length !== 1
    ) {
      return resposta(403, {
        erro: "Acesso não autorizado."
      });
    }

  } catch (err) {
    console.error(
      `verificar-gestor: falha ao consultar gestores (${err.name || "Erro"}).`
    );

    return resposta(500, {
      erro: "Não foi possível verificar o acesso."
    });
  }

  /*
   * 9. GESTOR AUTORIZADO
   */
  return resposta(200, {
    autorizado: true
  });
};
