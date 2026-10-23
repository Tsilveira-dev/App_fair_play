/* Fair Play — aplicativo do estudante (script.js)
   Acesso: Supabase Auth anônimo + Netlify Functions solicitar-acesso e consultar-acesso.
   O navegador não decide sozinho se o estudante pode entrar: segue pode_entrar e coleta_liberada
   retornados pelo servidor. Check-ins e desafios ficam guardados neste aparelho, separados por
   identidade anônima (UID). A persistência definitiva no servidor será implementada em etapa posterior.
   Regra local: um único desafio por dia oficial do teste (alinhado a unique(participante_id, dia_numero)).
   Não há chamadas à Genderize.io nem dados simulados. */

const FUNCOES = {
  config: '/.netlify/functions/config-public',
  solicitar: '/.netlify/functions/solicitar-acesso',
  consultar: '/.netlify/functions/consultar-acesso'
};
const SUPABASE_ESM = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
// Chave de sessão separada do painel do gestor, que roda na mesma origem.
const CHAVE_SESSAO = 'fairplay-estudante-auth';
const PREFIXO_ESTADO = 'fairplay-v5:';
const INTERVALO_VERIFICACAO_MS = 30000;
const FUSO = 'America/Fortaleza';
const DIAS_DO_TESTE = 7;
const TIPOS_APARELHO = new Set(['individual', 'compartilhado']);
const ICONES_MENU = { home: '🏠', checkin: '📝', challenge: '🎯', progress: '📊' };

const MSG_SEM_REGISTRO = 'Ainda não há uma solicitação registrada para este nome. Confira o nome com a equipe e tente novamente. Se você já enviou uma solicitação antes, procure o gestor.';
const MSG_CHECKIN_BLOQUEADO = 'Os check-ins ainda não estão liberados.';
const MSG_DESAFIO_BLOQUEADO = 'Os desafios ainda não estão liberados.';
const MSG_DIA8 = 'No Dia 8 não é possível iniciar novos desafios. Você pode apenas recuperar o check-in do Dia 7.';
const MSG_UM_POR_DIA = 'Você já tem um desafio registrado para este dia do teste. Só é possível um desafio por dia.';
const MSG_SEM_CONFIRMACAO = 'Sem confirmação do servidor agora. Seus dados continuam salvos neste aparelho. Check-ins, desafios aceitos e conclusões serão liberados quando a conexão for confirmada.';
const MSG_TEMPO_AGUARDANDO = 'O tempo terminou. Toque em CONCLUIR quando a conexão for confirmada.';
const TITULOS_BLOQUEIO = {
  recusada: 'Solicitação não aceita',
  revogada: 'Acesso encerrado',
  expirada: 'Acesso expirado',
  participante_inativo: 'Cadastro indisponível',
  periodo_nao_configurado: 'Período ainda não definido',
  periodo_encerrado: 'Período encerrado',
  erro_interno: 'Acesso indisponível'
};

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const QUESTIONS = [
  { q: 'Quanto tempo você costuma jogar por dia?', o: ['Menos de 1 hora', '1 a 3 horas', '3 a 5 horas', 'Mais de 5 horas'] },
  { q: 'Você consegue parar de jogar quando precisa?', o: ['Sim', 'Às vezes', 'Tenho dificuldade'] },
  { q: 'Você costuma deixar de fazer outras atividades para jogar?', o: ['Nunca', 'Às vezes', 'Frequentemente'] }
];

const RESULTS = {
  baixo: { n: 1, label: 'Baixo', emoji: '🟢', color: '#22C55E', title: 'Bom equilíbrio nos seus hábitos',
    text: 'Suas respostas mostram uma boa relação entre jogos e outras atividades. Continue observando sua rotina para manter esse equilíbrio.',
    rec: 'Mantenha o que já funciona: combine horários de jogo com estudos, descanso e tempo com a família.', tip: null },
  mod: { n: 2, label: 'Moderado', emoji: '🟡', color: '#FACC15', title: 'Atenção aos seus hábitos',
    text: 'Algumas das suas respostas indicam que pode ser interessante observar melhor seu tempo de jogo e buscar um equilíbrio maior com outras atividades.',
    rec: 'Experimente estabelecer um período para estudar ou realizar outra atividade antes de começar a jogar.',
    tip: 'Combine com sua família um horário fixo para jogar e outro para estudar. Ter horários definidos ajuda a respeitar os limites.' },
  alto: { n: 3, label: 'Alto', emoji: '🟠', color: '#F97316', title: 'Hora de ajustar a rotina',
    text: 'Suas respostas sugerem que os jogos podem estar ocupando bastante espaço no seu dia. Pequenos passos podem ajudar a reorganizar a rotina.',
    rec: 'Converse com alguém de confiança e combine pausas entre as partidas, começando por uma atividade fora das telas.',
    tip: 'Prefira partidas curtas. Ao terminar cada uma, levante, beba água e faça uma pausa antes de começar outra.' }
};

const ACT = { study: ' Estudar ', sport: ' Fazer atividade física ', draw: ' Desenhar ', read: ' Ler ', family: ' Fazer algo com a família ', rest: ' Descansar ' };

const CH = {
  baixo: { tag: 'Missão de manutenção', title: '20 minutos de pausa ativa', min: 20, pts: 30,
    text: 'Seu equilíbrio está bom! Para mantê-lo, depois de uma sessão de jogo faça uma pausa de 20 minutos com uma atividade fora das telas.',
    list: ['sport', 'read', 'draw', 'family', 'rest'] },
  mod: { tag: 'Missão de organização da rotina', title: '30 minutos antes do jogo', min: 30, pts: 50,
    text: 'Antes de iniciar sua próxima sessão de jogo, escolha uma atividade fora das telas durante 30 minutos e organize o horário do seu dia.',
    list: ['study', 'sport', 'draw', 'read', 'family'] },
  alto: { tag: 'Missão Offline', title: '45 minutos sem telas', min: 45, pts: 70,
    text: 'Reduza o tempo de tela hoje: fique 45 minutos sem telas antes de jogar de novo. Comece por algo de que você goste.',
    list: ['study', 'sport', 'draw', 'read', 'family'] }
};

const C = 2 * Math.PI * 54;
const $ = id => document.getElementById(id);
const $$ = seletor => [...document.querySelectorAll(seletor)];
const $sel = seletor => document.querySelector(seletor);

/* ---------- Estado da aplicação ---------- */

let supa = null;
let acesso = null;                 // última resposta de consultar-acesso
let acessoConfirmado = false;      // true somente após resposta válida do servidor nesta sessão de página
let telaAtual = 'marca';           // marca | formulario | boasvindas | espera | bloqueio | app
let secaoAtual = 'home';
let seqAcesso = 0;                 // identifica a consulta mais recente
let enviando = false;
let solicitacaoEnviada = false;
let ultimoNomeEnviado = '';
let timerVerificacao = null;
let iv = null;                     // intervalo do cronômetro (no máximo um)
let running = false;
let diaResultado = null;           // dia cujo resultado está sendo exibido
let quizRenderizadoPara = null;    // dia do questionário já desenhado
let S = estadoInicial();
let uidAtual = null;

/* ---------- Datas no fuso oficial (sem depender do relógio do aparelho) ---------- */

function hojeFortaleza(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(agora);
  const pegar = tipo => partes.find(p => p.type === tipo).value;
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
}

function somarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function diferencaDias(de, ate) {
  const [y1, m1, d1] = de.split('-').map(Number);
  const [y2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function formatarData(valor, comHora = false) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', comHora
    ? { dateStyle: 'long', timeStyle: 'short', timeZone: FUSO }
    : { dateStyle: 'long', timeZone: FUSO });
}

function formatarDataCurta(iso) {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', timeZone: FUSO
  });
}

// Data oficial de início do teste, somente se o servidor a forneceu.
function dataInicioTeste() {
  if (!acesso || !acesso.periodo || !acesso.periodo.inicio) return null;
  return hojeFortaleza(new Date(acesso.periodo.inicio));
}

// Dia do teste: 1 = data oficial de início. Null sem período configurado.
function diaDoTeste() {
  const inicio = dataInicioTeste();
  if (!inicio) return null;
  return diferencaDias(inicio, hojeFortaleza()) + 1;
}

/* ---------- Estado local (separado por identidade anônima) ---------- */

function estadoInicial() {
  return { dias: {}, ativo: null, rascunho: null };
}

function salvarEstado() {
  if (!uidAtual) return;
  try {
    localStorage.setItem(PREFIXO_ESTADO + uidAtual, JSON.stringify(S));
  } catch (e) {
    // Armazenamento indisponível: o app segue funcionando nesta sessão.
  }
}

function carregarEstado(uid) {
  if (uidAtual && uidAtual !== uid) pauseTimer();
  uidAtual = uid;
  diaResultado = null;
  quizRenderizadoPara = null;

  let salvo = null;
  try {
    salvo = JSON.parse(localStorage.getItem(PREFIXO_ESTADO + uid) || 'null');
  } catch (e) {
    salvo = null;
  }

  const base = estadoInicial();
  if (salvo && typeof salvo === 'object') {
    base.dias = salvo.dias && typeof salvo.dias === 'object' && !Array.isArray(salvo.dias) ? salvo.dias : {};
    base.ativo = salvo.ativo && typeof salvo.ativo === 'object' ? salvo.ativo : null;
    base.rascunho = salvo.rascunho && typeof salvo.rascunho === 'object' ? salvo.rascunho : null;
  }
  S = base;
  sanitizarEstado();
}

// Garante formatos válidos. Nunca apaga registros reais de check-in ou desafio.
function sanitizarEstado() {
  for (const chave of Object.keys(S.dias)) {
    const reg = S.dias[chave];
    if (!/^[1-8]$/.test(chave) || !reg || typeof reg !== 'object') {
      delete S.dias[chave];
      continue;
    }
    if (!Array.isArray(reg.desafios)) reg.desafios = [];
    reg.desafios.forEach(d => {
      if (!d || typeof d !== 'object') return;
      if (!CH[d.nivel]) d.nivel = 'mod';
      if (!['aceito', 'concluido', 'nao_concluido'].includes(d.status)) d.status = 'nao_concluido';
      if (!Number.isFinite(d.pontos)) d.pontos = CH[d.nivel].pts;
    });
    reg.desafios = reg.desafios.filter(d => d && typeof d === 'object');
  }

  if (S.ativo) {
    const d = desafioAtivo();
    if (!d || d.status !== 'aceito') S.ativo = null;
  }

  if (S.rascunho) {
    const r = S.rascunho;
    const valido = Number.isInteger(r.dia) && Array.isArray(r.ans) && r.ans.length === QUESTIONS.length;
    if (!valido) S.rascunho = null;
  }
}

function registroDoDia(n) {
  if (!S.dias[n]) S.dias[n] = { checkin: null, desafios: [] };
  return S.dias[n];
}

function checkinDoDia(n) {
  return S.dias[n] && S.dias[n].checkin ? S.dias[n].checkin : null;
}

function desafiosDoDia(n) {
  return S.dias[n] && Array.isArray(S.dias[n].desafios) ? S.dias[n].desafios : [];
}

function desafioAtivo() {
  if (!S.ativo) return null;
  return desafiosDoDia(S.ativo.dia)[S.ativo.idx] || null;
}

/* ---------- Erros ---------- */

class ErroFluxo extends Error {
  constructor(mensagem, tipo, status = 0, retryAfter = null) {
    super(mensagem);
    this.tipo = tipo;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/* ---------- Interface: telas, avisos e verificação ---------- */

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.style.opacity = 1;
  setTimeout(() => { t.style.opacity = 0; }, 2400);
}

function mostrarCarregandoAcesso(ligado) {
  $('carregandoAcesso').classList.toggle('hidden', !ligado);
}

function mostrarTela(tela) {
  telaAtual = tela;
  if (tela !== 'app') pauseTimer();
  const intro = $('intro');
  intro.classList.toggle('hidden', !['marca', 'formulario', 'boasvindas'].includes(tela));
  $('espera').classList.toggle('hidden', tela !== 'espera');
  $('bloqueio').classList.toggle('hidden', tela !== 'bloqueio');
  const app = $('app');
  app.classList.toggle('hidden', tela !== 'app');
  app.classList.toggle('md:flex', tela === 'app');
}

function mostrarPassoIntro(passo) {
  const marca = $('brandStep');
  marca.classList.toggle('hidden', passo !== 'marca');
  if (passo === 'marca') marca.classList.remove('out');
  const nome = $('nameStep');
  nome.classList.toggle('hidden', passo !== 'nome');
  if (passo === 'nome') nome.classList.add('fade-in');
  $('welcomeStep').classList.toggle('hidden', passo !== 'boasvindas');
}

function mostrarFormulario(mensagem = '') {
  pararVerificacao();
  mostrarTela('formulario');
  mostrarPassoIntro('nome');
  $('formAviso').textContent = mensagem;
  $('nameSubmit').disabled = enviando || !supa;
}

function mostrarEspera(nome, aviso = '') {
  mostrarTela('espera');
  $('esperaNome').textContent = nome || '';
  $('esperaTexto').textContent = aviso || 'Aguarde a equipe liberar seu acesso. Esta tela será atualizada sozinha.';
  ativarVerificacao();
}

function mostrarBloqueio(titulo, texto) {
  pararVerificacao();
  mostrarTela('bloqueio');
  $('bloqueioTitulo').textContent = titulo;
  $('bloqueioTexto').textContent = texto;
}

function registrarVerificacao() {
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO });
  $('esperaUltima').textContent = `Última verificação às ${hora}`;
}

function ativarVerificacao() {
  pararVerificacao();
  if (document.hidden) return;
  timerVerificacao = setInterval(() => verificarAgora({ silencioso: true }), INTERVALO_VERIFICACAO_MS);
}

function pararVerificacao() {
  clearInterval(timerVerificacao);
  timerVerificacao = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pararVerificacao();
    return;
  }
  if (telaAtual === 'espera' || telaAtual === 'app') {
    verificarAgora({ silencioso: true });
    ativarVerificacao();
  }
});

window.addEventListener('online', () => {
  if (telaAtual === 'espera' || telaAtual === 'app') verificarAgora({ silencioso: true });
});

/* ---------- Supabase e rede ---------- */

async function iniciarCliente() {
  const resposta = await fetch(FUNCOES.config, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });
  if (!resposta.ok) throw new Error('config');
  const config = await resposta.json();
  if (!config.supabaseUrl || !config.supabasePublishableKey) throw new Error('config');

  const { createClient } = await import(SUPABASE_ESM);
  supa = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: CHAVE_SESSAO
    }
  });
}

async function sessaoLocal() {
  const { data, error } = await supa.auth.getSession();
  if (error || !data || !data.session) return null;
  return data.session;
}

async function encerrarSessao() {
  pararVerificacao();
  pauseTimer();
  acesso = null;
  acessoConfirmado = false;
  uidAtual = null;
  S = estadoInicial();
  diaResultado = null;
  quizRenderizadoPara = null;
  try {
    if (supa) await supa.auth.signOut();
  } catch (e) {
    // Ignorado: o estado local já foi limpo.
  }
}

function mensagemFalhaAcesso(error) {
  if (error && error.status === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  return 'Não foi possível iniciar seu acesso agora. Verifique sua internet e tente novamente.';
}

async function postServidor(url, { token, corpo } = {}) {
  const cabecalhos = {};
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  try {
    return await fetch(url, {
      method: 'POST',
      headers: cabecalhos,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    throw new ErroFluxo('Sem conexão. Verifique sua internet e tente novamente.', 'rede');
  }
}

async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch (e) {
    return {};
  }
}

async function tokenDaSessao(renovar = false) {
  if (renovar) {
    const { data, error } = await supa.auth.refreshSession();
    if (error || !data || !data.session) {
      throw new ErroFluxo('Não foi possível confirmar sua sessão.', 'sessao');
    }
    return data.session.access_token;
  }
  const sessao = await sessaoLocal();
  if (!sessao) throw new ErroFluxo('Sessão ausente.', 'sessao');
  return sessao.access_token;
}

// consultar-acesso: POST, sem corpo, somente com o token. Renova a sessão uma vez se necessário.
async function consultarServidor() {
  let resposta = await postServidor(FUNCOES.consultar, { token: await tokenDaSessao() });
  if (resposta.status === 401) {
    resposta = await postServidor(FUNCOES.consultar, { token: await tokenDaSessao(true) });
  }
  if (resposta.status === 401 || resposta.status === 403) {
    throw new ErroFluxo('Sessão inválida.', 'sessao', resposta.status);
  }
  const dados = await lerJson(resposta);
  if (!resposta.ok) {
    throw new ErroFluxo(dados.erro || 'Não foi possível verificar seu acesso agora.', 'servidor', resposta.status);
  }
  return dados;
}

function vinculado() {
  return !!acesso && !!acesso.status && acesso.status !== 'sem_solicitacao';
}

// Ações que criam ou concluem registros exigem uma confirmação recente do servidor.
function podeRegistrar() {
  return coletaLiberada() && acessoConfirmado;
}

// Cada chamada recebe um número. Só a mais recente atualiza a tela.
async function verificarAgora({ silencioso = false, aposEnvio = false } = {}) {
  const minha = ++seqAcesso;
  if (!silencioso) mostrarCarregandoAcesso(true);
  try {
    const dados = await consultarServidor();
    if (minha !== seqAcesso) return;
    acessoConfirmado = true;
    registrarVerificacao();
    aplicarAcesso(dados, { aposEnvio });
  } catch (err) {
    if (minha !== seqAcesso) return;
    tratarFalhaVerificacao(err, { silencioso });
  } finally {
    if (minha === seqAcesso) mostrarCarregandoAcesso(false);
  }
}

function tratarFalhaVerificacao(err, { silencioso }) {
  acessoConfirmado = false;

  if (err.tipo === 'sessao') {
    if (vinculado()) {
      mostrarBloqueio('Sessão não confirmada',
        'Não foi possível confirmar sua sessão. Recarregue a página. Se o problema continuar, procure a equipe.');
    } else {
      encerrarSessao().then(() => mostrarFormulario('Sua sessão expirou. Informe seu nome novamente.'));
    }
    return;
  }

  const mensagem = err.message || 'Não foi possível verificar seu acesso agora.';

  if (telaAtual === 'formulario' && solicitacaoEnviada) {
    mostrarEspera(ultimoNomeEnviado, 'Solicitação enviada. Não foi possível confirmar agora; tentaremos novamente.');
    return;
  }
  if (telaAtual === 'espera') {
    $('esperaUltima').textContent = `${mensagem} Tentaremos novamente.`;
    return;
  }
  if (telaAtual === 'app') {
    atualizarBloqueios();
    if (!silencioso) toast(mensagem);
    return;
  }
  mostrarBloqueio('Não foi possível verificar seu acesso', mensagem);
}

/* ---------- Aplicação da resposta do servidor ---------- */

function aplicarAcesso(dados, { aposEnvio = false } = {}) {
  acesso = dados;

  if (dados.pode_entrar === true) {
    entrarNoApp(aposEnvio);
    return;
  }

  if (dados.motivo === 'aguardando_autorizacao') {
    mostrarEspera(dados.nome || ultimoNomeEnviado);
    return;
  }

  if (dados.motivo === 'sem_solicitacao') {
    mostrarFormulario(aposEnvio ? MSG_SEM_REGISTRO : '');
    return;
  }

  mostrarBloqueio(
    TITULOS_BLOQUEIO[dados.motivo] || 'Acesso indisponível',
    dados.mensagem || 'Procure a equipe para verificar seu acesso.'
  );
}

// Só libera check-ins e desafios com o servidor autorizando e com período oficial conhecido.
function coletaLiberada() {
  return !!acesso && acesso.pode_entrar === true && acesso.coleta_liberada === true && dataInicioTeste() !== null;
}

function textoBloqueio(oque) {
  if (acesso && acesso.fase === 'antes_do_inicio' && acesso.periodo) {
    return `Os ${oque} começam em ${formatarData(acesso.periodo.inicio)}. Até lá, você pode explorar o aplicativo.`;
  }
  return `Os ${oque} ainda não estão liberados.`;
}

function entrarNoApp(comBoasVindas) {
  const nome = (acesso && acesso.nome) || '';
  $('greet').textContent = `Olá, ${nome}`;
  $('sideName').textContent = nome;
  $('hello').textContent = 'Seja bem-vindo(a)';
  $('whoName').textContent = nome;

  if (telaAtual === 'app') {
    atualizarBloqueios();
    return;
  }

  if (comBoasVindas) {
    pararVerificacao();
    mostrarTela('boasvindas');
    mostrarPassoIntro('boasvindas');
    setTimeout(() => {
      if (telaAtual === 'boasvindas') abrirApp();
    }, 2400);
    return;
  }
  abrirApp();
}

function abrirApp() {
  mostrarTela('app');
  mostrarSecao(secaoAtual || 'home');
  atualizarBloqueios();
  ativarVerificacao();
}

function atualizarBanner() {
  const banner = $('periodoBanner');
  const dia = diaDoTeste();
  let texto = '';
  if (acesso && acesso.pode_entrar === true) {
    if (!acessoConfirmado) {
      texto = MSG_SEM_CONFIRMACAO;
    } else if (!dataInicioTeste()) {
      texto = 'Acesso liberado. A data oficial do teste ainda não foi definida; os check-ins ainda não estão disponíveis.';
    } else if (acesso.fase === 'antes_do_inicio') {
      texto = `Acesso liberado. Os check-ins começam em ${formatarData(acesso.periodo.inicio)}. Use este tempo para preparar seu aparelho.`;
    } else if (dia === DIAS_DO_TESTE + 1) {
      texto = 'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Novos desafios não estão disponíveis.';
    } else if (acesso.fase === 'coleta') {
      texto = `Check-ins abertos até ${formatarData(acesso.periodo.fim, true)}.`;
    }
  }
  banner.textContent = texto;
  banner.classList.toggle('hidden', !texto);

  $('homeComecarNota').textContent = coletaLiberada()
    ? '3 perguntas, menos de 1 minuto'
    : 'Disponível quando os check-ins forem liberados';
}

// Recalcula tudo o que depende do servidor e da data oficial.
function atualizarBloqueios() {
  atualizarBanner();
  sincronizarDesafioAtivo();
  if (!coletaLiberada()) pauseTimer();
  if (secaoAtual === 'checkin') renderCheckin();
  if (secaoAtual === 'challenge') renderChallenge();
  if (secaoAtual === 'progress') renderProgress();
}

// Converte o prazo salvo em tempo restante (sem iniciar a contagem) e descarta desafios de outro dia.
function sincronizarDesafioAtivo() {
  const d = desafioAtivo();
  if (!d) {
    if (S.ativo) {
      S.ativo = null;
      salvarEstado();
    }
    return;
  }
  if (!running && d.prazo) {
    d.rem = restanteDoDesafio(d);
    d.prazo = null;
    salvarEstado();
  }
  const dia = diaDoTeste();
  if (dia !== null && dia !== S.ativo.dia) {
    descartarDesafioAtivo();
    return;
  }
  if (!coletaLiberada()) pauseTimer();
}

/* ---------- Abertura e formulário de entrada ---------- */

function construirMarca() {
  [...'Fair Play'].forEach((ch, i) => {
    const letra = document.createElement('span');
    letra.className = 'brand-letter';
    letra.style.animationDelay = (0.2 + i * 0.09) + 's';
    letra.textContent = ch === ' ' ? '\u00a0' : ch;
    $('brandWord').appendChild(letra);
  });
}

function validarNomeEstudante(valor) {
  const nome = valor.trim();
  if (!nome) return 'Digite seu primeiro nome para continuar.';
  if (nome.length < 2) return 'Informe pelo menos 2 letras.';
  if (nome.length > 40) return 'Use no máximo 40 caracteres.';
  if (/\s/.test(nome)) return 'Informe somente o seu primeiro nome.';
  if (!/^\p{L}[\p{L}'’-]*$/u.test(nome)) return 'Use apenas letras, sem números ou símbolos.';
  return '';
}

function mensagemErroSolicitacao(resposta) {
  if (resposta.status === 429) {
    const segundos = Number(resposta.headers.get('Retry-After')) || 0;
    const minutos = Math.max(1, Math.ceil(segundos / 60));
    return new ErroFluxo(
      `Muitas tentativas em pouco tempo. Aguarde cerca de ${minutos} minuto(s) e tente novamente.`,
      'limite', 429
    );
  }
  if (resposta.status === 400) {
    return new ErroFluxo('Confira o primeiro nome (somente letras) e o tipo de aparelho.', 'validacao', 400);
  }
  if (resposta.status === 401 || resposta.status === 403) {
    return new ErroFluxo('Não foi possível confirmar sua sessão. Tente novamente.', 'sessao', resposta.status);
  }
  return new ErroFluxo('Não foi possível registrar sua solicitação agora. Tente novamente.', 'servidor', resposta.status);
}

function definirEnvio(ligado) {
  enviando = ligado;
  const botao = $('nameSubmit');
  botao.disabled = ligado || !supa;
  botao.textContent = ligado ? 'ENVIANDO...' : 'CONTINUAR';
  $('nameInput').disabled = ligado;
  const aviso = $('formAviso');
  if (ligado) {
    aviso.textContent = 'Enviando sua solicitação...';
  } else if (aviso.textContent === 'Enviando sua solicitação...') {
    aviso.textContent = '';
  }
}

async function enviarSolicitacao() {
  if (enviando) return;

  const nome = $('nameInput').value.trim();
  const escolha = document.querySelector('input[name="tipo_dispositivo"]:checked');
  const tipo = escolha ? escolha.value : '';

  $('nameErr').textContent = '';
  $('deviceErr').textContent = '';
  $('formAviso').textContent = '';

  const erroNome = validarNomeEstudante(nome);
  if (erroNome) {
    $('nameErr').textContent = erroNome;
    $('nameInput').focus();
    return;
  }
  if (!TIPOS_APARELHO.has(tipo)) {
    $('deviceErr').textContent = 'Escolha se o aparelho é individual ou compartilhado.';
    return;
  }
  if (!supa) {
    $('formAviso').textContent = 'Não foi possível conectar. Atualize a página.';
    return;
  }

  ultimoNomeEnviado = nome;
  solicitacaoEnviada = false;
  definirEnvio(true);

  try {
    let sessao = await sessaoLocal();
    if (!sessao) {
      const { data, error } = await supa.auth.signInAnonymously();
      if (error || !data || !data.session) {
        throw new ErroFluxo(mensagemFalhaAcesso(error), 'auth');
      }
      sessao = data.session;
    }
    if (uidAtual !== sessao.user.id) carregarEstado(sessao.user.id);

    const resposta = await postServidor(FUNCOES.solicitar, {
      token: sessao.access_token,
      corpo: { nome, tipo_dispositivo: tipo }
    });
    if (resposta.status !== 202) throw mensagemErroSolicitacao(resposta);

    solicitacaoEnviada = true;
    await verificarAgora({ aposEnvio: true });
  } catch (err) {
    if (err.tipo === 'sessao') await encerrarSessao();
    $('formAviso').textContent = err.message || 'Algo deu errado. Tente novamente.';
  } finally {
    definirEnvio(false);
  }
}

/* ---------- Navegação ---------- */

function go(id) {
  mostrarSecao(id);
}

function mostrarSecao(id) {
  if (telaAtual !== 'app') return;
  const alvo = $(id);
  if (!alvo) return;

  secaoAtual = id;
  $$('.screen').forEach(s => s.classList.add('hidden'));
  alvo.classList.remove('hidden');
  alvo.style.animation = 'none';
  void alvo.offsetWidth;
  alvo.style.animation = '';

  $$('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === (id === 'result' ? 'checkin' : id)));

  if (id === 'checkin') renderCheckin();
  if (id === 'result') showResult();
  if (id === 'challenge') renderChallenge();
  if (id === 'progress') renderProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function aplicarIconesMenu() {
  $$('[data-nav]').forEach(botao => {
    const icone = botao.querySelector('span');
    if (icone && !icone.textContent.trim()) {
      icone.textContent = ICONES_MENU[botao.dataset.nav] || '';
    }
  });
}

document.addEventListener('click', e => {
  const botao = e.target.closest('[data-go]');
  if (botao) go(botao.dataset.go);
});

/* ---------- Check-in (um por dia do teste; Dia 8 só recupera o Dia 7) ---------- */

function estadoCheckin() {
  if (!coletaLiberada()) return { tipo: 'bloqueado', texto: textoBloqueio('check-ins') };

  const dia = diaDoTeste();
  let e;
  if (dia === DIAS_DO_TESTE + 1) {
    e = checkinDoDia(DIAS_DO_TESTE)
      ? { tipo: 'dia8_fechado', alvo: DIAS_DO_TESTE,
          texto: 'Hoje é o Dia 8. Seu check-in do Dia 7 já está registrado. Não há novo check-in neste dia.' }
      : { tipo: 'recuperacao', alvo: DIAS_DO_TESTE,
          texto: 'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Não há novo check-in para o Dia 8.' };
  } else if (dia >= 1 && dia <= DIAS_DO_TESTE) {
    e = checkinDoDia(dia)
      ? { tipo: 'ja_feito', alvo: dia,
          texto: `Seu check-in do Dia ${dia} já está registrado. Toque em VER MEU RESULTADO para revê-lo.` }
      : { tipo: 'novo', alvo: dia };
  } else {
    return { tipo: 'bloqueado', texto: MSG_CHECKIN_BLOQUEADO };
  }

  // Criar ou recuperar um check-in exige confirmação atual do servidor.
  if ((e.tipo === 'novo' || e.tipo === 'recuperacao') && !acessoConfirmado) {
    return { tipo: 'sem_confirmacao', texto: MSG_SEM_CONFIRMACAO };
  }
  return e;
}

function renderCheckin() {
  const e = estadoCheckin();
  const caixa = $('checkinBloqueio');
  const alerta = e.tipo === 'bloqueado' || e.tipo === 'sem_confirmacao';
  caixa.classList.toggle('hidden', e.tipo === 'novo');
  caixa.classList.toggle('aviso-alerta', alerta);
  caixa.classList.toggle('aviso-info', !alerta);
  $('checkinBloqueioTexto').textContent = e.texto || '';

  const mostrarQuiz = e.tipo !== 'bloqueado' && e.tipo !== 'sem_confirmacao';
  $('quizArea').classList.toggle('hidden', !mostrarQuiz);

  if (e.tipo === 'novo' || e.tipo === 'recuperacao') {
    renderQuiz(e.alvo);
  } else {
    limparQuiz();
  }
}

function renderQuiz(alvo) {
  if (!S.rascunho || S.rascunho.dia !== alvo) {
    S.rascunho = { dia: alvo, ans: QUESTIONS.map(() => null) };
    salvarEstado();
  }
  if (quizRenderizadoPara === alvo) return;
  quizRenderizadoPara = alvo;
  $('quizErr').textContent = '';
  $('quiz').innerHTML = QUESTIONS.map((q, i) => `<div class="q" data-q="${i}">
    <h2 class="qt font-display font-bold text-lg mb-3">${i + 1}. ${q.q}</h2>
    <div class="space-y-2">${q.o.map((t, j) => `<button class="opt${S.rascunho.ans[i] === j ? ' sel' : ''}" data-q="${i}" data-v="${j}">${t}</button>`).join('')}</div></div>`).join('');
}

function limparQuiz() {
  quizRenderizadoPara = null;
  $('quiz').innerHTML = '';
  $('quizErr').textContent = '';
}

function abrirResultado(dia) {
  diaResultado = dia;
  go('result');
}

$('quiz').addEventListener('click', e => {
  const botao = e.target.closest('.opt');
  if (!botao) return;
  const est = estadoCheckin();
  if (est.tipo !== 'novo' && est.tipo !== 'recuperacao') {
    toast(est.texto || MSG_CHECKIN_BLOQUEADO);
    return;
  }
  if (!S.rascunho || S.rascunho.dia !== est.alvo) return;

  const i = Number(botao.dataset.q);
  S.rascunho.ans[i] = Number(botao.dataset.v);
  salvarEstado();
  $$(`.opt[data-q="${i}"]`).forEach(o => o.classList.toggle('sel', o === botao));
  $sel(`.q[data-q="${i}"]`)?.classList.remove('missing');
  $('quizErr').textContent = '';
});

$('seeResult').addEventListener('click', () => {
  const est = estadoCheckin();
  if (est.tipo === 'ja_feito' || est.tipo === 'dia8_fechado') {
    abrirResultado(est.alvo);
    return;
  }
  if (est.tipo !== 'novo' && est.tipo !== 'recuperacao') {
    toast(est.texto || MSG_CHECKIN_BLOQUEADO);
    return;
  }

  const respostas = S.rascunho && S.rascunho.dia === est.alvo
    ? S.rascunho.ans
    : QUESTIONS.map(() => null);
  const faltando = respostas.map((a, i) => (a === null ? i : -1)).filter(i => i > -1);
  if (faltando.length) {
    faltando.forEach(i => $sel(`.q[data-q="${i}"]`)?.classList.add('missing'));
    $('quizErr').textContent = 'Responda todas as perguntas para ver seu resultado.';
    $sel(`.q[data-q="${faltando[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const pontuacao = respostas.reduce((a, b) => a + b, 0);
  const nivel = pontuacao <= 2 ? 'baixo' : pontuacao <= 4 ? 'mod' : 'alto';
  registroDoDia(est.alvo).checkin = {
    respostas: respostas.slice(),
    pontuacao,
    nivel,
    registradoEm: new Date().toISOString(),
    recuperado: est.tipo === 'recuperacao'
  };
  S.rascunho = null;
  salvarEstado();
  abrirResultado(est.alvo);
});

/* ---------- Resultado (do dia indicado) ---------- */

function showResult() {
  const c = diaResultado ? checkinDoDia(diaResultado) : null;
  if (!c) {
    go('checkin');
    return;
  }

  const r = RESULTS[c.nivel] || RESULTS.mod;
  $('resEmoji').textContent = r.emoji;
  $('resTitle').textContent = r.title;
  $('resText').textContent = r.text;
  $('resRec').textContent = r.rec;
  $('resTipCard').classList.toggle('hidden', !r.tip);
  $('resTip').textContent = r.tip || '';
  $('lvlLabel').textContent = r.label;
  $('lvlLabel').style.color = r.color === '#FACC15' ? '#a16207' : r.color;

  const segmentos = $$('#gauge .seg');
  segmentos.forEach(s => { s.style.background = ''; });
  setTimeout(() => segmentos.forEach((s, i) => {
    if (i < r.n) s.style.background = r.color;
  }), 150);
}

/* ---------- Desafio e cronômetro (um por dia do teste) ---------- */

function nivelHoje() {
  const dia = diaDoTeste();
  if (dia === null || dia < 1 || dia > DIAS_DO_TESTE) return null;
  const c = checkinDoDia(dia);
  return c ? c.nivel : null;
}

// Nível para um desafio novo: check-in de hoje, ou o mais recente anterior, ou padrão.
function nivelDesafioNovo() {
  const hoje = nivelHoje();
  if (hoje) return hoje;
  const dia = diaDoTeste();
  const limite = dia === null ? DIAS_DO_TESTE : Math.min(Math.max(dia, 0), DIAS_DO_TESTE);
  for (let n = limite; n >= 1; n--) {
    const c = checkinDoDia(n);
    if (c) return c.nivel;
  }
  return 'mod';
}

// Tempo restante do desafio, sempre entre 0 e a duração total.
function restanteDoDesafio(d) {
  const total = CH[d.nivel].min * 60;
  let r;
  if (d.prazo) {
    r = Math.ceil((d.prazo - Date.now()) / 1000);
  } else {
    r = Number.isFinite(d.rem) ? Math.floor(d.rem) : total;
  }
  return Math.min(total, Math.max(0, r));
}

function formatarTempo(segundos) {
  return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

function draw() {
  const d = desafioAtivo();
  if (!d) return;
  const total = CH[d.nivel].min * 60;
  const r = restanteDoDesafio(d);
  $('clock').textContent = formatarTempo(r);
  $('ring').style.strokeDasharray = C;
  $('ring').style.strokeDashoffset = C * (1 - r / total);
}

function atualizarBotoesTimer() {
  const d = desafioAtivo();
  const r = d ? restanteDoDesafio(d) : 0;
  $('pause').textContent = running ? 'PAUSAR' : 'RETOMAR';
  $('pause').disabled = !d || !coletaLiberada() || (!running && r <= 0);
  $('finish').disabled = !d || !podeRegistrar();
}

function startTimer() {
  if (running) return;
  const d = desafioAtivo();
  if (!d || d.status !== 'aceito' || !coletaLiberada()) return;

  const r = restanteDoDesafio(d);
  if (r <= 0) {
    draw();
    atualizarBotoesTimer();
    return;
  }

  clearInterval(iv);
  d.rem = r;
  d.prazo = Date.now() + r * 1000;
  running = true;
  salvarEstado();
  atualizarBotoesTimer();
  iv = setInterval(tick, 1000);
  tick();
}

// Pausa o cronômetro e grava o tempo restante. Não registra nada.
function pauseTimer() {
  clearInterval(iv);
  iv = null;
  const d = desafioAtivo();
  if (d && d.prazo) {
    d.rem = restanteDoDesafio(d);
    d.prazo = null;
    salvarEstado();
  }
  running = false;
  atualizarBotoesTimer();
  draw();
}

function tick() {
  const d = desafioAtivo();
  if (!d) {
    pauseTimer();
    return;
  }
  const dia = diaDoTeste();
  if (dia !== null && dia !== S.ativo.dia) {
    descartarDesafioAtivo();
    return;
  }
  if (!coletaLiberada()) {
    pauseTimer();
    return;
  }
  const r = restanteDoDesafio(d);
  if (r <= 0) {
    pauseTimer();
    concluirDesafio({ automatico: true });
    return;
  }
  d.rem = r;
  draw();
  salvarEstado();
}

// Desafio aceito em um dia e não concluído nele: não é contabilizado em outro dia.
function descartarDesafioAtivo() {
  const d = desafioAtivo();
  pauseTimer();
  if (d && d.status === 'aceito') {
    d.status = 'nao_concluido';
    d.prazo = null;
  }
  S.ativo = null;
  salvarEstado();
  renderChallenge();
  if (telaAtual === 'app') {
    toast('O desafio do dia anterior não foi concluído a tempo e não foi contabilizado.');
  }
}

function concluirDesafio({ automatico = false } = {}) {
  const d = desafioAtivo();
  if (!d || d.status !== 'aceito') return;

  const dia = diaDoTeste();
  if (dia !== null && dia !== S.ativo.dia) {
    descartarDesafioAtivo();
    return;
  }
  if (!podeRegistrar()) {
    pauseTimer();
    if (automatico && coletaLiberada()) {
      toast(MSG_TEMPO_AGUARDANDO);
    } else {
      toast(coletaLiberada() ? MSG_SEM_CONFIRMACAO : MSG_DESAFIO_BLOQUEADO);
    }
    renderChallenge();
    return;
  }

  pauseTimer();
  d.status = 'concluido';
  d.rem = 0;
  d.concluidoEm = new Date().toISOString();
  S.ativo = null;
  salvarEstado();

  const e = estatisticas();
  toast(e.concluidos % 3 === 0
    ? `Desafio concluído! +${d.pontos} pontos e nova medalha!`
    : `Desafio concluído! +${d.pontos} pontos`);
  renderChallenge();
  setTimeout(() => {
    if (telaAtual === 'app') go('progress');
  }, 1600);
}

function renderChallenge() {
  const d = desafioAtivo();
  const c = CH[d ? d.nivel : nivelDesafioNovo()];
  $('chTag').textContent = c.tag;
  $('chTitle').textContent = c.title;
  $('chText').textContent = c.text;
  $('chPts').textContent = `+${c.pts} pontos`;
  $('chList').innerHTML = c.list.map(k => `<li class="chip">${ACT[k]}</li>`).join('');

  const liberado = coletaLiberada();
  const dia = diaDoTeste();
  const emDia = liberado && dia >= 1 && dia <= DIAS_DO_TESTE;
  const jaTemDesafioHoje = emDia && desafiosDoDia(dia).length > 0;

  let aviso = '';
  if (!liberado) {
    aviso = textoBloqueio('desafios');
  } else if (!acessoConfirmado) {
    aviso = MSG_SEM_CONFIRMACAO;
  } else if (!d && jaTemDesafioHoje) {
    aviso = MSG_UM_POR_DIA;
  }
  $('desafioBloqueioTexto').textContent = aviso;
  $('desafioBloqueio').classList.toggle('hidden', !aviso);
  $('dia8Aviso').classList.toggle('hidden', !(liberado && dia === DIAS_DO_TESTE + 1));
  $('chNote').classList.toggle('hidden', !!d || !!nivelHoje());

  const botao = $('accept');
  botao.textContent = d ? '✓ DESAFIO ACEITO' : 'ACEITAR DESAFIO';
  botao.classList.toggle('done', !!d);
  botao.disabled = !!d || !emDia || !acessoConfirmado || jaTemDesafioHoje;

  $('acceptMsg').classList.toggle('hidden', !d);
  $('timerBox').classList.toggle('hidden', !d);
  if (d) draw();
  atualizarBotoesTimer();
}

$('accept').addEventListener('click', () => {
  if (S.ativo) return;
  if (!coletaLiberada()) {
    toast(MSG_DESAFIO_BLOQUEADO);
    return;
  }
  if (!acessoConfirmado) {
    toast(MSG_SEM_CONFIRMACAO);
    return;
  }
  const dia = diaDoTeste();
  if (dia === DIAS_DO_TESTE + 1) {
    toast(MSG_DIA8);
    return;
  }
  if (dia < 1 || dia > DIAS_DO_TESTE) {
    toast(MSG_DESAFIO_BLOQUEADO);
    return;
  }
  if (desafiosDoDia(dia).length > 0) {
    toast(MSG_UM_POR_DIA);
    return;
  }

  const nivel = nivelDesafioNovo();
  const reg = registroDoDia(dia);
  reg.desafios.push({
    nivel,
    status: 'aceito',
    pontos: CH[nivel].pts,
    aceitoEm: new Date().toISOString(),
    concluidoEm: null,
    rem: CH[nivel].min * 60,
    prazo: null
  });
  S.ativo = { dia, idx: reg.desafios.length - 1 };
  salvarEstado();
  renderChallenge();
  startTimer();
});

$('pause').addEventListener('click', () => {
  if (running) {
    pauseTimer();
    return;
  }
  if (!coletaLiberada()) {
    toast(MSG_DESAFIO_BLOQUEADO);
    return;
  }
  startTimer();
});

$('finish').addEventListener('click', () => concluirDesafio());

/* ---------- Progresso (Dia 1 a Dia 7 da data oficial) ---------- */

function estatisticas() {
  let aceitos = 0;
  let concluidos = 0;
  let pontos = 0;
  let sequenciaAtual = 0;
  let maiorSequencia = 0;

  for (let n = 1; n <= DIAS_DO_TESTE; n++) {
    const lista = desafiosDoDia(n);
    const feitos = lista.filter(d => d.status === 'concluido');
    aceitos += lista.filter(d => d.status !== 'nao_concluido').length;
    concluidos += feitos.length;
    pontos += feitos.reduce((soma, d) => soma + (d.pontos || 0), 0);
    if (feitos.length) {
      sequenciaAtual++;
      maiorSequencia = Math.max(maiorSequencia, sequenciaAtual);
    } else {
      sequenciaAtual = 0;
    }
  }
  return { aceitos, concluidos, pontos, sequencia: maiorSequencia };
}

// Um desafio por dia: concluído = 100%; em andamento = 30%; sem desafio ou não concluído = 0%.
function pctDia(n) {
  const lista = desafiosDoDia(n);
  if (lista.some(d => d.status === 'concluido')) return 100;
  if (lista.some(d => d.status === 'aceito')) return 30;
  return 0;
}

// Substitui somente o texto fixo de regra da tela de progresso (index.html não é alterado).
function ajustarRegraProgresso() {
  const paragrafo = $$('#progress p').find(p => p.textContent.trim().startsWith('Cada dia vale'));
  if (paragrafo) {
    paragrafo.textContent = 'Cada dia do teste permite um único desafio. Desafio em andamento vale 30%; desafio concluído vale 100%. O dia de hoje fica em destaque.';
  }
}

function renderProgress() {
  const e = estatisticas();
  $('stPts').textContent = e.pontos;
  $('stAcc').textContent = e.aceitos;
  $('stDone').textContent = e.concluidos;
  $('stStreak').textContent = e.sequencia;
  $('progressoVazio').classList.toggle('hidden', e.aceitos > 0);

  const dia = diaDoTeste();
  const hoje = dia !== null && dia >= 1 ? Math.min(dia, DIAS_DO_TESTE) : 0;
  const inicio = dataInicioTeste();

  $('week').innerHTML = Array.from({ length: DIAS_DO_TESTE }, (_, i) => {
    const n = i + 1;
    const p = pctDia(n);
    const data = inicio ? formatarDataCurta(somarDias(inicio, i)) : 'data a definir';
    const destaque = n === hoje ? 'bg-brand/5' : '';
    const rotulo = n === hoje ? 'font-extrabold text-brand' : 'font-semibold';
    const apagado = hoje > 0 && n > hoje ? 'opacity-50' : '';
    return `<div class="flex items-center gap-3 rounded-xl px-2 py-1 ${destaque} ${apagado}">
      <span class="w-24 text-sm ${rotulo}">Dia ${n}<br><span class="text-xs font-normal text-slate-500">${data}</span></span>
      <div class="bar flex-1"><div class="fill bg-go" data-w="${p}"></div></div>
      <span class="w-10 text-right text-sm font-bold">${p}%</span></div>`;
  }).join('');

  const valores = [];
  for (let n = 1; n <= hoje; n++) valores.push(pctDia(n));
  const media = valores.length ? Math.round(valores.reduce((a, b) => a + b, 0) / valores.length) : 0;
  $('weekPct').textContent = `${media}%`;

  const falta = 3 - (e.concluidos % 3);
  $('nextText').textContent = `Complete mais ${falta} ${falta === 1 ? 'desafio' : 'desafios'} para desbloquear uma nova medalha.`;
  $('nextBar').style.width = '0';

  let nota = 'Este progresso fica guardado somente neste aparelho, separado por identidade. A gravação definitiva no servidor será implementada em uma próxima etapa. Desafios de dias anteriores não concluídos permanecem no histórico.';
  if (!inicio) nota += ' A data oficial do teste ainda não foi definida, por isso nenhum dia é contabilizado.';
  if (!acessoConfirmado) nota += ' Sem confirmação do servidor agora, novos registros estão bloqueados.';
  $('progressoNota').textContent = nota;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$('#week .fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
    $('nextBar').style.width = ((3 - falta) / 3 * 100) + '%';
  }));
}

/* ---------- Telas de espera e bloqueio: botões ---------- */

$('esperaVerificar').addEventListener('click', async () => {
  const botao = $('esperaVerificar');
  botao.disabled = true;
  try {
    await verificarAgora();
  } finally {
    botao.disabled = false;
  }
});

$('bloqueioVerificar').addEventListener('click', async () => {
  const botao = $('bloqueioVerificar');
  botao.disabled = true;
  try {
    await verificarAgora();
  } finally {
    botao.disabled = false;
  }
});

/* ---------- Formulário de entrada ---------- */

$('nameInput').addEventListener('input', () => { $('nameErr').textContent = ''; });
document.querySelectorAll('input[name="tipo_dispositivo"]').forEach(radio => {
  radio.addEventListener('change', () => { $('deviceErr').textContent = ''; });
});
$('nameStep').addEventListener('submit', e => {
  e.preventDefault();
  enviarSolicitacao();
});

/* ---------- Inicialização ---------- */

function criarNotaProgresso() {
  const nota = document.createElement('p');
  nota.id = 'progressoNota';
  nota.className = 'mt-4 text-xs text-slate-500';
  $('progress').appendChild(nota);
}

async function iniciar() {
  construirMarca();
  aplicarIconesMenu();
  criarNotaProgresso();
  ajustarRegraProgresso();
  mostrarTela('marca');
  mostrarPassoIntro('marca');

  try {
    await iniciarCliente();
  } catch (err) {
    mostrarFormulario('Não foi possível conectar agora. Atualize a página e tente novamente.');
    return;
  }

  let sessao = null;
  try {
    sessao = await sessaoLocal();
  } catch (err) {
    sessao = null;
  }

  if (sessao) {
    // Identidade já existente neste navegador: o servidor decide o que mostrar.
    carregarEstado(sessao.user.id);
    await verificarAgora();
    return;
  }

  // Primeiro acesso: apresentação e formulário. Nenhuma identidade é criada antes do envio.
  setTimeout(() => { $('brandStep').classList.add('out'); }, 2500);
  setTimeout(() => mostrarFormulario(''), 2900);
}

iniciar().catch(() => {
  mostrarFormulario('Algo deu errado. Atualize a página e tente novamente.');
});