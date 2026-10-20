// Fair Play — Painel do gestor (admin.js)
// Login e sessão pelo Supabase Auth. Os dados são lidos e gravados apenas
// pelas Netlify Functions, que validam o token do gestor no servidor.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const FUNCOES = {
  config: '/.netlify/functions/config-publica',
  verificar: '/.netlify/functions/verificar-gestor',
  listar: '/.netlify/functions/listar-participantes',
  salvar: '/.netlify/functions/salvar-participante'
};

// Preenchido em iniciarSupabase(), a partir da função config-publica.
let supabase = null;

/* ---------- Erros ---------- */
class ErroSessao extends Error {}
class ErroServidor extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/* ---------- Atalhos de DOM ---------- */
const $ = id => document.getElementById(id);

let participantes = [];
let ocupado = 0;
let timerStatus = null;

/* ---------- Configuração pública (URL e chave publicável) ---------- */
async function carregarConfiguracao() {
  const resposta = await fetch(FUNCOES.config, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!resposta.ok) throw new Error('Configuração indisponível.');

  const dados = await resposta.json();
  if (!dados.supabaseUrl || !dados.supabasePublishableKey) {
    throw new Error('Configuração incompleta.');
  }
  return dados;
}

async function iniciarSupabase() {
  const config = await carregarConfiguracao();
  supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
}

/* ---------- Interface: carregamento, status e erros ---------- */
function carregando(ligado) {
  ocupado = Math.max(0, ocupado + (ligado ? 1 : -1));
  $('overlay-carregando').classList.toggle('oculto', ocupado === 0);
}

function mostrarStatus(tipo, texto) {
  const el = $('status-global');
  el.className = `status status-${tipo}`;
  el.textContent = texto;
  clearTimeout(timerStatus);
  if (tipo === 'sucesso') {
    timerStatus = setTimeout(() => el.classList.add('oculto'), 4000);
  }
}

function ocultarStatus() {
  clearTimeout(timerStatus);
  $('status-global').classList.add('oculto');
}

function erroCampo(inputId, erroId, texto) {
  const input = $(inputId);
  const erro = $(erroId);
  if (texto) {
    input.classList.add('invalido');
    input.setAttribute('aria-invalid', 'true');
    erro.textContent = texto;
    erro.classList.remove('oculto');
  } else {
    input.classList.remove('invalido');
    input.removeAttribute('aria-invalid');
    erro.textContent = '';
    erro.classList.add('oculto');
  }
}

function mostrarErroLogin(texto) {
  const el = $('login-erro');
  if (!texto) {
    el.textContent = '';
    el.classList.add('oculto');
    return;
  }
  el.textContent = texto;
  el.classList.remove('oculto');
}

function mostrarLogin() {
  fecharEdicao();
  participantes = [];
  $('tela-admin').classList.add('oculto');
  $('tela-login').classList.remove('oculto');
  $('login-senha').value = '';
  $('admin-usuario').textContent = '';
  ocultarStatus();
}

function mostrarAdmin(email) {
  $('tela-login').classList.add('oculto');
  $('tela-admin').classList.remove('oculto');
  $('admin-usuario').textContent = email ? `Conectado como ${email}` : '';
}

async function sessaoExpirada(mensagem) {
  if (supabase) await supabase.auth.signOut();
  mostrarLogin();
  mostrarErroLogin(mensagem || 'Sua sessão expirou. Entre novamente.');
}

function tratarErro(err) {
  if (err instanceof ErroSessao) {
    sessaoExpirada(err.message);
  } else if (err.status === 401) {
    sessaoExpirada();
  } else if (err.status === 403) {
    sessaoExpirada('Acesso não autorizado.');
  } else {
    mostrarStatus('erro', err.message || 'Algo deu errado. Tente novamente.');
  }
}

/* Desativa o botão, mostra o carregamento e trata erros de forma padronizada */
async function executar(botao, textoOcupado, fn) {
  const textoOriginal = botao ? botao.textContent : '';
  if (botao) {
    botao.disabled = true;
    botao.textContent = textoOcupado;
  }
  carregando(true);
  try {
    await fn();
  } catch (err) {
    tratarErro(err);
  } finally {
    carregando(false);
    if (botao) {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }
}

/* ---------- Comunicação com as Netlify Functions ---------- */
async function obterToken() {
  if (!supabase) throw new ErroSessao('Configuração do sistema ausente. Atualize a página.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new ErroSessao('Sua sessão expirou. Entre novamente.');
  return data.session.access_token;
}

async function chamar(url, { metodo = 'GET', corpo } = {}) {
  const token = await obterToken();
  const cabecalhos = { Authorization: `Bearer ${token}` };
  if (corpo) cabecalhos['Content-Type'] = 'application/json';

  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined
    });
  } catch (e) {
    throw new ErroServidor('Não foi possível conectar. Verifique sua internet e tente novamente.', 0);
  }

  let dados = {};
  try {
    dados = await resposta.json();
  } catch (e) {
    dados = {};
  }

  if (resposta.status === 401) throw new ErroServidor('Sua sessão expirou. Entre novamente.', 401);
  if (!resposta.ok) {
    throw new ErroServidor(dados.erro || 'Não foi possível concluir a operação.', resposta.status);
  }
  return dados;
}

async function verificarGestor() {
  const dados = await chamar(FUNCOES.verificar, { metodo: 'POST' });
  return dados.autorizado === true;
}

/* ---------- Validação do nome (primeiro nome, somente letras) ---------- */
function validarNome(valor) {
  const nome = valor.trim();
  if (nome.length < 2) return { erro: 'Informe pelo menos 2 letras.' };
  if (nome.length > 40) return { erro: 'Use no máximo 40 caracteres.' };
  if (/\s/.test(nome)) return { erro: 'Informe somente o primeiro nome.' };
  if (!/^\p{L}[\p{L}'’-]*$/u.test(nome)) {
    return { erro: 'Use apenas letras, sem números ou símbolos.' };
  }
  const formatado =
    nome.charAt(0).toLocaleUpperCase('pt-BR') + nome.slice(1).toLocaleLowerCase('pt-BR');
  return { nome: formatado };
}

/* ---------- Acesso ao painel ---------- */
async function abrirPainel(email) {
  carregando(true);
  try {
    const autorizado = await verificarGestor();
    if (!autorizado) throw new ErroServidor('Acesso não autorizado.', 403);
  } catch (err) {
    if (err instanceof ErroSessao || err.status === 401 || err.status === 403) {
      if (supabase) await supabase.auth.signOut();
    }
    carregando(false);
    mostrarLogin();
    mostrarErroLogin(err.message);
    return;
  }
  carregando(false);
  mostrarAdmin(email);
  await carregarLista();
}

/* ---------- Listagem ---------- */
async function carregarLista() {
  const botaoAtualizar = $('btn-atualizar');
  botaoAtualizar.disabled = true;
  carregando(true);
  try {
    const dados = await chamar(FUNCOES.listar);
    participantes = Array.isArray(dados.participantes) ? dados.participantes : [];
    renderizarLista();
  } catch (err) {
    tratarErro(err);
  } finally {
    carregando(false);
    botaoAtualizar.disabled = false;
  }
}

function renderizarLista() {
  const ul = $('lista-participantes');
  const msg = $('lista-mensagem');
  ul.textContent = '';

  const total = participantes.length;
  const ativos = participantes.filter(p => p.ativo).length;
  $('contador-participantes').textContent = total
    ? `${total} cadastrado(s) · ${ativos} ativo(s)`
    : '';

  if (!total) {
    msg.textContent = 'Nenhum participante cadastrado ainda.';
    msg.classList.remove('oculto');
    return;
  }
  msg.classList.add('oculto');
  participantes.forEach(p => ul.appendChild(criarItem(p)));
}

function criarItem(p) {
  const li = document.createElement('li');
  li.className = 'item-participante';
  li.dataset.id = p.id;

  const info = document.createElement('div');
  info.className = 'flex flex-wrap items-center gap-3';

  const nome = document.createElement('span');
  nome.className = 'font-semibold';
  nome.textContent = p.nome;

  const badge = document.createElement('span');
  badge.className = `badge ${p.ativo ? 'badge-ativo' : 'badge-inativo'}`;
  badge.textContent = p.ativo ? 'Ativo' : 'Inativo';

  info.append(nome, badge);

  const acoes = document.createElement('div');
  acoes.className = 'flex gap-2';

  const botaoEditar = document.createElement('button');
  botaoEditar.type = 'button';
  botaoEditar.className = 'btn btn-ghost btn-pequeno';
  botaoEditar.dataset.acao = 'editar';
  botaoEditar.dataset.id = p.id;
  botaoEditar.textContent = 'Corrigir nome';

  const botaoAtivo = document.createElement('button');
  botaoAtivo.type = 'button';
  botaoAtivo.className = p.ativo ? 'btn btn-perigo btn-pequeno' : 'btn btn-ghost btn-pequeno';
  botaoAtivo.dataset.acao = 'alternar-ativo';
  botaoAtivo.dataset.id = p.id;
  botaoAtivo.textContent = p.ativo ? 'Desativar' : 'Ativar';

  acoes.append(botaoEditar, botaoAtivo);
  li.append(info, acoes);
  return li;
}

/* ---------- Cadastro ---------- */
$('form-cadastro').addEventListener('submit', async e => {
  e.preventDefault();
  const v = validarNome($('cadastro-nome').value);
  if (v.erro) {
    erroCampo('cadastro-nome', 'cadastro-erro', v.erro);
    $('cadastro-nome').focus();
    return;
  }
  erroCampo('cadastro-nome', 'cadastro-erro', '');

  await executar($('btn-cadastrar'), 'Cadastrando...', async () => {
    try {
      await chamar(FUNCOES.salvar, { metodo: 'POST', corpo: { acao: 'cadastrar', nome: v.nome } });
    } catch (err) {
      if (err.status === 400 || err.status === 409) {
        erroCampo('cadastro-nome', 'cadastro-erro', err.message);
        return;
      }
      throw err;
    }
    $('form-cadastro').reset();
    mostrarStatus('sucesso', `${v.nome} foi cadastrado(a).`);
    await carregarLista();
  });
});

$('cadastro-nome').addEventListener('input', () => erroCampo('cadastro-nome', 'cadastro-erro', ''));

/* ---------- Edição do nome ---------- */
function abrirEdicao(p) {
  $('editar-id').value = p.id;
  $('editar-nome').value = p.nome;
  erroCampo('editar-nome', 'editar-erro', '');
  $('modal-editar').classList.remove('oculto');
  $('editar-nome').focus();
}

function fecharEdicao() {
  $('modal-editar').classList.add('oculto');
  $('form-editar').reset();
  erroCampo('editar-nome', 'editar-erro', '');
}

$('btn-cancelar-edicao').addEventListener('click', fecharEdicao);
$('editar-nome').addEventListener('input', () => erroCampo('editar-nome', 'editar-erro', ''));

$('form-editar').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('editar-id').value;
  const v = validarNome($('editar-nome').value);
  if (v.erro) {
    erroCampo('editar-nome', 'editar-erro', v.erro);
    return;
  }

  await executar($('btn-salvar-edicao'), 'Salvando...', async () => {
    try {
      await chamar(FUNCOES.salvar, { metodo: 'POST', corpo: { acao: 'corrigir', id, nome: v.nome } });
    } catch (err) {
      if (err.status === 400 || err.status === 409) {
        erroCampo('editar-nome', 'editar-erro', err.message);
        return;
      }
      throw err;
    }
    fecharEdicao();
    mostrarStatus('sucesso', 'Nome corrigido.');
    await carregarLista();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal-editar').classList.contains('oculto')) fecharEdicao();
});

/* ---------- Ativar / desativar ---------- */
async function alternarAtivo(p, botao) {
  const desativar = p.ativo;
  if (desativar && !confirm(`Desativar ${p.nome}? O cadastro e o histórico serão mantidos.`)) return;

  await executar(botao, 'Aguarde...', async () => {
    await chamar(FUNCOES.salvar, {
      metodo: 'POST',
      corpo: { acao: desativar ? 'desativar' : 'ativar', id: p.id }
    });
    mostrarStatus('sucesso', desativar ? `${p.nome} foi desativado(a).` : `${p.nome} foi ativado(a).`);
    await carregarLista();
  });
}

/* Cliques na lista (delegação de eventos, pois os itens são recriados) */
$('lista-participantes').addEventListener('click', e => {
  const botao = e.target.closest('button[data-acao]');
  if (!botao) return;
  const p = participantes.find(x => x.id === botao.dataset.id);
  if (!p) return;
  if (botao.dataset.acao === 'editar') abrirEdicao(p);
  if (botao.dataset.acao === 'alternar-ativo') alternarAtivo(p, botao);
});

$('btn-atualizar').addEventListener('click', () => carregarLista());

/* ---------- Login e logout ---------- */
$('form-login').addEventListener('submit', async e => {
  e.preventDefault();
  mostrarErroLogin('');

  const email = $('login-email').value.trim();
  const senha = $('login-senha').value;
  if (!email || !senha) {
    mostrarErroLogin('Informe e-mail e senha.');
    return;
  }
  if (!supabase) {
    mostrarErroLogin('Configuração do sistema ausente. Atualize a página.');
    return;
  }

  const botao = $('btn-login');
  botao.disabled = true;
  botao.textContent = 'Entrando...';
  carregando(true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

  carregando(false);
  botao.disabled = false;
  botao.textContent = 'Entrar';

  if (error || !data.session) {
    if (error && !error.status) {
      mostrarErroLogin('Não foi possível conectar. Verifique sua internet e tente novamente.');
    } else {
      mostrarErroLogin('E-mail ou senha inválidos.');
      $('login-senha').value = '';
    }
    return;
  }

  await abrirPainel(data.session.user.email);
});

$('btn-sair').addEventListener('click', async () => {
  carregando(true);
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    // Mesmo que a chamada falhe, a tela de login é exibida e o token local é limpo.
  } finally {
    carregando(false);
  }
  mostrarLogin();
});

/* ---------- Inicialização ---------- */
async function iniciar() {
  try {
    await iniciarSupabase();
  } catch (err) {
    $('btn-login').disabled = true;
    mostrarErroLogin('Não foi possível carregar a configuração. Atualize a página e tente novamente.');
    return;
  }

  carregando(true);
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      mostrarLogin();
      return;
    }
    await abrirPainel(data.session.user.email);
  } finally {
    carregando(false);
  }
}

iniciar();