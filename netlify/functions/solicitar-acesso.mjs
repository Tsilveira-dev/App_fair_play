import { chavePublicavelValida } from "../lib/seguranca.mjs";

/*
 * Fair Play - Netlify Function: solicitar-acesso
 *
 * Ambiente validado no servidor (TESTE ou ORIGINAL).
 *
 * Recebe solicitações dos estudantes.
 * Não aprova acessos automaticamente.
 *
 * Proteções:
 * - Supabase validado por ambiente.
 * - Autenticação anônima obrigatória.
 * - Intervalo de 30 segundos por usuário.
 * - Máximo de 10 solicitações por usuário/hora.
 * - Máximo geral de 300 solicitações/hora.
 *
 * A chave secreta permanece no servidor.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const reply = (
  statusCode,
  body,
  extraHeaders = {}
) => ({
  statusCode,
  headers: {
    ...JSON_HEADERS,
    ...extraHeaders
  },
  body: body === undefined
    ? ""
    : JSON.stringify(body)
});

const GENERIC = {
  mensagem:
    "Solicitação recebida. Aguarde a orientação da equipe."
};

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/*
 * 1. CONFIGURAÇÃO SEGURA
 *
 * Garante que a URL pertence ao
 * Supabase de TESTES.
 */
function config() {
  const ambiente = lerAmbienteSupabase();

  if (ambiente.erro) {
    throw new Error(
      `Ambiente Supabase inválido: ${ambiente.erro}`
    );
  }

  const publicKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const secretKey = (
    process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  if (
    !publicKey ||
    !secretKey ||
    !chavePublicavelValida(publicKey) ||
    publicKey === secretKey
  ) {
    throw new Error(
      "Configuração das chaves do Supabase inválida"
    );
  }

  return {
    url: ambiente.url,
    publicKey,
    secretKey
  };
}

/*
 * 2. REQUISIÇÕES COM TEMPO LIMITE
 */
async function request(url, options) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    8000
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

/*
 * 3. EXTRAIR TOKEN
 */
function bearer(headers = {}) {
  const raw =
    headers.authorization ||
    headers.Authorization ||
    "";

  const match =
    /^Bearer\s+([A-Za-z0-9._-]{10,4096})$/i.exec(
      raw.trim()
    );

  return match ? match[1] : null;
}

/*
 * 4. VALIDAR AUTENTICAÇÃO ANÔNIMA
 */
async function verifyAnonymousUser(
  cfg,
  token
) {
  const response = await request(
    `${cfg.url}/auth/v1/user`,
    {
      headers: {
        apikey: cfg.publicKey,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Auth HTTP ${response.status}`
    );
  }

  const user = await response.json();

  if (!UUID.test(user?.id || "")) {
    return null;
  }

  const anonymous =
    user.is_anonymous === true ||
    user.app_metadata?.provider === "anonymous";

  return anonymous ? user : false;
}

/*
 * 5. ACESSO AO BANCO
 *
 * A chave secreta nunca é enviada
 * ao navegador do estudante.
 */
async function db(
  cfg,
  table,
  method = "GET",
  params = {},
  data
) {
  const url = new URL(
    `${cfg.url}/rest/v1/${table}`
  );

  for (
    const [key, value]
    of Object.entries(params)
  ) {
    url.searchParams.set(
      key,
      value
    );
  }

  const headers = {
    apikey: cfg.secretKey,
    Accept: "application/json",

    ...(method !== "GET"
      ? {
          Prefer: "return=minimal"
        }
      : {}),

    ...(data !== undefined
      ? {
          "Content-Type": "application/json"
        }
      : {})
  };

  const response = await request(
    url.toString(),
    {
      method,
      headers,

      ...(data !== undefined
        ? {
            body: JSON.stringify(data)
          }
        : {})
    }
  );

  if (!response.ok) {
    let code = "";

    try {
      code =
        (await response.json())?.code || "";
    } catch {
      // Não expõe detalhes do banco.
    }

    const error = new Error(
      `Database HTTP ${response.status}`
    );

    error.code = code;

    throw error;
  }

  return method === "GET"
    ? response.json()
    : [];
}

/*
 * 6. VALIDAR NOME E DISPOSITIVO
 */
function parseInput(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(
        event.body || "",
        "base64"
      ).toString("utf8")
    : event.body || "";

  if (
    !raw ||
    Buffer.byteLength(
      raw,
      "utf8"
    ) > 1024
  ) {
    return null;
  }

  let body;

  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== "object"
  ) {
    return null;
  }

  if (
    typeof body.nome !== "string"
  ) {
    return null;
  }

  const name = body.nome.trim();

  if (
    name.length < 2 ||
    name.length > 40 ||
    /\s/.test(name)
  ) {
    return null;
  }

  if (!/^\p{L}[\p{L}'’-]*$/u.test(name)) {
    return null;
  }

  if (
    ![
      "individual",
      "compartilhado"
    ].includes(body.tipo_dispositivo)
  ) {
    return null;
  }

  const formatted =
    name.charAt(0).toLocaleUpperCase("pt-BR") +
    name.slice(1).toLocaleLowerCase("pt-BR");

  const nameKey = formatted
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}]/gu, "");

  if (nameKey.length < 2) {
    return null;
  }

  return {
    nameKey,
    device: body.tipo_dispositivo
  };
}

/*
 * 7. CONTROLE DE TENTATIVAS
 *
 * Consulta a tabela:
 * public.solicitacoes_tentativas
 *
 * Regras:
 * - 30 segundos entre solicitações.
 * - Máximo de 10 por usuário/hora.
 * - Máximo geral de 300/hora.
 *
 * O registro acontece antes da
 * solicitação ser processada.
 */
async function registrarTentativaSePermitida(cfg, userId) {
  const r = await request(`${cfg.url}/rest/v1/rpc/registrar_tentativa_acesso`, {
    method: "POST",
    headers: {
      apikey: cfg.secretKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_usuario: userId })
  });
  if (!r.ok) throw new Error(`Limite de acesso HTTP ${r.status}`);
  const limite = await r.json();
  if (typeof limite?.bloqueado !== "boolean" ||
      (limite.bloqueado && (!Number.isInteger(limite.espera) || limite.espera < 1))) {
    throw new Error("Resposta inválida do limite de acesso");
  }
  return limite;
}

/*
 * 8. REGISTRAR SOLICITAÇÃO PENDENTE
 *
 * Não autoriza automaticamente.
 * Não permite trocar a identidade
 * vinculada ao mesmo UID.
 */
async function register(
  cfg,
  userId,
  { nameKey, device }
) {
  const [
    sessions,
    participants
  ] = await Promise.all([
    db(
      cfg,
      "sessoes_participantes",
      "GET",
      {
        select:
          "id,participante_id,status",
        usuario_auth_id:
          `eq.${userId}`,
        limit: "1"
      }
    ),

    db(
      cfg,
      "participantes",
      "GET",
      {
        select: "id",
        nome_chave:
          `eq.${nameKey}`,
        ativo: "eq.true",
        limit: "1"
      }
    )
  ]);

  const participant =
    participants[0];

  if (!participant) {
    return;
  }

  const existing =
    sessions[0];

  if (existing) {
    /*
     * Impede troca de participante
     * usando a mesma identidade.
     */
    if (
      existing.participante_id !==
      participant.id
    ) {
      return;
    }

    if (
      existing.status !== "recusada"
    ) {
      return;
    }

    /*
     * Reabre solicitação recusada.
     */
    try {
      await db(
        cfg,
        "sessoes_participantes",
        "PATCH",
        {
          id: `eq.${existing.id}`,
          status: "eq.recusada"
        },
        {
          status: "pendente",
          tipo_dispositivo: device,
          solicitado_em:
            new Date().toISOString(),
          autorizado_em: null,
          autorizado_por: null,
          expira_em: null,
          revogado_em: null
        }
      );
    } catch (error) {
      if (
        error.code !== "23505"
      ) {
        throw error;
      }
    }

    return;
  }

  /*
   * Cria solicitação pendente.
   */
  try {
    await db(
      cfg,
      "sessoes_participantes",
      "POST",
      {},
      {
        participante_id:
          participant.id,
        usuario_auth_id:
          userId,
        tipo_dispositivo:
          device,
        status: "pendente",
        solicitado_em:
          new Date().toISOString()
      }
    );
  } catch (error) {
    /*
     * Impede duplicidade em
     * solicitações simultâneas.
     */
    if (
      error.code !== "23505"
    ) {
      throw error;
    }
  }
}

/*
 * 9. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {
  if (
    event.httpMethod === "OPTIONS"
  ) {
    return reply(
      204,
      undefined,
      {
        Allow: "POST, OPTIONS"
      }
    );
  }

  if (
    event.httpMethod !== "POST"
  ) {
    return reply(
      405,
      {
        erro: "Método não permitido."
      },
      {
        Allow: "POST, OPTIONS"
      }
    );
  }

  const token = bearer(
    event.headers
  );

  if (!token) {
    return reply(
      401,
      {
        erro: "Sessão ausente."
      }
    );
  }

  const input = parseInput(
    event
  );

  if (!input) {
    return reply(
      400,
      {
        erro:
          "Nome ou tipo de dispositivo inválido."
      }
    );
  }

  try {
    /*
     * 9.1. Confirmar ambiente de TESTE.
     */
    const cfg = config();

    /*
     * 9.2. Validar identidade anônima.
     */
    const user =
      await verifyAnonymousUser(
        cfg,
        token
      );

    if (user === null) {
      return reply(
        401,
        {
          erro:
            "Sessão inválida ou expirada."
        }
      );
    }

    if (user === false) {
      return reply(
        403,
        {
          erro:
            "Esta conta não pode solicitar acesso."
        }
      );
    }

    /*
     * 9.3. Verificar e registrar tentativa.
     */
    const limite =
      await registrarTentativaSePermitida(
        cfg,
        user.id
      );

    if (limite.bloqueado) {
      return reply(
        429,
        {
          erro:
            limite.motivo === "intervalo"
              ? "Aguarde um pouco antes de tentar novamente."
              : "Muitas solicitações. Tente mais tarde."
        },
        {
          "Retry-After":
            String(limite.espera)
        }
      );
    }

    /*
     * 9.4. Solicitar acesso.
     * A aprovação continua dependendo
     * da equipe gestora.
     */
    await register(
      cfg,
      user.id,
      input
    );

    return reply(
      202,
      GENERIC
    );

  } catch (error) {
    console.error(
      "solicitar-acesso:",
      error instanceof Error
        ? error.message
        : "erro inesperado"
    );

    return reply(
      500,
      {
        erro:
          "Não foi possível processar a solicitação."
      }
    );
  }
};
