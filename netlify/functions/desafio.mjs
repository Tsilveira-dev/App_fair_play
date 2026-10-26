
/*
 * Fair Play — desafio.mjs
 * Exclusivo do ambiente de TESTE.
 *
 * GET: listar desafios registrados.
 * POST { acao: "aceitar" }: aceitar o desafio do dia.
 * POST { acao: "concluir" }: confirmar conclusão.
 *
 * 20 pontos por desafio concluído.
 * O cronômetro não conclui desafios.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responder(statusCode, dados) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(dados)
  };
}

function lerConfig() {
  const ambiente = lerAmbienteSupabase();

  const publica = (
    process.env.SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  const secreta = (
    process.env.SUPABASE_SECRET_KEY || ""
  ).trim();

  if (
    ambiente.erro ||
    !publica ||
    !secreta ||
    publica.startsWith("sb_secret_") ||
    publica === secreta
  ) {
    return null;
  }

  return {
    url: ambiente.url,
    publica,
    secreta
  };
}

function obterToken(headers = {}) {
  const valor = (
    headers.authorization ||
    headers.Authorization ||
    ""
  ).trim();

  const resultado =
    /^Bearer\s+([A-Za-z0-9._-]{10,4096})$/i.exec(valor);

  return resultado?.[1] || null;
}

async function requisicao(url, opcoes = {}) {
  const controlador = new AbortController();

  const timer = setTimeout(
    () => controlador.abort(),
    8000
  );

  try {
    return await fetch(url, {
      ...opcoes,
      signal: controlador.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function consultarTabela(
  cfg,
  tabela,
  filtros = {},
  metodo = "GET",
  corpo
) {
  const url = new URL(
    `${cfg.url}/rest/v1/${tabela}`
  );

  for (const [campo, valor] of Object.entries(filtros)) {
    url.searchParams.set(campo, String(valor));
  }

  const headers = {
    apikey: cfg.secreta,
    Accept: "application/json"
  };

  if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = "return=representation";
  }

  const resultado = await requisicao(
    url.toString(),
    {
      method: metodo,
      headers,
      ...(corpo !== undefined
        ? { body: JSON.stringify(corpo) }
        : {})
    }
  );

  if (!resultado.ok) {
    const erro = new Error("Falha na consulta ao banco");
    erro.status = resultado.status;
    throw erro;
  }

  const dados = await resultado.json();

  if (!Array.isArray(dados)) {
    throw new Error("Resposta inesperada do banco");
  }

  return dados;
}

function hojeFortaleza() {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const valor = tipo =>
    partes.find(p => p.type === tipo)?.value;

  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function dataUTC(iso) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function diaDoTeste(inicio) {
  return Math.round(
    (dataUTC(hojeFortaleza()) - dataUTC(inicio)) /
    86400000
  ) + 1;
}

async function autenticar(cfg, token) {
  const r = await requisicao(
    `${cfg.url}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        apikey: cfg.publica,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (r.status === 401 || r.status === 403) {
    return null;
  }

  if (!r.ok) {
    throw new Error("Falha na autenticação");
  }

  const usuario = await r.json();

  const anonimo =
    usuario?.is_anonymous === true ||
    usuario?.app_metadata?.provider === "anonymous";

  return UUID.test(usuario?.id || "") && anonimo
    ? usuario.id
    : null;
}

async function contextoParticipante(cfg, usuarioId) {
  const sessoes = await consultarTabela(
    cfg,
    "sessoes_participantes",
    {
      select: "participante_id,expira_em",
      usuario_auth_id: `eq.${usuarioId}`,
      status: "eq.aprovada",
      order: "autorizado_em.desc",
      limit: 1
    }
  );

  const sessao = sessoes[0];

  if (
    !sessao ||
    !sessao.expira_em ||
    Date.parse(sessao.expira_em) <= Date.now()
  ) {
    return null;
  }

  const [participantes, configuracoes] =
    await Promise.all([
      consultarTabela(
        cfg,
        "participantes",
        {
          select: "id,ativo",
          id: `eq.${sessao.participante_id}`,
          limit: 1
        }
      ),
      consultarTabela(
        cfg,
        "configuracao_teste",
        {
          select: "data_inicio,ativo",
          id: "eq.1",
          limit: 1
        }
      )
    ]);

  if (
    participantes[0]?.ativo !== true ||
    configuracoes[0]?.ativo !== true
  ) {
    return null;
  }

  const inicio = configuracoes[0].data_inicio;

  if (
    typeof inicio !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(inicio)
  ) {
    return null;
  }

  return {
    participanteId: sessao.participante_id,
    dia: diaDoTeste(inicio)
  };
}

async function listarDesafios(cfg, participanteId) {
  return consultarTabela(
    cfg,
    "desafios_registros",
    {
      select:
        "dia_numero,codigo_desafio,nivel_atribuido,status,oferecido_em,aceito_em,concluido_em",
      participante_id: `eq.${participanteId}`,
      order: "dia_numero.asc",
      limit: 7
    }
  );
}

/* Catálogo 2026.1 — códigos por dia e nível. */
const CODIGOS_DESAFIOS = {
  1: {
    baixo: 'D01_BAIXO_ROTINA',
    moderado: 'D01_MODERADO_PAUSA',
    alto: 'D01_ALTO_ATIVIDADE',
    neutro: 'D01_NEUTRO'
  },
  2: {
    baixo: 'D02_BAIXO_ORGANIZACAO',
    moderado: 'D02_MODERADO_FOCO',
    alto: 'D02_ALTO_ETAPAS',
    neutro: 'D02_NEUTRO'
  },
  3: {
    baixo: 'D03_BAIXO_HORARIO',
    moderado: 'D03_MODERADO_DESCANSO',
    alto: 'D03_ALTO_SEM_TELAS',
    neutro: 'D03_NEUTRO'
  },
  4: {
    baixo: 'D04_BAIXO_PAUSA',
    moderado: 'D04_MODERADO_ALONGAMENTO',
    alto: 'D04_ALTO_OUTRA_ATIVIDADE',
    neutro: 'D04_NEUTRO'
  },
  5: {
    baixo: 'D05_BAIXO_LAZER',
    moderado: 'D05_MODERADO_ATIVIDADE',
    alto: 'D05_ALTO_SEM_JOGOS',
    neutro: 'D05_NEUTRO'
  },
  6: {
    baixo: 'D06_BAIXO_EMOCOES',
    moderado: 'D06_MODERADO_RESPIRAR',
    alto: 'D06_ALTO_RELAXAR',
    neutro: 'D06_NEUTRO'
  },
  7: {
    baixo: 'D07_BAIXO_ROTINA',
    moderado: 'D07_MODERADO_PLANEJAMENTO',
    alto: 'D07_ALTO_PRIORIDADE',
    neutro: 'D07_NEUTRO'
  }
};

async function determinarNivel(cfg, participanteId, dia) {
  // Somente o check-in DESTE DIA define o desafio.
  // Sem classificação suficiente: desafio neutro.
  const registros = await consultarTabela(
    cfg,
    'checkins',
    {
      select: 'nivel',
      participante_id: `eq.${participanteId}`,
      dia_numero: `eq.${dia}`,
      limit: 1
    }
  );

  const nivel = registros[0]?.nivel;

  return ['baixo', 'moderado', 'alto'].includes(nivel)
    ? nivel
    : null;
}

function codigoDoDesafio(dia, nivel) {
  const codigo = CODIGOS_DESAFIOS[dia]?.[nivel || 'neutro'];

  if (!codigo) {
    throw new Error(
      'Catálogo de desafios inválido para este dia.'
    );
  }

  return codigo;
}

async function aceitar(cfg, contexto) {
  const { participanteId, dia } = contexto;

  const existentes = await consultarTabela(
    cfg,
    "desafios_registros",
    {
      select: "id,status",
      participante_id: `eq.${participanteId}`,
      dia_numero: `eq.${dia}`,
      limit: 1
    }
  );

  if (existentes.length) {
    return responder(409, {
      erro: "Já existe um desafio registrado para hoje."
    });
  }

  const nivel = await determinarNivel(
    cfg,
    participanteId,
    dia
  );

  const codigo = codigoDoDesafio(dia, nivel);

  let registros;

  try {
    registros = await consultarTabela(
      cfg,
      "desafios_registros",
      {},
      "POST",
      {
        participante_id: participanteId,
        dia_numero: dia,
        codigo_desafio: codigo,
        nivel_atribuido: nivel,
        status: "aceito",
        aceito_em: new Date().toISOString()
      }
    );
  } catch (erro) {
    if (erro.status === 409) {
      return responder(409, {
        erro: "Já existe um desafio registrado para hoje."
      });
    }

    throw erro;
  }

  return responder(201, {
    desafio: registros[0],
    pontos: 0
  });
}

async function concluir(cfg, contexto) {
  const { participanteId, dia } = contexto;

  const registros = await consultarTabela(
    cfg,
    "desafios_registros",
    {
      participante_id: `eq.${participanteId}`,
      dia_numero: `eq.${dia}`,
      status: "eq.aceito"
    },
    "PATCH",
    {
      status: "concluido",
      concluido_em: new Date().toISOString()
    }
  );

  if (!registros.length) {
    return responder(409, {
      erro:
        "Não existe desafio aceito aguardando conclusão hoje."
    });
  }

  return responder(200, {
    desafio: registros[0],
    pontos: 20
  });
}

export const handler = async event => {
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return responder(405, {
      erro: "Método não permitido."
    });
  }

  const cfg = lerConfig();

  if (!cfg) {
    return responder(500, {
      erro: "Configuração indisponível."
    });
  }

  const token = obterToken(event.headers);

  if (!token) {
    return responder(401, {
      erro: "Sessão ausente."
    });
  }

  try {
    const usuarioId = await autenticar(cfg, token);

    if (!usuarioId) {
      return responder(401, {
        erro: "Sessão inválida."
      });
    }

    const contexto = await contextoParticipante(
      cfg,
      usuarioId
    );

    if (!contexto) {
      return responder(403, {
        erro: "Participação não autorizada."
      });
    }

    if (event.httpMethod === "GET") {
      const desafios = await listarDesafios(
        cfg,
        contexto.participanteId
      );

      return responder(200, { desafios });
    }

    if (contexto.dia < 1 || contexto.dia > 7) {
      return responder(403, {
        erro: "Desafios fora do período permitido."
      });
    }

    if (
      !event.body ||
      Buffer.byteLength(event.body, "utf8") > 1024
    ) {
      return responder(400, {
        erro: "Dados inválidos."
      });
    }

    let dados;

    try {
      dados = JSON.parse(
        event.isBase64Encoded
          ? Buffer.from(
              event.body,
              "base64"
            ).toString("utf8")
          : event.body
      );
    } catch {
      return responder(400, {
        erro: "JSON inválido."
      });
    }

    if (dados?.acao === "aceitar") {
      return await aceitar(cfg, contexto);
    }

    if (dados?.acao === "concluir") {
      return await concluir(cfg, contexto);
    }

    return responder(400, {
      erro: "Ação inválida."
    });

  } catch (erro) {
    console.error("desafio: falha", {
      tipo: erro?.name || "Erro",
      status: erro?.status || null
    });

    return responder(500, {
      erro: "Não foi possível processar o desafio."
    });
  }
};
