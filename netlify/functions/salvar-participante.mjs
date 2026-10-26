import { chavePublicavelValida, identidadeGestor } from "../lib/seguranca.mjs";

/*
 * Fair Play — salvar-participante.mjs
 *
 * Ações: cadastrar, corrigir, ativar e desativar.
 * Aceita somente POST e somente gestores cadastrados.
 * Usa exclusivamente o Supabase de TESTES.
 * Nunca exclui participantes ou expõe a chave secreta.
 */

import { lerAmbienteSupabase } from '../lib/ambiente.mjs';

const CABECALHOS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const resposta = (statusCode, corpo) => ({
  statusCode,
  headers: CABECALHOS,
  body: JSON.stringify(corpo)
});

const REGEX_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REGEX_TOKEN = /^[A-Za-z0-9._-]+$/;

const ACOES = new Set([
  'cadastrar',
  'corrigir',
  'ativar',
  'desativar'
]);

const TAMANHO_MAXIMO_CORPO = 2048;
const CODIGO_DUPLICADO = '23505';

const DUPLICADO = {
  erro: 'Já existe um participante com este nome.'
};

class ErroBanco extends Error {
  constructor(status, codigo) {
    super(`Banco respondeu ${status}`);
    this.name = 'ErroBanco';
    this.status = status;
    this.codigo = codigo;
  }
}

/*
 * 1. CONFIGURAÇÃO SEGURA
 *
 * Bloqueia qualquer Supabase que não seja
 * o projeto de testes.
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
 * 2. EXTRAIR TOKEN
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
 * 4. VALIDAR USUÁRIO NO SUPABASE AUTH
 *
 * O ID vem do token autenticado,
 * nunca de dados informados pelo navegador.
 */
async function obterUsuarioId(config, token) {
  const r = await fetchComTimeout(
    `${config.url}/auth/v1/user`,
    {
      method: 'GET',
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

  return identidadeGestor(usuario) && REGEX_UUID.test(id || '')
    ? id
    : null;
}

/*
 * 5. CONSULTAS AO BANCO
 *
 * A chave secreta é utilizada
 * exclusivamente no servidor.
 */
async function rest(
  config,
  tabela,
  {
    metodo = 'GET',
    parametros,
    corpo,
    retornarLinhas = false
  } = {}
) {
  const url = new URL(
    `${config.url}/rest/v1/${tabela}`
  );

  if (parametros) {
    for (
      const [chave, valor]
      of Object.entries(parametros)
    ) {
      url.searchParams.set(
        chave,
        valor
      );
    }
  }

  const cabecalhos = {
    apikey: config.chaveSecreta,
    Accept: 'application/json'
  };

  if (corpo !== undefined) {
    cabecalhos['Content-Type'] =
      'application/json';
  }

  if (retornarLinhas) {
    cabecalhos.Prefer =
      'return=representation';
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
        typeof erro?.code === 'string'
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

  return r.json();
}

/*
 * 6. VERIFICAR SE O USUÁRIO É GESTOR
 */
async function ehGestor(
  config,
  usuarioId
) {
  const linhas = await rest(
    config,
    'gestores',
    {
      parametros: {
        select: 'usuario_auth_id',
        usuario_auth_id:
          `eq.${usuarioId}`,
        limit: '1'
      }
    }
  );

  return (
    Array.isArray(linhas) &&
    linhas.length === 1
  );
}

/*
 * 7. NORMALIZAR NOME
 *
 * "João", "joao" e "JOÃO"
 * geram a mesma chave "joao".
 */
function gerarChave(nome) {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}]/gu, '');
}

/*
 * 8. VALIDAR PRIMEIRO NOME
 */
function validarNome(valor) {
  if (typeof valor !== 'string') {
    return {
      erro: 'Informe o primeiro nome.'
    };
  }

  const nome = valor.trim();

  if (nome.length < 2) {
    return {
      erro: 'Informe pelo menos 2 letras.'
    };
  }

  if (nome.length > 40) {
    return {
      erro: 'Use no máximo 40 caracteres.'
    };
  }

  if (/\s/.test(nome)) {
    return {
      erro: 'Informe somente o primeiro nome.'
    };
  }

  if (!/^\p{L}[\p{L}'’-]*$/u.test(nome)) {
    return {
      erro: 'Use apenas letras, sem números ou símbolos.'
    };
  }

  const formatado =
    nome.charAt(0).toLocaleUpperCase('pt-BR') +
    nome.slice(1).toLocaleLowerCase('pt-BR');

  const chave = gerarChave(
    formatado
  );

  if (chave.length < 2) {
    return {
      erro: 'Informe um nome válido.'
    };
  }

  return {
    nome: formatado,
    chave
  };
}

/*
 * 9. VALIDAR ID
 */
function validarId(valor) {
  return (
    typeof valor === 'string' &&
    REGEX_UUID.test(valor)
  );
}

/*
 * 10. VALIDAR DADOS DA OPERAÇÃO
 */
function validarEntrada(dados) {
  if (
    !dados ||
    typeof dados !== 'object' ||
    Array.isArray(dados)
  ) {
    return {
      erro: 'Requisição inválida.'
    };
  }

  const acao = dados.acao;

  if (!ACOES.has(acao)) {
    return {
      erro: 'Ação inválida.'
    };
  }

  if (acao === 'cadastrar') {
    const nome = validarNome(
      dados.nome
    );

    if (nome.erro) {
      return nome;
    }

    return {
      acao,
      nome: nome.nome,
      chave: nome.chave
    };
  }

  if (!validarId(dados.id)) {
    return {
      erro: 'Participante inválido.'
    };
  }

  if (acao === 'corrigir') {
    const nome = validarNome(
      dados.nome
    );

    if (nome.erro) {
      return nome;
    }

    return {
      acao,
      id: dados.id,
      nome: nome.nome,
      chave: nome.chave
    };
  }

  return {
    acao,
    id: dados.id
  };
}

/*
 * 11. LER CORPO DA REQUISIÇÃO
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
    return {
      erro: 'Requisição inválida.'
    };
  }

  try {
    return {
      dados: JSON.parse(bruto)
    };
  } catch {
    return {
      erro: 'Requisição inválida.'
    };
  }
}

/*
 * 12. VERIFICAR NOME DUPLICADO
 */
async function chaveEmUso(
  config,
  chave,
  ignorarId
) {
  const parametros = {
    select: 'id',
    nome_chave: `eq.${chave}`,
    limit: '1'
  };

  if (ignorarId) {
    parametros.id =
      `neq.${ignorarId}`;
  }

  const linhas = await rest(
    config,
    'participantes',
    {
      parametros
    }
  );

  return (
    Array.isArray(linhas) &&
    linhas.length > 0
  );
}

/*
 * 13. FORMATAR PARTICIPANTE
 */
function formatar(p) {
  return {
    id: String(p.id),
    nome: String(p.nome),
    ativo: p.ativo === true,
    criado_em: p.criado_em
  };
}

/*
 * 14. CADASTRAR PARTICIPANTE
 */
async function cadastrar(
  config,
  v
) {
  if (
    await chaveEmUso(
      config,
      v.chave
    )
  ) {
    return resposta(
      409,
      DUPLICADO
    );
  }

  const linhas = await rest(
    config,
    'participantes',
    {
      metodo: 'POST',
      corpo: {
        nome: v.nome,
        nome_chave: v.chave
      },
      retornarLinhas: true
    }
  );

  if (
    !Array.isArray(linhas) ||
    linhas.length !== 1
  ) {
    throw new Error(
      'Inserção sem retorno'
    );
  }

  return resposta(
    201,
    {
      participante: formatar(
        linhas[0]
      )
    }
  );
}

/*
 * 15. CORRIGIR NOME
 */
async function corrigir(
  config,
  v
) {
  if (
    await chaveEmUso(
      config,
      v.chave,
      v.id
    )
  ) {
    return resposta(
      409,
      DUPLICADO
    );
  }

  const linhas = await rest(
    config,
    'participantes',
    {
      metodo: 'PATCH',
      parametros: {
        id: `eq.${v.id}`
      },
      corpo: {
        nome: v.nome,
        nome_chave: v.chave
      },
      retornarLinhas: true
    }
  );

  if (
    !Array.isArray(linhas) ||
    linhas.length === 0
  ) {
    return resposta(
      404,
      {
        erro: 'Participante não encontrado.'
      }
    );
  }

  return resposta(
    200,
    {
      participante: formatar(
        linhas[0]
      )
    }
  );
}

/*
 * 16. ATIVAR OU DESATIVAR
 */
async function alterarAtivo(
  config,
  v
) {
  const linhas = await rest(
    config,
    'participantes',
    {
      metodo: 'PATCH',
      parametros: {
        id: `eq.${v.id}`
      },
      corpo: {
        ativo: v.acao === 'ativar'
      },
      retornarLinhas: true
    }
  );

  if (
    !Array.isArray(linhas) ||
    linhas.length === 0
  ) {
    return resposta(
      404,
      {
        erro: 'Participante não encontrado.'
      }
    );
  }

  return resposta(
    200,
    {
      participante: formatar(
        linhas[0]
      )
    }
  );
}

/*
 * 17. FUNÇÃO PRINCIPAL
 */
export const handler = async (event) => {
  // Aceita somente POST.
  if (event.httpMethod !== 'POST') {
    return resposta(
      405,
      {
        erro: 'Método não permitido.'
      }
    );
  }

  // Confere se estamos no Supabase de TESTES.
  const config = lerConfiguracao();

  if (!config) {
    console.error(
      'salvar-participante: configuração de ambiente inválida.'
    );

    return resposta(
      500,
      {
        erro: 'Configuração indisponível.'
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
        erro: 'Sessão ausente. Entre novamente.'
      }
    );
  }

  try {
    // 1. Autenticar o usuário.
    const usuarioId = await obterUsuarioId(
      config,
      token
    );

    if (!usuarioId) {
      return resposta(
        401,
        {
          erro: 'Sessão inválida ou expirada. Entre novamente.'
        }
      );
    }

    // 2. Confirmar que é gestor.
    if (
      !(await ehGestor(
        config,
        usuarioId
      ))
    ) {
      return resposta(
        403,
        {
          erro: 'Acesso não autorizado.'
        }
      );
    }

    // 3. Ler e validar os dados enviados.
    const corpo = lerCorpo(
      event
    );

    if (corpo.erro) {
      return resposta(
        400,
        {
          erro: corpo.erro
        }
      );
    }

    const v = validarEntrada(
      corpo.dados
    );

    if (v.erro) {
      return resposta(
        400,
        {
          erro: v.erro
        }
      );
    }

    // 4. Executar a operação solicitada.
    switch (v.acao) {
      case 'cadastrar':
        return await cadastrar(
          config,
          v
        );

      case 'corrigir':
        return await corrigir(
          config,
          v
        );

      case 'ativar':
      case 'desativar':
        return await alterarAtivo(
          config,
          v
        );

      default:
        return resposta(
          400,
          {
            erro: 'Ação inválida.'
          }
        );
    }

  } catch (err) {
    // Duplicidade detectada pelo banco.
    if (
      err instanceof ErroBanco &&
      err.codigo === CODIGO_DUPLICADO
    ) {
      return resposta(
        409,
        DUPLICADO
      );
    }

    // Não registra tokens, senhas ou chaves.
    console.error(
      `salvar-participante: falha (${err.name || 'Erro'}).`
    );

    return resposta(
      500,
      {
        erro: 'Não foi possível salvar o participante.'
      }
    );
  }
};
