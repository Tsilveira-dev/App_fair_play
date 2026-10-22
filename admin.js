// Fair Play — Painel do gestor (admin.js)
// Login e sessão: Supabase Auth (URL e chave publicável vêm de config-public).
// Dados: somente pelas Netlify Functions, que validam o token do gestor no servidor.
// Este arquivo não acessa tabelas do Supabase diretamente.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const FUNCOES = {
  config: '/.netlify/functions/config-public',
  verificar: '/.netlify/functions/verificar-gestor',
  listar: '/.netlify/functions/listar-participantes',
  salvar: '/.netlify/functions/salvar-participante',
  acessos: '/.netlify/functions/gerenciar-acesso'
};

const FUSO = 'America/Fortaleza';
const FILTROS_ACESSO = new Set(['pendente', 'aprovada', 'expirada', 'recusada', 'revogada', 'todas']);
const ROTULOS_STATUS = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  expirada: 'Expirada',
  recusada: 'Recusada',
  revogada: 'Revogada'
};
const ROTULOS_DISPOSITIVO = { individual: 'Individual', compartilhado: 'Compartilhado' };

const TEXTO_ACOES = {
  aprovar: {
    titulo: 'Aprovar acesso',
    botao: 'Aprovar',
    estilo: 'btn btn-aprovar btn-pequeno',
    texto: (nome, fim) => `Autorizar ${nome} a entrar no Fair Play? O acesso vale até ${fim}.`,
    sucesso: 'Acesso autorizado.'
  },
  recusar: {
    titulo: 'Recusar solicitação',
    botao: 'Recusar',
    estilo: 'btn btn-perigo btn-pequeno',
    texto: nome => `Recusar a solicitação de ${nome}? O registro ficará no histórico e o estudante poderá enviar uma nova solicitação.`,
    sucesso: 'Solicitação recusada.'
  },
  revogar: {
    titulo: 'Revogar acesso',
    botao: 'Revogar',
    estilo: 'btn btn-perigo btn-pequeno',
    texto: nome => `Encerrar o acesso de ${nome}? O registro será mantido no histórico. Um novo dispositivo só poderá ser liberado depois disso.`,
    sucesso: 'Acesso revogado.'
  }
};

let supabase = null;
let participantes = [];
let solicitacoes = [];
let periodo = { configurado: false, fim: null };
let acaoPendente = null;
let operacaoEmAndamento = false;
let loginEmAndamento = false;
let seqSolicitacoes = 0;   // número da consulta mais recente de solicitações
let ocupado = 0;
let timerStatus = null;

const $ = id => document.getElementById(id);

class ErroSessao extends Error {}
class ErroServidor extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/* ---------- Configuração pública ---------- */

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

function formatarDataHora(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: FUSO });
}

function mostrarLogin() {
  seqSolicitacoes += 1;   // descarta qualquer consulta de solicitações ainda em andamento
  fecharEdicao();
  esconderConfirmacao();
  participantes = [];
  limparSolicitacoes();
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

// Encerra a sessão local sem propagar falhas: o painel precisa voltar ao login mesmo assim.
async function encerrarSessaoSilenciosa() {
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    // Ignorado de propósito: o token local é tratado pelo próprio cliente.
  }
}

async function sessaoExpirada(mensagem) {
  await encerrarSessaoSilenciosa();
  mostrarLogin();
  mostrarErroLogin(mensagem || 'Sua sessão expirou. Entre novamente.');
}

async function tratarErro(err) {
  if (err instanceof ErroSessao) {
    await sessaoExpirada(err.message);
  } else if (err.status === 401) {
    await sessaoExpirada();
  } else if (err.status === 403) {
    await sessaoExpirada('Acesso não autorizado.');
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
    await tratarErro(err);
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

// Nunca lança exceção: qualquer falha volta para a tela de login com mensagem.
async function abrirPainel(email) {
  carregando(true);
  let autorizado = false;
  try {
    autorizado = await verificarGestor();
  } catch (err) {
    if (err instanceof ErroSessao || err.status === 401 || err.status === 403) {
      await encerrarSessaoSilenciosa();
    }
    mostrarLogin();
    mostrarErroLogin(err.message || 'Não foi possível verificar o acesso. Tente novamente.');
    return;
  } finally {
    carregando(false);
  }

  if (!autorizado) {
    await encerrarSessaoSilenciosa();
    mostrarLogin();
    mostrarErroLogin('Acesso não autorizado.');
    return;
  }

  mostrarAdmin(email);
  // allSettled: uma falha em participantes não impede o carregamento das solicitações.
  await Promise.allSettled([carregarLista(), carregarSolicitacoes()]);
}

/* ---------- Participantes: listagem ---------- */

async function carregarLista() {
  const botaoAtualizar = $('btn-atualizar');
  botaoAtualizar.disabled = true;
  carregando(true);
  try {
    const dados = await chamar(FUNCOES.listar);
    participantes = Array.isArray(dados.participantes) ? dados.participantes : [];
    renderizarLista();
  } catch (err) {
    await tratarErro(err);
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
  participantes.forEach(p => ul.appendChild(criarItemParticipante(p)));
}

function criarItemParticipante(p) {
  const li = document.createElement('li');
  li.className = 'item-lista';
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
  acoes.className = 'flex flex-wrap gap-2';

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

/* ---------- Participantes: cadastro ---------- */

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

/* ---------- Participantes: edição do nome ---------- */

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

/* ---------- Participantes: ativar / desativar ---------- */

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

$('lista-participantes').addEventListener('click', e => {
  const botao = e.target.closest('button[data-acao]');
  if (!botao) return;
  const p = participantes.find(x => x.id === botao.dataset.id);
  if (!p) return;
  if (botao.dataset.acao === 'editar') abrirEdicao(p);
  if (botao.dataset.acao === 'alternar-ativo') alternarAtivo(p, botao);
});

$('btn-atualizar').addEventListener('click', () => carregarLista());

/* ---------- Solicitações de acesso: período do teste ---------- */

// Lê o bloco "periodo" da resposta de gerenciar-acesso.
function lerPeriodoResposta(p) {
  if (!p || p.configurado !== true || !p.fim) return { configurado: false, fim: null };
  const fim = new Date(p.fim);
  if (Number.isNaN(fim.getTime())) return { configurado: false, fim: null };
  return { configurado: true, fim };
}

function periodoPermiteAprovar() {
  return periodo.configurado && Date.now() < periodo.fim.getTime();
}

// Retorna o motivo para bloquear Aprovar, ou null se for permitido.
function motivoBloqueioAprovacao(s) {
  if (!periodo.configurado) return 'Período do teste não configurado.';
  if (!periodoPermiteAprovar()) return 'Período do teste encerrado.';
  if (s.participante_ativo !== true) return 'Participante inativo.';
  return null;
}

function atualizarAvisoPeriodo() {
  const aviso = $('periodo-aviso');
  let texto = null;
  if (!periodo.configurado) {
    texto = 'O período do teste ainda não está configurado. Você pode ver as solicitações, mas nenhuma aprovação será possível até a equipe definir a data oficial.';
  } else if (!periodoPermiteAprovar()) {
    texto = 'O período do teste já terminou. Não é possível aprovar novas solicitações.';
  }

  if (texto) {
    aviso.textContent = texto;
    aviso.classList.remove('oculto');
  } else {
    aviso.textContent = '';
    aviso.classList.add('oculto');
  }
}

/* ---------- Solicitações de acesso: listagem ---------- */

function limparSolicitacoes() {
  solicitacoes = [];
  periodo = { configurado: false, fim: null };
  $('lista-solicitacoes').textContent = '';
  $('contador-solicitacoes').textContent = '';
  $('solicitacoes-mensagem').classList.add('oculto');
  $('periodo-aviso').classList.add('oculto');
}

// Cada chamada recebe um número. Só a mais recente pode atualizar a interface,
// mesmo que respostas anteriores cheguem depois (troca rápida de filtros).
async function carregarSolicitacoes() {
  const id = ++seqSolicitacoes;

  const select = $('filtro-solicitacoes').value;
  const filtro = FILTROS_ACESSO.has(select) ? select : 'pendente';
  // "Todas" chama o endpoint sem o parâmetro status.
  const url = filtro === 'todas'
    ? FUNCOES.acessos
    : `${FUNCOES.acessos}?status=${encodeURIComponent(filtro)}`;

  const botao = $('btn-atualizar-solicitacoes');
  botao.disabled = true;
  carregando(true);
  try {
    const dados = await chamar(url);
    if (id !== seqSolicitacoes) return;   // resposta antiga: descartada
    solicitacoes = Array.isArray(dados.sessoes) ? dados.sessoes : [];
    periodo = lerPeriodoResposta(dados.periodo);
    atualizarAvisoPeriodo();
    renderizarSolicitacoes();
  } catch (err) {
    if (id !== seqSolicitacoes) return;   // erro de consulta antiga: ignorado
    await tratarErro(err);
  } finally {
    carregando(false);
    if (id === seqSolicitacoes) botao.disabled = false;
  }
}

function renderizarSolicitacoes() {
  const ul = $('lista-solicitacoes');
  const msg = $('solicitacoes-mensagem');
  ul.textContent = '';

  const total = solicitacoes.length;
  $('contador-solicitacoes').textContent = total
    ? `${total} ${total === 1 ? 'registro' : 'registros'} neste filtro`
    : '';

  if (!total) {
    msg.textContent = 'Nenhuma solicitação neste filtro.';
    msg.classList.remove('oculto');
    return;
  }
  msg.classList.add('oculto');
  solicitacoes.forEach(s => ul.appendChild(criarItemSolicitacao(s)));
}

function criarBotaoSolicitacao(texto, classes, acao, sessaoId, desabilitado = false, dica = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classes;
  b.dataset.acao = acao;
  b.dataset.id = sessaoId;
  b.textContent = texto;
  b.disabled = desabilitado;
  if (dica) b.title = dica;
  return b;
}

// Exibe o status calculado (status_efetivo), mas decide as ações pelo status gravado.
function criarItemSolicitacao(s) {
  const li = document.createElement('li');
  li.className = 'item-lista';
  li.dataset.id = s.id;

  const info = document.createElement('div');
  info.className = 'info-item';

  const linhaTitulo = document.createElement('div');
  linhaTitulo.className = 'flex flex-wrap items-center gap-2';

  const nome = document.createElement('span');
  nome.className = 'font-semibold';
  nome.textContent = s.nome || 'Participante sem nome';

  const efetivo = s.status_efetivo || s.status;
  const badge = document.createElement('span');
  badge.className = `badge badge-${efetivo}`;
  badge.textContent = ROTULOS_STATUS[efetivo] || efetivo;

  linhaTitulo.append(nome, badge);
  info.appendChild(linhaTitulo);

  const detalhes = [
    `Dispositivo: ${ROTULOS_DISPOSITIVO[s.tipo_dispositivo] || 'Não informado'}`,
    `Solicitado em: ${formatarDataHora(s.solicitado_em)}`
  ];
  if (efetivo === 'aprovada' && s.expira_em) {
    detalhes.push(`Válido até: ${formatarDataHora(s.expira_em)}`);
  }
  if (efetivo === 'expirada' && s.expira_em) {
    detalhes.push(`Expirou em: ${formatarDataHora(s.expira_em)}`);
  }
  if (s.participante_ativo === false) {
    detalhes.push('Participante inativo: reative o cadastro antes de aprovar.');
  }

  detalhes.forEach(texto => {
    const linha = document.createElement('span');
    linha.className = 'detalhe';
    linha.textContent = texto;
    info.appendChild(linha);
  });

  const acoes = document.createElement('div');
  acoes.className = 'flex flex-wrap gap-2';

  if (s.status === 'pendente') {
    const motivo = motivoBloqueioAprovacao(s);
    acoes.append(
      criarBotaoSolicitacao('Aprovar', 'btn btn-aprovar btn-pequeno', 'aprovar', s.id, Boolean(motivo), motivo || ''),
      criarBotaoSolicitacao('Recusar', 'btn btn-perigo btn-pequeno', 'recusar', s.id)
    );
  } else if (s.status === 'aprovada') {
    acoes.append(criarBotaoSolicitacao('Revogar', 'btn btn-perigo btn-pequeno', 'revogar', s.id));
  }

  li.append(info, acoes);
  return li;
}

/* ---------- Solicitações de acesso: confirmação e decisões ---------- */

function esconderConfirmacao() {
  acaoPendente = null;
  $('modal-confirmar').classList.add('oculto');
  $('confirmar-erro').textContent = '';
  $('confirmar-erro').classList.add('oculto');
}

function pedirConfirmacao(acao, s) {
  const config = TEXTO_ACOES[acao];
  const nome = s.nome || 'este participante';
  const fim = periodo.fim ? formatarDataHora(periodo.fim) : '';

  acaoPendente = { acao, sessaoId: s.id };
  $('confirmar-titulo').textContent = config.titulo;
  $('confirmar-texto').textContent = config.texto(nome, fim);

  const botao = $('btn-confirmar-acao');
  botao.textContent = config.botao;
  botao.className = config.estilo;
  botao.style.width = 'auto';

  $('confirmar-erro').textContent = '';
  $('confirmar-erro').classList.add('oculto');
  $('modal-confirmar').classList.remove('oculto');
  $('btn-confirmar-cancelar').focus();
}

async function executarConfirmacao() {
  if (!acaoPendente || operacaoEmAndamento) return;

  const { acao, sessaoId } = acaoPendente;
  const botao = $('btn-confirmar-acao');
  const cancelar = $('btn-confirmar-cancelar');
  const textoOriginal = botao.textContent;

  operacaoEmAndamento = true;
  botao.disabled = true;
  cancelar.disabled = true;
  botao.textContent = 'Aguarde...';
  carregando(true);

  let recarregarLista = false;
  try {
    const dados = await chamar(FUNCOES.acessos, {
      metodo: 'POST',
      corpo: { acao, sessao_id: sessaoId }
    });
    esconderConfirmacao();
    mostrarStatus('sucesso', dados.mensagem || TEXTO_ACOES[acao].sucesso);
    recarregarLista = true;
  } catch (err) {
    if (err.status === 0) {
      // Sem conexão: mantém o modal aberto para nova tentativa.
      $('confirmar-erro').textContent = err.message;
      $('confirmar-erro').classList.remove('oculto');
    } else {
      esconderConfirmacao();
      await tratarErro(err);
      // Erros de decisão (409, 404, 400) exigem atualizar a lista com o estado real.
      recarregarLista = !(err instanceof ErroSessao || err.status === 401 || err.status === 403);
    }
  } finally {
    carregando(false);
    operacaoEmAndamento = false;
    botao.disabled = false;
    cancelar.disabled = false;
    botao.textContent = textoOriginal;
  }

  if (recarregarLista) await carregarSolicitacoes();
}

$('lista-solicitacoes').addEventListener('click', e => {
  const botao = e.target.closest('button[data-acao]');
  if (!botao || operacaoEmAndamento || botao.disabled) return;

  const s = solicitacoes.find(x => x.id === botao.dataset.id);
  if (!s) return;

  const acao = botao.dataset.acao;
  if (!TEXTO_ACOES[acao]) return;
  pedirConfirmacao(acao, s);
});

$('btn-confirmar-cancelar').addEventListener('click', () => {
  if (!operacaoEmAndamento) esconderConfirmacao();
});
$('btn-confirmar-acao').addEventListener('click', () => executarConfirmacao());
$('filtro-solicitacoes').addEventListener('change', () => carregarSolicitacoes());
$('btn-atualizar-solicitacoes').addEventListener('click', () => carregarSolicitacoes());

/* ---------- Teclado ---------- */

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('modal-confirmar').classList.contains('oculto')) {
    if (!operacaoEmAndamento) esconderConfirmacao();
    return;
  }
  if (!$('modal-editar').classList.contains('oculto')) fecharEdicao();
});

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
  if (loginEmAndamento) return;

  const botao = $('btn-login');
  let sessao = null;

  loginEmAndamento = true;
  botao.disabled = true;
  botao.textContent = 'Entrando...';
  carregando(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error || !data || !data.session) {
      if (error && !error.status) {
        mostrarErroLogin('Não foi possível conectar. Verifique sua internet e tente novamente.');
      } else {
        mostrarErroLogin('E-mail ou senha inválidos.');
        $('login-senha').value = '';
      }
      return;
    }
    sessao = data.session;
  } catch (err) {
    mostrarErroLogin('Não foi possível concluir o login. Verifique sua conexão e tente novamente.');
    return;
  } finally {
    carregando(false);
    botao.disabled = false;
    botao.textContent = 'Entrar';
    loginEmAndamento = false;
  }

  await abrirPainel(sessao.user.email);
});

$('btn-sair').addEventListener('click', async () => {
  carregando(true);
  try {
    await encerrarSessaoSilenciosa();
  } finally {
    carregando(false);
  }
  mostrarLogin();
});

/* ---------- Inicialização ---------- */

// Nenhuma falha aqui deve deixar o painel travado com o contador de carregamento ligado.
async function iniciar() {
  carregando(true);
  try {
    try {
      await iniciarSupabase();
    } catch (err) {
      $('btn-login').disabled = true;
      mostrarErroLogin('Não foi possível carregar a configuração. Atualize a página e tente novamente.');
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data || !data.session) {
        mostrarLogin();
        return;
      }
      await abrirPainel(data.session.user.email);
    } catch (err) {
      mostrarLogin();
      mostrarErroLogin('Não foi possível verificar sua sessão. Entre novamente.');
    }
  } finally {
    carregando(false);
  }
}

iniciar().catch(() => {
  carregando(false);
  mostrarErroLogin('Ocorreu um erro inesperado. Atualize a página.');
});