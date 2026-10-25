
/*
 * Fair Play - Netlify Function: verificar-gestor
 *
 * 1. Valida o token no Supabase Auth.
 * 2. Confirma o cadastro em public.gestores.
 * 3. Autoriza somente gestores cadastrados.
 *
 * Ambiente exclusivo de TESTES.
 * A chave secreta permanece no servidor.
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
 * 1. EXTRAIR TOKEN DE AUTENTICACAO
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
 * 2. REQUISICOES COM TEMPO LIMITE
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
 * 3. PROTEGER INFORMACOES NOS LOGS
 *
 * Oculta formatos conhecidos de chaves,
 * tokens e URLs em mensagens de erro.
 */
function mensagemSegura(erro) {
  const mensagem = String(
    erro?.message || "Mensagem nao informada"
  );

  return mensagem
    .replace(
      /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
      "[CHAVE]"
    )
    .replace(
      /Bearer\s+[A-Za-z0-9._-]+/gi,
      "Bearer [TOKEN]"
    )
    .replace(
      /eyJ[A-Za-z0-9._-]{20,}/g,
      "[JWT]"
    )
    .replace(
      /https?:\/\/[^\s"'`]+/g,
      "[URL]"
    )
    .slice(0, 180);
}

/*
 * 4. REGISTRAR ERRO PARA DIAGNOSTICO
 *
 * Nao inclui valores das variaveis de ambiente.
 */
function registrarErro(etapa, erro) {
  console.error(
    "verificar-gestor: diagnostico",
    {
      etapa,
      tipo: erro?.name || "Erro",
      mensagem: mensagemSegura(erro),
      codigo: String(
        erro?.code || "nao_informado"
      ).slice(0, 60),
      codigoDaCausa: String(
        erro?.cause?.code || "nao_informado"
      ).slice(0, 60)
    }
  );
}

/*
 * 5. FUNCAO PRINCIPAL
 */
export const handler = async (event) => {

  // Aceita somente POST.
  if (event.httpMethod !== "POST") {
    return resposta(405, {
      erro: "Método não permitido."
    });
  }

  /*
   * 6. VALIDAR AMBIENTE DE TESTE
   */
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
    console.error(
      "verificar-gestor: ambiente invalido.",
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
   * Recusa configuracao ausente ou uso
   * indevido da chave secreta no campo publico.
   */
  const chavesInvalidas =
    !chavePublicavel ||
    !chaveSecreta ||
    chavePublicavel.startsWith("sb_secret_") ||
    chavePublicavel === chaveSecreta;

  if (chavesInvalidas) {
    console.error(
      "verificar-gestor: configuracao das chaves invalida."
    );

    return resposta(500, {
      erro: "Configuração indisponível."
    });
  }

  /*
   * 7. EXTRAIR TOKEN
   */
  const token = extrairToken(
    event.headers
  );

  if (!token) {
    return resposta(401, {
      erro: "Sessão ausente. Entre novamente."
    });
  }

  /*
   * 8. VALIDAR TOKEN NO SUPABASE AUTH
   */
  let usuarioId;
  let etapaAuth = "preparar_auth";

  try {
    etapaAuth = "consultar_auth";

    const r = await fetchComTimeout(
      `${url}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: chavePublicavel,
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
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
        "verificar-gestor: Supabase Auth HTTP",
        r.status
      );

      return resposta(500, {
        erro: "Não foi possível verificar o acesso."
      });
    }

    etapaAuth = "ler_resposta_auth";

    const usuario = await r.json();

    usuarioId = usuario?.id;

  } catch (err) {
    registrarErro(
      etapaAuth,
      err
    );

    return resposta(500, {
      erro: "Não foi possível verificar o acesso."
    });
  }

  /*
   * 9. VALIDAR ID DO USUARIO
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
   * 10. CONSULTAR PUBLIC.GESTORES
   *
   * Apenas o servidor utiliza a chave secreta.
   * A consulta usa o UID validado pelo Auth.
   */
  let etapaGestores = "preparar_consulta";

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

    /*
     * ETAPA A: Enviar consulta ao Supabase.
     */
    etapaGestores = "requisicao_rest";

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

    /*
     * ETAPA B: Verificar resposta HTTP.
     */
    etapaGestores = "validar_status_rest";

    if (!r.ok) {
      console.error(
        "verificar-gestor: consulta a gestores HTTP",
        r.status
      );

      return resposta(500, {
        erro: "Não foi possível verificar o acesso."
      });
    }

    /*
     * ETAPA C: Ler a resposta JSON.
     */
    etapaGestores = "ler_json_rest";

    const linhas = await r.json();

    /*
     * ETAPA D: Confirmar cadastro do gestor.
     */
    etapaGestores = "validar_cadastro";

    if (
      !Array.isArray(linhas) ||
      linhas.length !== 1
    ) {
      return resposta(403, {
        erro: "Acesso não autorizado."
      });
    }

  } catch (err) {
    /*
     * Diagnostico detalhado do erro.
     * Nao devolve dados sensiveis ao navegador.
     */
    registrarErro(
      etapaGestores,
      err
    );

    return resposta(500, {
      erro: "Não foi possível verificar o acesso."
    });
  }

  /*
   * 11. GESTOR AUTORIZADO
   */
  return resposta(200, {
    autorizado: true
  });
};
