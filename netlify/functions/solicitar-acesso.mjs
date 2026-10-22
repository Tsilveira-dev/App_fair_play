
/*
 * Fair Play — solicitar-acesso.mjs
 * Recebe solicitações de estudantes.
 * NÃO aprova o acesso automaticamente.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const reply = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: { ...JSON_HEADERS, ...extraHeaders },
  body: body === undefined ? '' : JSON.stringify(body)
});

const GENERIC = {
  mensagem: 'Solicitação recebida. Aguarde a orientação da equipe.'
};

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

function config() {
  const url = (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  const publicKey =
    (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

  const secretKey =
    (process.env.SUPABASE_SECRET_KEY || '').trim();

  if (
    !/^https:\/\/[^\s/]+$/.test(url) ||
    !publicKey ||
    !secretKey
  ) {
    throw new Error('Configuracao do Supabase indisponivel');
  }

  return { url, publicKey, secretKey };
}

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

function bearer(headers = {}) {
  const raw =
    headers.authorization ||
    headers.Authorization ||
    '';

  const match =
    /^Bearer\s+([A-Za-z0-9._-]{10,4096})$/.exec(raw.trim());

  return match ? match[1] : null;
}

async function verifyAnonymousUser(cfg, token) {
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
    throw new Error(`Auth HTTP ${response.status}`);
  }

  const user = await response.json();

  if (!UUID.test(user?.id || '')) {
    return null;
  }

  const anonymous =
    user.is_anonymous === true ||
    user.app_metadata?.provider === 'anonymous';

  return anonymous ? user : false;
}

/*
 * Consultas ao banco acontecem no servidor.
 * A chave secreta não é enviada ao navegador.
 */
async function db(
  cfg,
  table,
  method = 'GET',
  params = {},
  data
) {
  const url = new URL(
    `${cfg.url}/rest/v1/${table}`
  );

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const headers = {
    apikey: cfg.secretKey,
    Accept: 'application/json',
    ...(method !== 'GET'
      ? { Prefer: 'return=minimal' }
      : {}),
    ...(data !== undefined
      ? { 'Content-Type': 'application/json' }
      : {})
  };

  const response = await request(url, {
    method,
    headers,
    ...(data !== undefined
      ? { body: JSON.stringify(data) }
      : {})
  });

  if (!response.ok) {
    let code = '';

    try {
      code = (await response.json())?.code || '';
    } catch {
      // Ignora corpo inválido de erro.
    }

    const err = new Error(
      `Database HTTP ${response.status}`
    );

    err.code = code;
    throw err;
  }

  if (method !== 'GET') {
    return [];
  }

  return response.json();
}

/*
 * Validação do primeiro nome.
 * Utiliza a regra de chave do cadastro.
 */
function parseInput(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(
        event.body || '',
        'base64'
      ).toString('utf8')
    : event.body || '';

  if (
    !raw ||
    Buffer.byteLength(raw, 'utf8') > 1024
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
    typeof body !== 'object'
  ) {
    return null;
  }

  if (typeof body.nome !== 'string') {
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
    !['individual', 'compartilhado']
      .includes(body.tipo_dispositivo)
  ) {
    return null;
  }

  const formatted =
    name.charAt(0).toLocaleUpperCase('pt-BR') +
    name.slice(1).toLocaleLowerCase('pt-BR');

  const nameKey = formatted
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}]/gu, '');

  if (nameKey.length < 2) {
    return null;
  }

  return {
    nameKey,
    device: body.tipo_dispositivo
  };
}

/*
 * Registra a solicitação pendente.
 * Não troca a identidade de um participante.
 */
async function register(
  cfg,
  userId,
  { nameKey, device }
) {
  const [sessions, participants] =
    await Promise.all([
      db(
        cfg,
        'sessoes_participantes',
        'GET',
        {
          select: 'id,participante_id,status',
          usuario_auth_id: `eq.${userId}`,
          limit: '1'
        }
      ),

      db(
        cfg,
        'participantes',
        'GET',
        {
          select: 'id',
          nome_chave: `eq.${nameKey}`,
          ativo: 'eq.true',
          limit: '1'
        }
      )
    ]);

  const participant = participants[0];

  if (!participant) {
    return;
  }

  const existing = sessions[0];

  if (existing) {
    // Não permite trocar de participante
    // usando a mesma identidade.
    if (
      existing.participante_id !== participant.id
    ) {
      return;
    }

    if (existing.status !== 'recusada') {
      return;
    }

    // Reabre solicitação recusada,
    // preservando UID e participante.
    try {
      await db(
        cfg,
        'sessoes_participantes',
        'PATCH',
        {
          id: `eq.${existing.id}`,
          status: 'eq.recusada'
        },
        {
          status: 'pendente',
          tipo_dispositivo: device,
          solicitado_em: new Date().toISOString(),
          autorizado_em: null,
          autorizado_por: null,
          expira_em: null,
          revogado_em: null
        }
      );
    } catch (e) {
      if (e.code !== '23505') {
        throw e;
      }
    }

    return;
  }

  // Cria nova solicitação pendente.
  try {
    await db(
      cfg,
      'sessoes_participantes',
      'POST',
      {},
      {
        participante_id: participant.id,
        usuario_auth_id: userId,
        tipo_dispositivo: device,
        status: 'pendente',
        solicitado_em: new Date().toISOString()
      }
    );
  } catch (e) {
    // Impede duplicidade quando duas
    // solicitações chegam simultaneamente.
    if (e.code !== '23505') {
      throw e;
    }
  }
}

/*
 * Entrada principal da Netlify Function.
 */
export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return reply(
      204,
      undefined,
      { Allow: 'POST, OPTIONS' }
    );
  }

  if (event.httpMethod !== 'POST') {
    return reply(
      405,
      { erro: 'Metodo nao permitido.' },
      { Allow: 'POST, OPTIONS' }
    );
  }

  const token = bearer(event.headers);

  if (!token) {
    return reply(
      401,
      { erro: 'Sessao ausente.' }
    );
  }

  const input = parseInput(event);

  if (!input) {
    return reply(
      400,
      {
        erro: 'Nome ou tipo de dispositivo invalido.'
      }
    );
  }

  try {
    const cfg = config();

    // Confirma autenticação anônima.
    const user =
      await verifyAnonymousUser(cfg, token);

    if (user === null) {
      return reply(
        401,
        {
          erro: 'Sessao invalida ou expirada.'
        }
      );
    }

    if (user === false) {
      return reply(
        403,
        {
          erro: 'Esta conta nao pode solicitar acesso.'
        }
      );
    }

    // Solicita acesso, sem aprovar.
    await register(cfg, user.id, input);

    // A mesma resposta é usada para
    // nomes existentes e inexistentes.
    return reply(202, GENERIC);

  } catch (e) {
    console.error(
      'solicitar-acesso:',
      e instanceof Error
        ? e.message
        : 'erro inesperado'
    );

    return reply(
      500,
      {
        erro: 'Nao foi possivel processar a solicitacao.'
      }
    );
  }
};
