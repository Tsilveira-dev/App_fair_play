import { chavePublicavelValida, dataValida } from "../lib/seguranca.mjs";

/*
 * Fair Play — Netlify Function: checkin
 * Ambiente validado no servidor (TESTE ou ORIGINAL).
 *
 * GET: lê os check-ins do participante autenticado.
 * POST: grava um check-in com pontuação calculada
 *       no servidor, sem confiar no cálculo do navegador.
 */

import { lerAmbienteSupabase } from "../lib/ambiente.mjs";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

function resposta(statusCode, dados) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify(dados)
  };
}

const UUID =
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

/*
 * Pontuação das alternativas do catálogo 2026.1.
 * Os índices seguem a ordem das perguntas e alternativas.
 *
 * i = informativa
 * n = não aplicável
 */
const CODIGOS = [
  [
    ["i","i","i","i"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    ["i","i","i"]
  ],
  [
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,"i",2,"n"],
    [0,1,2,"n"]
  ],
  [
    [0,1,2,"n"],
    [0,1,2,"n"],
    ["i","i","i"],
    ["i","i","i"],
    [0,1,2,"n"]
  ],
  [
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"]
  ],
  [
    ["i","i","i","n"],
    [0,1,2,"n"],
    ["i","i","i"],
    [0,1,1,"n"],
    [0,0,2,"n"]
  ],
  [
    ["i","i","i","n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    [0,1,2,"n"],
    ["i","i","i","n"]
  ],
  [
    [0,1,2,"n"],
    [0,1,"i","n"],
    [0,"i",2,"n"],
    [0,1,2,"n"],
    ["i","i","i","i"]
  ]
];

async function requisitar(url, opcoes) {
  const controle = new AbortController();

  const timer = setTimeout(
    () => controle.abort(),
    8000
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

function configuracao() {
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
    !chavePublicavelValida(publica) ||
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

function tokenDoEvento(event) {
  const cabecalho = (
    event.headers?.authorization ||
    event.headers?.Authorization ||
    ""
  ).trim();

  const match =
    /^Bearer\s+([A-Za-z0-9._-]{10,4096})$/i
      .exec(cabecalho);

  return match?.[1] || null;
}

async function tabela(
  cfg,
  nome,
  parametros = {},
  metodo = "GET",
  corpo
) {
  const url = new URL(
    `${cfg.url}/rest/v1/${nome}`
  );

  for (const [chave, valor] of Object.entries(parametros)) {
    url.searchParams.set(
      chave,
      String(valor)
    );
  }

  const r = await requisitar(
    url.toString(),
    {
      method: metodo,
      headers: {
        apikey: cfg.secreta,
        Accept: "application/json",
        ...(corpo !== undefined
          ? {
              "Content-Type": "application/json",
              Prefer: "return=representation"
            }
          : {})
      },
      ...(corpo !== undefined
        ? { body: JSON.stringify(corpo) }
        : {})
    }
  );

  if (!r.ok) {
    const erro = new Error(
      "Consulta ao banco falhou"
    );

    erro.status = r.status;
    throw erro;
  }

  const dados = await r.json();

  if (!Array.isArray(dados)) {
    throw new Error(
      "Resposta inválida do banco"
    );
  }

  return dados;
}

function dataFortaleza() {
  const partes = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).formatToParts(new Date());

  const pegar = nome =>
    partes.find(
      parte => parte.type === nome
    )?.value;

  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

function diaUTC(iso) {
  const [ano, mes, dia] =
    iso.split("-").map(Number);

  return Date.UTC(
    ano,
    mes - 1,
    dia
  );
}

function somarDias(iso, quantidade) {
  return new Date(
    diaUTC(iso) + quantidade * 86400000
  ).toISOString().slice(0, 10);
}

function numeroDia(inicio) {
  const diferenca =
    diaUTC(dataFortaleza()) -
    diaUTC(inicio);

  return Math.round(
    diferenca / 86400000
  ) + 1;
}

/*
 * Confere os IDs e calcula a pontuação.
 * Não aceita pontuação fornecida pelo estudante.
 */
function converterRespostas(
  dia,
  alternativas
) {
  if (
    !Array.isArray(alternativas) ||
    alternativas.length !== 5
  ) {
    return null;
  }

  const respostas = [];
  let soma = 0;
  let aplicaveis = 0;

  for (let i = 0; i < 5; i++) {
    const id = alternativas[i];

    const pergunta =
      `D${String(dia).padStart(2, "0")}_P${i + 1}`;

    if (typeof id !== "string") {
      return null;
    }

    const padrao = new RegExp(
      `^${pergunta}_A([1-9][0-9]*)$`
    );

    const match = padrao.exec(id);

    if (!match) {
      return null;
    }

    const indice =
      Number(match[1]) - 1;

    const codigo =
      CODIGOS[dia - 1]?.[i]?.[indice];

    if (codigo === undefined) {
      return null;
    }

    const tipo =
      typeof codigo === "number"
        ? "pontuavel"
        : codigo === "i"
          ? "informativa"
          : "nao_aplicavel";

    if (typeof codigo === "number") {
      soma += codigo;
      aplicaveis++;
    }

    respostas.push({
      pergunta,
      alternativa: id,
      tipo,
      valor:
        typeof codigo === "number"
          ? codigo
          : null
    });
  }

  const pontuacao =
    aplicaveis < 3
      ? null
      : Math.round(
          (soma / (2 * aplicaveis)) * 10
        );

  const nivel =
    pontuacao === null
      ? null
      : pontuacao <= 3
        ? "baixo"
        : pontuacao <= 7
          ? "moderado"
          : "alto";

  return {
    respostas,
    pontuacao,
    nivel
  };
}

/*
 * ENTRADA PRINCIPAL
 */
export const handler = async event => {
  if (
    !["GET", "POST"]
      .includes(event.httpMethod)
  ) {
    return resposta(405, {
      erro: "Método não permitido."
    });
  }

  const cfg = configuracao();

  if (!cfg) {
    return resposta(500, {
      erro: "Configuração indisponível."
    });
  }

  const token = tokenDoEvento(event);

  if (!token) {
    return resposta(401, {
      erro: "Sessão ausente."
    });
  }

  try {
    /*
     * Confirmar usuário no Supabase Auth.
     */
    const auth = await requisitar(
      `${cfg.url}/auth/v1/user`,
      {
        method: "GET",
        headers: {
          apikey: cfg.publica,
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (
      auth.status === 401 ||
      auth.status === 403
    ) {
      return resposta(401, {
        erro: "Sessão inválida."
      });
    }

    if (!auth.ok) {
      throw new Error(
        "Auth indisponível"
      );
    }

    const usuario = await auth.json();

    const identidadeAnonima =
      usuario?.is_anonymous === true ||
      usuario?.app_metadata?.provider ===
        "anonymous";

    if (
      !UUID.test(usuario?.id || "") ||
      !identidadeAnonima
    ) {
      return resposta(403, {
        erro: "Identidade não autorizada."
      });
    }

    /*
     * Encontrar sessão autorizada deste UID.
     */
    const sessoes = await tabela(
      cfg,
      "sessoes_participantes",
      {
        select:
          "participante_id,status,expira_em",
        usuario_auth_id:
          `eq.${usuario.id}`,
        limit: 1
      }
    );

    const sessao = sessoes[0];

    const validade = Date.parse(
      sessao?.expira_em
    );

    if (
      !sessao ||
      sessao.status !== "aprovada" ||
      !sessao.expira_em ||
      !Number.isFinite(validade) ||
      validade <= Date.now()
    ) {
      return resposta(403, {
        erro:
          "Acesso não autorizado ou expirado."
      });
    }

    /*
     * Confirmar participante e período.
     */
    const [participantes, periodos] =
      await Promise.all([
        tabela(
          cfg,
          "participantes",
          {
            select: "id,ativo",
            id: `eq.${sessao.participante_id}`,
            limit: 1
          }
        ),
        tabela(
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
      periodos[0]?.ativo !== true
    ) {
      return resposta(403, {
        erro: "Participação indisponível."
      });
    }

    const inicio =
      periodos[0].data_inicio;

    if (
      !dataValida(inicio)
    ) {
      return resposta(500, {
        erro: "Período inválido."
      });
    }

    const diaAtual =
      numeroDia(inicio);

    /*
     * GET: buscar check-ins do próprio
     * participante, no máximo sete.
     */
    if (diaAtual > 8) {
      return resposta(403, { erro: "Fora do período permitido." });
    }

    if (event.httpMethod === "GET") {
      const registros = await tabela(
        cfg,
        "checkins",
        {
          select:
            "dia_numero,respostas,pontuacao,nivel,enviado_atrasado,primeiro_envio_em",
          participante_id:
            `eq.${sessao.participante_id}`,
          order: "dia_numero.asc",
          limit: 7
        }
      );

      return resposta(200, {
        checkins: registros
      });
    }

    /*
     * POST: determinar o dia no servidor.
     * No Dia 8 só é permitido recuperar
     * o check-in do Dia 7.
     */
    if (
      diaAtual < 1 ||
      diaAtual > 8
    ) {
      return resposta(403, {
        erro: "Fora do período permitido."
      });
    }

    const diaAlvo =
      Math.min(diaAtual, 7);

    if (
      !event.body ||
      Buffer.byteLength(
        event.body,
        "utf8"
      ) > 4096
    ) {
      return resposta(400, {
        erro: "Dados inválidos."
      });
    }

    let corpo;

    try {
      const texto = event.isBase64Encoded
        ? Buffer.from(
            event.body,
            "base64"
          ).toString("utf8")
        : event.body;

      corpo = JSON.parse(texto);
    } catch {
      return resposta(400, {
        erro: "JSON inválido."
      });
    }

    const validacao =
      converterRespostas(
        diaAlvo,
        corpo?.respostas
      );

    if (!validacao) {
      return resposta(400, {
        erro: "Respostas inválidas."
      });
    }

    /*
     * A restrição UNIQUE no banco
     * impede check-ins duplicados.
     */
    let inseridos;

    try {
      inseridos = await tabela(
        cfg,
        "checkins",
        {},
        "POST",
        {
          participante_id:
            sessao.participante_id,
          dia_numero: diaAlvo,
          data_referencia:
            somarDias(
              inicio,
              diaAlvo - 1
            ),
          ...validacao,
          enviado_atrasado:
            diaAtual === 8
        }
      );
    } catch (erro) {
      if (erro.status === 409) {
        return resposta(409, {
          erro:
            "Check-in já registrado."
        });
      }

      throw erro;
    }

    const registro = inseridos[0];

    if (!registro) {
      throw new Error(
        "Inserção sem confirmação"
      );
    }

    return resposta(201, {
      checkin: {
        dia_numero:
          registro.dia_numero,
        respostas:
          registro.respostas,
        pontuacao:
          registro.pontuacao,
        nivel:
          registro.nivel,
        enviado_atrasado:
          registro.enviado_atrasado,
        primeiro_envio_em:
          registro.primeiro_envio_em
      }
    });

  } catch (erro) {
    console.error(
      "checkin: falha",
      {
        tipo:
          erro?.name || "Erro",
        status:
          erro?.status || null
      }
    );

    return resposta(500, {
      erro:
        "Não foi possível concluir a operação."
    });
  }
};
