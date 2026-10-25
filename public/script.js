
/*
 * FAIR PLAY — SCRIPT DO ESTUDANTE
 * Ambiente: TESTE
 * Catálogo: rascunho 2026.1
 *
 * 7 dias, 5 perguntas por dia.
 *
 * A autenticação utiliza Supabase Auth anônimo.
 * A autorização utiliza Netlify Functions.
 *
 * Atenção: check-ins e desafios ainda são
 * armazenados localmente no navegador.
 */

const FUNCOES = {
  config: '/.netlify/functions/config-public',
  solicitar: '/.netlify/functions/solicitar-acesso',
  consultar: '/.netlify/functions/consultar-acesso'
};

const SUPABASE_ESM =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const CHAVE_SESSAO = 'fairplay-estudante-auth';
const PREFIXO_ESTADO = 'fairplay-v5:';
const INTERVALO_VERIFICACAO_MS = 30000;
const FUSO = 'America/Fortaleza';
const DIAS_DO_TESTE = 7;
const TIPO_DISPOSITIVO_PADRAO = 'individual';

const MSG_SEM_REGISTRO =
  'Ainda não há uma solicitação registrada para este nome. Confira o nome com a equipe e tente novamente. Se você já enviou uma solicitação antes, procure o gestor.';

const MSG_CHECKIN_BLOQUEADO =
  'Os check-ins ainda não estão liberados.';

const MSG_DESAFIO_BLOQUEADO =
  'Os desafios ainda não estão liberados.';

const MSG_DIA8 =
  'No Dia 8 não é possível iniciar novos desafios. Você pode apenas recuperar o check-in do Dia 7.';

const MSG_UM_POR_DIA =
  'Você já tem um desafio registrado para este dia do teste. Só é possível um desafio por dia.';

const MSG_SEM_CONFIRMACAO =
  'Sem confirmação do servidor agora. Seus dados continuam salvos neste aparelho. Check-ins, desafios aceitos e conclusões serão liberados quando a conexão for confirmada.';

const MSG_TEMPO_AGUARDANDO =
  'O tempo terminou. Toque em CONCLUIR quando a conexão for confirmada.';

const MSG_ESPERA_FALHA =
  'Não foi possível confirmar agora. Tentaremos novamente.';

const TITULOS_BLOQUEIO = {
  recusada: 'Solicitação não aceita',
  revogada: 'Acesso encerrado',
  expirada: 'Acesso expirado',
  periodo_nao_configurado: 'Período ainda não definido',
  periodo_encerrado: 'Período encerrado',
  erro_interno: 'Acesso indisponível'
};

const BLOQUEIO_PARTICIPANTE_INATIVO = {
  titulo: 'Seu acesso está temporariamente indisponível',
  texto:
    'No momento, sua participação no Fair Play não está habilitada. Caso precise de ajuda, converse com a equipe responsável.'
};

/*
 * CATÁLOGO ORIGINAL DE 35 PERGUNTAS
 *
 * Transcrição do rascunho 2026.1.
 *
 * Cada alternativa possui um dos códigos:
 * 0, 1, 2 = resposta pontuável.
 * "i" = resposta informativa.
 * "n" = resposta não aplicável.
 *
 * As pontuações são educativas e provisórias.
 */

const DADOS_QUESTIONARIO = [
  // DIA 1 — Tempo de jogo e rotina
  [
    [
      "Quanto tempo você jogou hoje?",
      [
        ["Não joguei", "i"],
        ["Menos de 1 hora", "i"],
        ["De 1 a 3 horas", "i"],
        ["Mais de 3 horas", "i"]
      ]
    ],
    [
      "Você deixou alguma tarefa de lado para passar mais tempo jogando?",
      [
        ["Não, fiz minhas tarefas", 0],
        ["Sim, deixei uma tarefa", 1],
        ["Sim, deixei várias tarefas", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você jogou mais tempo do que planejava?",
      [
        ["Não", 0],
        ["Um pouco", 1],
        ["Muito", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você fez pausas enquanto jogava?",
      [
        ["Sim", 0],
        ["Às vezes", 1],
        ["Não", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você fez alguma atividade fora das telas hoje?",
      [
        ["Sim, várias", "i"],
        ["Sim, uma", "i"],
        ["Não", "i"]
      ]
    ]
  ],

  // DIA 2 — Estudos e responsabilidades
  [
    [
      "Você deixou alguma tarefa para depois porque queria jogar?",
      [
        ["Não", 0],
        ["Sim, uma tarefa", 1],
        ["Sim, várias tarefas", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Hoje, os jogos atrapalharam seu tempo de estudo?",
      [
        ["Não atrapalharam", 0],
        ["Atrapalharam um pouco", 1],
        ["Atrapalharam muito", 2],
        ["Não estudei hoje", "n"]
      ]
    ],
    [
      "Você jogou antes de terminar suas responsabilidades?",
      [
        ["Não", 0],
        ["Sim, mas consegui terminar depois", 1],
        ["Sim, e deixei tarefas sem fazer", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você conseguiu respeitar o horário que separou para estudar hoje?",
      [
        ["Sim, consegui", 0],
        ["Consegui em parte", "i"],
        ["Não consegui porque fiquei jogando", 2],
        ["Não tinha horário de estudo hoje", "n"]
      ]
    ],
    [
      "Depois de jogar, você ainda teve tempo para suas outras atividades?",
      [
        ["Sim, tive tempo", 0],
        ["Tive pouco tempo", 1],
        ["Não tive tempo", 2],
        ["Não joguei", "n"]
      ]
    ]
  ],

  // DIA 3 — Sono e descanso
  [
    [
      "Você ficou jogando até mais tarde do que deveria?",
      [
        ["Não", 0],
        ["Sim, um pouco", 1],
        ["Sim, por muito tempo", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você deixou de dormir para continuar jogando?",
      [
        ["Não", 0],
        ["Sim, uma vez", 1],
        ["Sim, mais de uma vez", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Como você se sentiu ao acordar hoje?",
      [
        ["Descansado", "i"],
        ["Um pouco cansado", "i"],
        ["Muito cansado", "i"]
      ]
    ],
    [
      "Você sentiu sono durante suas atividades hoje?",
      [
        ["Não", "i"],
        ["Algumas vezes", "i"],
        ["Muitas vezes", "i"]
      ]
    ],
    [
      "Antes de dormir, você conseguiu parar de jogar com tranquilidade?",
      [
        ["Sim, sem dificuldade", 0],
        ["Tive um pouco de dificuldade", 1],
        ["Tive muita dificuldade", 2],
        ["Não joguei antes de dormir", "n"]
      ]
    ]
  ],

  // DIA 4 — Pausas e autocontrole
  [
    [
      "Você conseguiu fazer pausas enquanto jogava hoje?",
      [
        ["Sim, fiz pausas", 0],
        ["Fiz poucas pausas", 1],
        ["Não fiz pausas", 2],
        ["Não joguei hoje", "n"]
      ]
    ],
    [
      "Quando precisou parar de jogar, como foi?",
      [
        ["Parei sem dificuldade", 0],
        ["Demorei um pouco para parar", 1],
        ["Tive muita dificuldade", 2],
        ["Não precisei parar", "n"]
      ]
    ],
    [
      "Você jogou por mais tempo do que tinha planejado?",
      [
        ["Não, respeitei meu tempo", 0],
        ["Sim, um pouco mais", 1],
        ["Sim, muito mais", 2],
        ["Não joguei hoje", "n"]
      ]
    ],
    [
      "Quando alguém pediu para você parar de jogar, o que aconteceu?",
      [
        ["Parei tranquilamente", 0],
        ["Pedi mais alguns minutos", 1],
        ["Fiquei irritado ou discuti", 2],
        ["Ninguém pediu para parar", "n"]
      ]
    ],
    [
      "Você conseguiu deixar o jogo de lado para fazer outra atividade?",
      [
        ["Sim, sem dificuldade", 0],
        ["Sim, mas foi difícil", 1],
        ["Não consegui", 2],
        ["Não precisei parar de jogar", "n"]
      ]
    ]
  ],

  // DIA 5 — Lazer e atividades fora das telas
  [
    [
      "Além de jogar, você fez alguma outra atividade divertida hoje?",
      [
        ["Sim, várias atividades", "i"],
        ["Sim, uma atividade", "i"],
        ["Não fiz outras atividades", "i"],
        ["Não joguei hoje", "n"]
      ]
    ],
    [
      "Você deixou de passar tempo com amigos ou familiares porque preferiu jogar?",
      [
        ["Não", 0],
        ["Sim, por um tempo", 1],
        ["Sim, deixei de participar de um momento com eles", 2],
        ["Não tive essa oportunidade", "n"]
      ]
    ],
    [
      "Você fez alguma atividade física hoje, como correr, caminhar ou praticar esportes?",
      [
        ["Sim", "i"],
        ["Um pouco", "i"],
        ["Não", "i"]
      ]
    ],
    [
      "Você deixou de sair ou fazer alguma atividade para ficar jogando?",
      [
        ["Não, fiz minhas atividades normalmente", 0],
        ["Sim, preferi jogar em vez de sair", 1],
        ["Sim, deixei de fazer outras atividades para jogar", 1],
        ["Não joguei hoje", "n"]
      ]
    ],
    [
      "Como você dividiu seu tempo livre hoje?",
      [
        ["Entre jogos e outras atividades", 0],
        ["Mais com outras atividades", 0],
        ["Quase todo com jogos", 2],
        ["Não tive tempo livre", "n"]
      ]
    ]
  ],

  // DIA 6 — Emoções e hábitos
  [
    [
      "Como você se sente quando está jogando?",
      [
        ["Feliz e tranquilo", "i"],
        ["Animado demais", "i"],
        ["Às vezes fico irritado", "i"],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você fica irritado quando perde uma partida?",
      [
        ["Não, faz parte do jogo", 0],
        ["Às vezes", 1],
        ["Fico muito irritado", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Quando não pode jogar, como você reage?",
      [
        ["Fico tranquilo", 0],
        ["Fico um pouco chateado", 1],
        ["Fico muito irritado", 2],
        ["Não aconteceu comigo", "n"]
      ]
    ],
    [
      "Você já ficou tão envolvido em um jogo que perdeu a noção do tempo?",
      [
        ["Não, consegui controlar o tempo", 0],
        ["Sim, por alguns minutos", 1],
        ["Sim, por bastante tempo", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Como você costuma se sentir depois de passar muito tempo jogando?",
      [
        ["Tranquilo e satisfeito", "i"],
        ["Um pouco cansado", "i"],
        ["Irritado ou estressado", "i"],
        ["Não passei muito tempo jogando", "n"]
      ]
    ]
  ],

  // DIA 7 — Organização e equilíbrio
  [
    [
      "Você conseguiu equilibrar o tempo de jogo com suas outras atividades?",
      [
        ["Sim, consegui", 0],
        ["Consegui em parte", 1],
        ["Não consegui", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você definiu um tempo para jogar antes de começar?",
      [
        ["Sim, e respeitei", 0],
        ["Sim, mas passei do tempo", 1],
        ["Não defini um tempo", "i"],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Você conseguiu fazer suas atividades importantes antes de jogar?",
      [
        ["Sim, fiz minhas atividades", 0],
        ["Fiz apenas algumas", "i"],
        ["Não, preferi jogar", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "Quando terminou de jogar, ainda teve tempo para descansar?",
      [
        ["Sim, tive tempo", 0],
        ["Tive pouco tempo", 1],
        ["Não tive tempo", 2],
        ["Não joguei", "n"]
      ]
    ],
    [
      "O que você acha que poderia melhorar na sua rotina com os jogos?",
      [
        ["Organizar melhor meus horários", "i"],
        ["Fazer mais pausas", "i"],
        ["Ter mais tempo para outras atividades", "i"],
        ["Minha rotina já está equilibrada", "i"]
      ]
    ]
  ]
];

/*
 * Transforma o catálogo em objetos com IDs estáveis.
 */
const PERGUNTAS_POR_DIA = DADOS_QUESTIONARIO.map(
  (lista, indiceDia) =>
    lista.map(([texto, alternativas], indicePergunta) => {
      const id =
        `D${String(indiceDia + 1).padStart(2, '0')}_P${indicePergunta + 1}`;

      return {
        id,
        q: texto,
        o: alternativas.map(([rotulo, codigo], indiceAlternativa) => ({
          id: `${id}_A${indiceAlternativa + 1}`,
          texto: rotulo,
          tipo:
            typeof codigo === 'number'
              ? 'pontuavel'
              : codigo === 'i'
                ? 'informativa'
                : 'nao_aplicavel',
          valor: typeof codigo === 'number' ? codigo : null
        }))
      };
    })
);

function perguntasDoDia(dia) {
  return PERGUNTAS_POR_DIA[Number(dia) - 1] || [];
}

/*
 * RESULTADOS EDUCATIVOS
 */
const RESULTS = {
  baixo: {
    n: 1,
    label: 'Baixo',
    emoji: '🟢',
    color: '#22C55E',
    title: 'Bom equilíbrio nos seus hábitos',
    text:
      'Suas respostas mostram uma boa relação entre jogos e outras atividades. Continue observando sua rotina para manter esse equilíbrio.',
    rec:
      'Mantenha o que já funciona: combine horários de jogo com estudos, descanso e tempo com a família.',
    tip: null
  },

  mod: {
    n: 2,
    label: 'Moderado',
    emoji: '🟡',
    color: '#FACC15',
    title: 'Atenção aos seus hábitos',
    text:
      'Algumas das suas respostas indicam que pode ser interessante observar melhor seu tempo de jogo e buscar um equilíbrio maior com outras atividades.',
    rec:
      'Experimente estabelecer um período para estudar ou realizar outra atividade antes de começar a jogar.',
    tip:
      'Combine com sua família um horário fixo para jogar e outro para estudar. Ter horários definidos ajuda a respeitar os limites.'
  },

  alto: {
    n: 3,
    label: 'Alto',
    emoji: '🟠',
    color: '#F97316',
    title: 'Hora de ajustar a rotina',
    text:
      'Suas respostas sugerem que os jogos podem estar ocupando bastante espaço no seu dia. Pequenos passos podem ajudar a reorganizar a rotina.',
    rec:
      'Converse com alguém de confiança e combine pausas entre as partidas, começando por uma atividade fora das telas.',
    tip:
      'Prefira partidas curtas. Ao terminar cada uma, levante, beba água e faça uma pausa antes de começar outra.'
  },

  neutro: {
    n: 0,
    label: 'Sem classificação',
    emoji: '',
    color: '#64748b',
    title: 'Obrigado por participar',
    text:
      'Você respondeu às cinco perguntas. Nem todas se aplicavam à sua rotina, então não há classificação neste dia.',
    rec:
      'Continue acompanhando seus hábitos e organizando tempo para descanso, estudos e lazer.',
    tip: null
  }
};

/*
 * ATIVIDADES E DESAFIOS
 *
 * Esta parte preserva os desafios do script recebido.
 * A revisão completa dos 21 desafios fica para outra etapa.
 */
const ACT = {
  study: ' Estudar ',
  sport: ' Fazer atividade física ',
  draw: ' Desenhar ',
  read: ' Ler ',
  family: ' Fazer algo com a família ',
  rest: ' Descansar '
};

const CH = {
  baixo: {
    tag: 'Missão de manutenção',
    title: '20 minutos de pausa ativa',
    min: 20,
    pts: 30,
    text:
      'Seu equilíbrio está bom! Para mantê-lo, depois de uma sessão de jogo faça uma pausa de 20 minutos com uma atividade fora das telas.',
    list: ['sport', 'read', 'draw', 'family', 'rest']
  },

  mod: {
    tag: 'Missão de organização da rotina',
    title: '30 minutos antes do jogo',
    min: 30,
    pts: 50,
    text:
      'Antes de iniciar sua próxima sessão de jogo, escolha uma atividade fora das telas durante 30 minutos e organize o horário do seu dia.',
    list: ['study', 'sport', 'draw', 'read', 'family']
  },

  alto: {
    tag: 'Missão Offline',
    title: '45 minutos sem telas',
    min: 45,
    pts: 70,
    text:
      'Reduza o tempo de tela hoje: fique 45 minutos sem telas antes de jogar de novo. Comece por algo de que você goste.',
    list: ['study', 'sport', 'draw', 'read', 'family']
  },

  neutro: {
    tag: 'Atividade de bem-estar',
    title: 'Uma pausa para fazer o que gosta',
    min: 20,
    pts: 20,
    text:
      'Faça uma pequena atividade fora das telas, no seu ritmo. O cronômetro é apenas um apoio opcional.',
    list: ['read', 'draw', 'family', 'rest']
  }
};

const C = 2 * Math.PI * 54;

const $ = id => document.getElementById(id);
const $$ = seletor => [...document.querySelectorAll(seletor)];
const $sel = seletor => document.querySelector(seletor);

/*
 * ESTADO DA APLICAÇÃO
 */
let supa = null;
let acesso = null;
let acessoConfirmado = false;
let telaAtual = 'marca';
let secaoAtual = 'home';
let seqAcesso = 0;
let enviando = false;
let solicitacaoEnviada = false;
let ultimoNomeEnviado = '';
let timerVerificacao = null;
let iv = null;
let running = false;
let diaResultado = null;
let quizRenderizadoPara = null;
let S = estadoInicial();
let uidAtual = null;

/*
 * DATAS E PERÍODO DO TESTE
 */
function hojeFortaleza(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(agora);

  const pegar = tipo =>
    partes.find(p => p.type === tipo).value;

  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
}

function somarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);

  return new Date(
    Date.UTC(y, m - 1, d + n)
  ).toISOString().slice(0, 10);
}

function diferencaDias(de, ate) {
  const [y1, m1, d1] = de.split('-').map(Number);
  const [y2, m2, d2] = ate.split('-').map(Number);

  return Math.round(
    (
      Date.UTC(y2, m2 - 1, d2) -
      Date.UTC(y1, m1 - 1, d1)
    ) / 86400000
  );
}

function formatarData(valor, comHora = false) {
  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return '—';
  }

  return data.toLocaleString(
    'pt-BR',
    comHora
      ? {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: FUSO
        }
      : {
          dateStyle: 'long',
          timeZone: FUSO
        }
  );
}

function formatarDataCurta(iso) {
  return new Date(
    `${iso}T12:00:00-03:00`
  ).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: FUSO
  });
}

function dataInicioTeste() {
  if (
    !acesso ||
    !acesso.periodo ||
    !acesso.periodo.inicio
  ) {
    return null;
  }

  return hojeFortaleza(
    new Date(acesso.periodo.inicio)
  );
}

function diaDoTeste() {
  const inicio = dataInicioTeste();

  if (!inicio) return null;

  return diferencaDias(
    inicio,
    hojeFortaleza()
  ) + 1;
}

/*
 * ARMAZENAMENTO LOCAL
 */
function estadoInicial() {
  return {
    dias: {},
    ativo: null,
    rascunho: null
  };
}

function salvarEstado() {
  if (!uidAtual) return;

  try {
    localStorage.setItem(
      PREFIXO_ESTADO + uidAtual,
      JSON.stringify(S)
    );
  } catch (e) {
    // Armazenamento indisponível.
  }
}

function carregarEstado(uid) {
  if (uidAtual && uidAtual !== uid) {
    pauseTimer();
  }

  uidAtual = uid;
  diaResultado = null;
  quizRenderizadoPara = null;

  let salvo = null;

  try {
    salvo = JSON.parse(
      localStorage.getItem(
        PREFIXO_ESTADO + uid
      ) || 'null'
    );
  } catch (e) {
    salvo = null;
  }

  const base = estadoInicial();

  if (
    salvo &&
    typeof salvo === 'object'
  ) {
    base.dias =
      salvo.dias &&
      typeof salvo.dias === 'object' &&
      !Array.isArray(salvo.dias)
        ? salvo.dias
        : {};

    base.ativo =
      salvo.ativo &&
      typeof salvo.ativo === 'object'
        ? salvo.ativo
        : null;

    base.rascunho =
      salvo.rascunho &&
      typeof salvo.rascunho === 'object'
        ? salvo.rascunho
        : null;
  }

  S = base;
  sanitizarEstado();
}

function sanitizarEstado() {
  for (const chave of Object.keys(S.dias)) {
    const reg = S.dias[chave];

    if (
      !/^[1-8]$/.test(chave) ||
      !reg ||
      typeof reg !== 'object'
    ) {
      delete S.dias[chave];
      continue;
    }

    if (!Array.isArray(reg.desafios)) {
      reg.desafios = [];
    }

    reg.desafios.forEach(d => {
      if (!d || typeof d !== 'object') {
        return;
      }

      if (!CH[d.nivel]) {
        d.nivel = 'mod';
      }

      if (
        !['aceito', 'concluido', 'nao_concluido']
          .includes(d.status)
      ) {
        d.status = 'nao_concluido';
      }

      if (!Number.isFinite(d.pontos)) {
        d.pontos = CH[d.nivel].pts;
      }
    });

    reg.desafios = reg.desafios.filter(
      d => d && typeof d === 'object'
    );
  }

  if (S.ativo) {
    const d = desafioAtivo();

    if (!d || d.status !== 'aceito') {
      S.ativo = null;
    }
  }

  if (S.rascunho) {
    const r = S.rascunho;

    const valido =
      Number.isInteger(r.dia) &&
      Array.isArray(r.ans) &&
      perguntasDoDia(r.dia).length === 5 &&
      r.ans.length === 5;

    if (!valido) {
      S.rascunho = null;
    }
  }
}

function registroDoDia(n) {
  if (!S.dias[n]) {
    S.dias[n] = {
      checkin: null,
      desafios: []
    };
  }

  return S.dias[n];
}

function checkinDoDia(n) {
  return S.dias[n] && S.dias[n].checkin
    ? S.dias[n].checkin
    : null;
}

function desafiosDoDia(n) {
  return S.dias[n] &&
    Array.isArray(S.dias[n].desafios)
      ? S.dias[n].desafios
      : [];
}

function desafioAtivo() {
  if (!S.ativo) {
    return null;
  }

  return desafiosDoDia(
    S.ativo.dia
  )[S.ativo.idx] || null;
}

/*
 * ERROS E TELAS
 */
class ErroFluxo extends Error {
  constructor(
    mensagem,
    tipo,
    status = 0,
    retryAfter = null
  ) {
    super(mensagem);

    this.tipo = tipo;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function toast(msg) {
  const t = $('toast');

  t.textContent = msg;
  t.style.opacity = 1;

  setTimeout(() => {
    t.style.opacity = 0;
  }, 2400);
}

function mostrarCarregandoAcesso(ligado) {
  $('carregandoAcesso')
    .classList.toggle('hidden', !ligado);
}

function mostrarTela(tela) {
  telaAtual = tela;

  if (tela !== 'app') {
    pauseTimer();
  }

  const intro = $('intro');

  intro.classList.toggle(
    'hidden',
    !['marca', 'formulario', 'boasvindas']
      .includes(tela)
  );

  $('espera').classList.toggle(
    'hidden',
    tela !== 'espera'
  );

  $('bloqueio').classList.toggle(
    'hidden',
    tela !== 'bloqueio'
  );

  const app = $('app');

  app.classList.toggle(
    'hidden',
    tela !== 'app'
  );

  app.classList.toggle(
    'md:flex',
    tela === 'app'
  );
}

function mostrarPassoIntro(passo) {
  const marca = $('brandStep');

  marca.classList.toggle(
    'hidden',
    passo !== 'marca'
  );

  if (passo === 'marca') {
    marca.classList.remove('out');
  }

  const nome = $('nameStep');

  nome.classList.toggle(
    'hidden',
    passo !== 'nome'
  );

  if (passo === 'nome') {
    nome.classList.add('fade-in');
  }

  $('welcomeStep').classList.toggle(
    'hidden',
    passo !== 'boasvindas'
  );
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

  if (aviso) {
    $('esperaUltima').textContent = aviso;
  }

  ativarVerificacao();
}

function mostrarBloqueio(titulo, texto) {
  pararVerificacao();
  mostrarTela('bloqueio');

  $('bloqueioTitulo').textContent = titulo;
  $('bloqueioTexto').textContent = texto;
}

function registrarVerificacao() {
  const hora = new Date().toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: FUSO
    }
  );

  $('esperaUltima').textContent =
    `Última verificação às ${hora}`;
}

function ativarVerificacao() {
  pararVerificacao();

  if (document.hidden) return;

  timerVerificacao = setInterval(
    () => verificarAgora({
      silencioso: true
    }),
    INTERVALO_VERIFICACAO_MS
  );
}

function pararVerificacao() {
  clearInterval(timerVerificacao);
  timerVerificacao = null;
}

document.addEventListener(
  'visibilitychange',
  () => {
    if (document.hidden) {
      pararVerificacao();
      return;
    }

    if (
      telaAtual === 'espera' ||
      telaAtual === 'app'
    ) {
      verificarAgora({
        silencioso: true
      });

      ativarVerificacao();
    }
  }
);

window.addEventListener('online', () => {
  if (
    telaAtual === 'espera' ||
    telaAtual === 'app'
  ) {
    verificarAgora({
      silencioso: true
    });
  }
});

/*
 * SUPABASE E AUTENTICAÇÃO
 */
async function iniciarCliente() {
  const resposta = await fetch(
    FUNCOES.config,
    {
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store'
    }
  );

  if (!resposta.ok) {
    throw new Error('config');
  }

  const config = await resposta.json();

  if (
    !config.supabaseUrl ||
    !config.supabasePublishableKey
  ) {
    throw new Error('config');
  }

  const { createClient } = await import(
    SUPABASE_ESM
  );

  supa = createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: CHAVE_SESSAO
      }
    }
  );
}

async function sessaoLocal() {
  const { data, error } =
    await supa.auth.getSession();

  if (
    error ||
    !data ||
    !data.session
  ) {
    return null;
  }

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
    if (supa) {
      await supa.auth.signOut();
    }
  } catch (e) {
    // Sessão local já foi limpa.
  }
}

function mensagemFalhaAcesso(error) {
  if (error && error.status === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  return 'Não foi possível iniciar seu acesso agora. Verifique sua internet e tente novamente.';
}

async function postServidor(
  url,
  { token, corpo } = {}
) {
  const cabecalhos = {};

  if (token) {
    cabecalhos.Authorization =
      `Bearer ${token}`;
  }

  if (corpo !== undefined) {
    cabecalhos['Content-Type'] =
      'application/json';
  }

  try {
    return await fetch(url, {
      method: 'POST',
      headers: cabecalhos,
      body:
        corpo !== undefined
          ? JSON.stringify(corpo)
          : undefined,
      cache: 'no-store'
    });
  } catch (e) {
    throw new ErroFluxo(
      'Sem conexão. Verifique sua internet e tente novamente.',
      'rede'
    );
  }
}

async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch (e) {
    return {};
  }
}

async function tokenDaSessao(
  renovar = false
) {
  if (renovar) {
    const { data, error } =
      await supa.auth.refreshSession();

    if (
      error ||
      !data ||
      !data.session
    ) {
      throw new ErroFluxo(
        'Não foi possível confirmar sua sessão.',
        'sessao'
      );
    }

    return data.session.access_token;
  }

  const sessao = await sessaoLocal();

  if (!sessao) {
    throw new ErroFluxo(
      'Sessão ausente.',
      'sessao'
    );
  }

  return sessao.access_token;
}

async function consultarServidor() {
  let resposta = await postServidor(
    FUNCOES.consultar,
    {
      token: await tokenDaSessao()
    }
  );

  if (resposta.status === 401) {
    resposta = await postServidor(
      FUNCOES.consultar,
      {
        token: await tokenDaSessao(true)
      }
    );
  }

  if (
    resposta.status === 401 ||
    resposta.status === 403
  ) {
    throw new ErroFluxo(
      'Sessão inválida.',
      'sessao',
      resposta.status
    );
  }

  const dados = await lerJson(resposta);

  if (!resposta.ok) {
    throw new ErroFluxo(
      dados.erro ||
        'Não foi possível verificar seu acesso agora.',
      'servidor',
      resposta.status
    );
  }

  return dados;
}

function vinculado() {
  return !!acesso &&
    !!acesso.status &&
    acesso.status !== 'sem_solicitacao';
}

function podeRegistrar() {
  return coletaLiberada() &&
    acessoConfirmado;
}

async function verificarAgora({
  silencioso = false,
  aposEnvio = false
} = {}) {
  const minha = ++seqAcesso;

  if (!silencioso) {
    mostrarCarregandoAcesso(true);
  }

  try {
    const dados = await consultarServidor();

    if (minha !== seqAcesso) {
      return;
    }

    acessoConfirmado = true;
    registrarVerificacao();

    aplicarAcesso(dados, {
      aposEnvio
    });
  } catch (err) {
    if (minha !== seqAcesso) {
      return;
    }

    tratarFalhaVerificacao(
      err,
      { silencioso }
    );
  } finally {
    if (minha === seqAcesso) {
      mostrarCarregandoAcesso(false);
    }
  }
}

function tratarFalhaVerificacao(
  err,
  { silencioso }
) {
  acessoConfirmado = false;

  if (err.tipo === 'sessao') {
    if (vinculado()) {
      mostrarBloqueio(
        'Sessão não confirmada',
        'Não foi possível confirmar sua sessão. Recarregue a página. Se o problema continuar, procure a equipe.'
      );
    } else {
      encerrarSessao().then(() => {
        mostrarFormulario(
          'Sua sessão expirou. Informe seu nome novamente.'
        );
      });
    }

    return;
  }

  const mensagem =
    err.message ||
    'Não foi possível verificar seu acesso agora.';

  if (
    telaAtual === 'formulario' &&
    solicitacaoEnviada
  ) {
    mostrarEspera(
      ultimoNomeEnviado,
      MSG_ESPERA_FALHA
    );

    return;
  }

  if (telaAtual === 'espera') {
    $('esperaUltima').textContent =
      `${mensagem} ${MSG_ESPERA_FALHA}`;

    return;
  }

  if (telaAtual === 'app') {
    atualizarBloqueios();

    if (!silencioso) {
      toast(mensagem);
    }

    return;
  }

  mostrarBloqueio(
    'Não foi possível verificar seu acesso',
    mensagem
  );
}

/*
 * AUTORIZAÇÃO DO ESTUDANTE
 */
function aplicarAcesso(
  dados,
  { aposEnvio = false } = {}
) {
  acesso = dados;

  if (dados.pode_entrar === true) {
    entrarNoApp(aposEnvio);
    return;
  }

  if (
    dados.motivo ===
    'aguardando_autorizacao'
  ) {
    mostrarEspera(
      dados.nome || ultimoNomeEnviado
    );

    return;
  }

  if (dados.motivo === 'sem_solicitacao') {
    mostrarFormulario(
      aposEnvio ? MSG_SEM_REGISTRO : ''
    );

    return;
  }

  if (
    dados.motivo ===
    'participante_inativo'
  ) {
    mostrarBloqueio(
      BLOQUEIO_PARTICIPANTE_INATIVO.titulo,
      BLOQUEIO_PARTICIPANTE_INATIVO.texto
    );

    return;
  }

  mostrarBloqueio(
    TITULOS_BLOQUEIO[dados.motivo] ||
      'Acesso indisponível',
    dados.mensagem ||
      'Procure a equipe para verificar seu acesso.'
  );
}

function coletaLiberada() {
  return !!acesso &&
    acesso.pode_entrar === true &&
    acesso.coleta_liberada === true &&
    dataInicioTeste() !== null;
}

function textoBloqueio(oque) {
  if (
    acesso &&
    acesso.fase === 'antes_do_inicio' &&
    acesso.periodo
  ) {
    return `Os ${oque} começam em ${formatarData(
      acesso.periodo.inicio
    )}. Até lá, você pode explorar o aplicativo.`;
  }

  return `Os ${oque} ainda não estão liberados.`;
}

function entrarNoApp(comBoasVindas) {
  const nome =
    (acesso && acesso.nome) || '';

  $('greet').textContent =
    `Olá, ${nome}`;

  $('sideName').textContent = nome;
  $('hello').textContent =
    'Seja bem-vindo(a)';
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
      if (telaAtual === 'boasvindas') {
        abrirApp();
      }
    }, 2400);

    return;
  }

  abrirApp();
}

function abrirApp() {
  mostrarTela('app');
  mostrarSecao(
    secaoAtual || 'home'
  );
  atualizarBloqueios();
  ativarVerificacao();
}

function atualizarBanner() {
  const banner = $('periodoBanner');
  const dia = diaDoTeste();
  let texto = '';

  if (
    acesso &&
    acesso.pode_entrar === true
  ) {
    if (!acessoConfirmado) {
      texto = MSG_SEM_CONFIRMACAO;
    } else if (!dataInicioTeste()) {
      texto =
        'Acesso liberado. A data oficial do teste ainda não foi definida; os check-ins ainda não estão disponíveis.';
    } else if (
      acesso.fase === 'antes_do_inicio'
    ) {
      texto =
        `Acesso liberado. Os check-ins começam em ${formatarData(
          acesso.periodo.inicio
        )}. Use este tempo para preparar seu aparelho.`;
    } else if (
      dia === DIAS_DO_TESTE + 1
    ) {
      texto =
        'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Novos desafios não estão disponíveis.';
    } else if (
      acesso.fase === 'coleta'
    ) {
      texto =
        `Check-ins abertos até ${formatarData(
          acesso.periodo.fim,
          true
        )}.`;
    }
  }

  banner.textContent = texto;

  banner.classList.toggle(
    'hidden',
    !texto
  );

  $('homeComecarNota').textContent =
    coletaLiberada()
      ? '5 perguntas por dia'
      : 'Disponível quando os check-ins forem liberados';
}

function atualizarBloqueios() {
  atualizarBanner();
  sincronizarDesafioAtivo();

  if (!coletaLiberada()) {
    pauseTimer();
  }

  if (secaoAtual === 'checkin') {
    renderCheckin();
  }

  if (secaoAtual === 'challenge') {
    renderChallenge();
  }

  if (secaoAtual === 'progress') {
    renderProgress();
  }
}

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

  if (
    dia !== null &&
    dia !== S.ativo.dia
  ) {
    descartarDesafioAtivo();
    return;
  }

  if (!coletaLiberada()) {
    pauseTimer();
  }
}

/*
 * ABERTURA DO APLICATIVO
 */
function construirMarca() {
  [...'Fair Play'].forEach((ch, i) => {
    const letra =
      document.createElement('span');

    letra.className = 'brand-letter';

    letra.style.animationDelay =
      (0.2 + i * 0.09) + 's';

    letra.textContent =
      ch === ' ' ? '\u00a0' : ch;

    $('brandWord').appendChild(
      letra
    );
  });
}

function validarNomeEstudante(valor) {
  const nome = valor.trim();

  if (!nome) {
    return 'Digite seu primeiro nome para continuar.';
  }

  if (nome.length < 2) {
    return 'Informe pelo menos 2 letras.';
  }

  if (nome.length > 40) {
    return 'Use no máximo 40 caracteres.';
  }

  if (/\s/.test(nome)) {
    return 'Informe somente o seu primeiro nome.';
  }

  if (
    !/^\p{L}[\p{L}'’-]*$/u.test(nome)
  ) {
    return 'Use apenas letras, sem números ou símbolos.';
  }

  return '';
}

function mensagemErroSolicitacao(resposta) {
  if (resposta.status === 429) {
    const segundos = Number(
      resposta.headers.get('Retry-After')
    ) || 0;

    const minutos = Math.max(
      1,
      Math.ceil(segundos / 60)
    );

    return new ErroFluxo(
      `Muitas tentativas em pouco tempo. Aguarde cerca de ${minutos} minuto(s) e tente novamente.`,
      'limite',
      429
    );
  }

  if (resposta.status === 400) {
    return new ErroFluxo(
      'Confira o primeiro nome (somente letras) e tente novamente.',
      'validacao',
      400
    );
  }

  if (
    resposta.status === 401 ||
    resposta.status === 403
  ) {
    return new ErroFluxo(
      'Não foi possível confirmar sua sessão. Tente novamente.',
      'sessao',
      resposta.status
    );
  }

  return new ErroFluxo(
    'Não foi possível registrar sua solicitação agora. Tente novamente.',
    'servidor',
    resposta.status
  );
}

function definirEnvio(ligado) {
  enviando = ligado;

  const botao = $('nameSubmit');

  botao.disabled = ligado || !supa;

  botao.textContent =
    ligado ? 'ENVIANDO...' : 'CONTINUAR';

  $('nameInput').disabled = ligado;

  const aviso = $('formAviso');

  if (ligado) {
    aviso.textContent =
      'Enviando sua solicitação...';
  } else if (
    aviso.textContent ===
    'Enviando sua solicitação...'
  ) {
    aviso.textContent = '';
  }
}

async function enviarSolicitacao() {
  if (enviando) return;

  const nome =
    $('nameInput').value.trim();

  $('nameErr').textContent = '';
  $('formAviso').textContent = '';

  const erroNome =
    validarNomeEstudante(nome);

  if (erroNome) {
    $('nameErr').textContent = erroNome;
    $('nameInput').focus();
    return;
  }

  if (!supa) {
    $('formAviso').textContent =
      'Não foi possível conectar. Atualize a página.';

    return;
  }

  ultimoNomeEnviado = nome;
  solicitacaoEnviada = false;
  definirEnvio(true);

  try {
    let sessao = await sessaoLocal();

    if (!sessao) {
      const { data, error } =
        await supa.auth.signInAnonymously();

      if (
        error ||
        !data ||
        !data.session
      ) {
        throw new ErroFluxo(
          mensagemFalhaAcesso(error),
          'auth'
        );
      }

      sessao = data.session;
    }

    if (
      uidAtual !== sessao.user.id
    ) {
      carregarEstado(
        sessao.user.id
      );
    }

    const resposta = await postServidor(
      FUNCOES.solicitar,
      {
        token: sessao.access_token,
        corpo: {
          nome,
          tipo_dispositivo:
            TIPO_DISPOSITIVO_PADRAO
        }
      }
    );

    if (
      resposta.status !== 202
    ) {
      throw mensagemErroSolicitacao(
        resposta
      );
    }

    solicitacaoEnviada = true;

    await verificarAgora({
      aposEnvio: true
    });
  } catch (err) {
    if (err.tipo === 'sessao') {
      await encerrarSessao();
    }

    $('formAviso').textContent =
      err.message ||
      'Algo deu errado. Tente novamente.';
  } finally {
    definirEnvio(false);
  }
}

/*
 * NAVEGAÇÃO
 *
 * Os botões do menu não recebem emojis
 * nem ícones automaticamente.
 */
function go(id) {
  mostrarSecao(id);
}

function mostrarSecao(id) {
  if (telaAtual !== 'app') {
    return;
  }

  const alvo = $(id);

  if (!alvo) {
    return;
  }

  secaoAtual = id;

  $$('.screen').forEach(s => {
    s.classList.add('hidden');
  });

  alvo.classList.remove('hidden');

  alvo.style.animation = 'none';
  void alvo.offsetWidth;
  alvo.style.animation = '';

  $$('[data-nav]').forEach(b => {
    b.classList.toggle(
      'active',
      b.dataset.nav ===
        (id === 'result' ? 'checkin' : id)
    );
  });

  if (id === 'checkin') {
    renderCheckin();
  }

  if (id === 'result') {
    showResult();
  }

  if (id === 'challenge') {
    renderChallenge();
  }

  if (id === 'progress') {
    renderProgress();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

document.addEventListener('click', e => {
  const botao =
    e.target.closest('[data-go]');

  if (botao) {
    go(botao.dataset.go);
  }
});

/*
 * CHECK-IN DOS SETE DIAS
 */
function estadoCheckin() {
  if (!coletaLiberada()) {
    return {
      tipo: 'bloqueado',
      texto: textoBloqueio('check-ins')
    };
  }

  const dia = diaDoTeste();
  let e;

  if (
    dia === DIAS_DO_TESTE + 1
  ) {
    e = checkinDoDia(DIAS_DO_TESTE)
      ? {
          tipo: 'dia8_fechado',
          alvo: DIAS_DO_TESTE,
          texto:
            'Hoje é o Dia 8. Seu check-in do Dia 7 já está registrado. Não há novo check-in neste dia.'
        }
      : {
          tipo: 'recuperacao',
          alvo: DIAS_DO_TESTE,
          texto:
            'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Não há novo check-in para o Dia 8.'
        };
  } else if (
    dia >= 1 &&
    dia <= DIAS_DO_TESTE
  ) {
    e = checkinDoDia(dia)
      ? {
          tipo: 'ja_feito',
          alvo: dia,
          texto:
            `Seu check-in do Dia ${dia} já está registrado. Toque em VER MEU RESULTADO para revê-lo.`
        }
      : {
          tipo: 'novo',
          alvo: dia
        };
  } else {
    return {
      tipo: 'bloqueado',
      texto: MSG_CHECKIN_BLOQUEADO
    };
  }

  if (
    (
      e.tipo === 'novo' ||
      e.tipo === 'recuperacao'
    ) &&
    !acessoConfirmado
  ) {
    return {
      tipo: 'sem_confirmacao',
      texto: MSG_SEM_CONFIRMACAO
    };
  }

  return e;
}

function renderCheckin() {
  const e = estadoCheckin();
  const caixa = $('checkinBloqueio');

  const alerta =
    e.tipo === 'bloqueado' ||
    e.tipo === 'sem_confirmacao';

  caixa.classList.toggle(
    'hidden',
    e.tipo === 'novo'
  );

  caixa.classList.toggle(
    'aviso-alerta',
    alerta
  );

  caixa.classList.toggle(
    'aviso-info',
    !alerta
  );

  $('checkinBloqueioTexto').textContent =
    e.texto || '';

  const mostrarQuiz =
    e.tipo !== 'bloqueado' &&
    e.tipo !== 'sem_confirmacao';

  $('quizArea').classList.toggle(
    'hidden',
    !mostrarQuiz
  );

  if (
    e.tipo === 'novo' ||
    e.tipo === 'recuperacao'
  ) {
    renderQuiz(e.alvo);
  } else {
    limparQuiz();
  }
}

/*
 * Mostra cinco perguntas correspondentes
 * ao dia do teste.
 */
function renderQuiz(alvo) {
  const perguntas = perguntasDoDia(alvo);

  if (perguntas.length !== 5) {
    $('quizErr').textContent =
      'Questionário indisponível para este dia.';

    return;
  }

  if (
    !S.rascunho ||
    S.rascunho.dia !== alvo ||
    !Array.isArray(S.rascunho.ans) ||
    S.rascunho.ans.length !== 5
  ) {
    S.rascunho = {
      dia: alvo,
      ans: perguntas.map(() => null)
    };

    salvarEstado();
  }

  if (
    quizRenderizadoPara === alvo
  ) {
    return;
  }

  quizRenderizadoPara = alvo;
  $('quizErr').textContent = '';

  $('quiz').innerHTML = perguntas
    .map((q, i) => `
      <div class="q" data-q="${i}">
        <h2 class="qt font-display font-bold text-lg mb-3">
          ${i + 1}. ${q.q}
        </h2>
        <div class="space-y-2">
          ${q.o.map((op, j) => `
            <button
              type="button"
              class="opt${S.rascunho.ans[i] === j ? ' sel' : ''}"
              data-q="${i}"
              data-v="${j}"
            >${op.texto}</button>
          `).join('')}
        </div>
      </div>
    `)
    .join('');
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
  const botao =
    e.target.closest('.opt');

  if (!botao) return;

  const est = estadoCheckin();

  if (
    est.tipo !== 'novo' &&
    est.tipo !== 'recuperacao'
  ) {
    toast(
      est.texto ||
      MSG_CHECKIN_BLOQUEADO
    );

    return;
  }

  if (
    !S.rascunho ||
    S.rascunho.dia !== est.alvo
  ) {
    return;
  }

  const i = Number(
    botao.dataset.q
  );

  S.rascunho.ans[i] = Number(
    botao.dataset.v
  );

  salvarEstado();

  $$(`.opt[data-q="${i}"]`)
    .forEach(o => {
      o.classList.toggle(
        'sel',
        o === botao
      );
    });

  $sel(`.q[data-q="${i}"]`)
    ?.classList.remove('missing');

  $('quizErr').textContent = '';
});

/*
 * CÁLCULO EDUCATIVO
 *
 * Menos de três respostas pontuáveis:
 * sem classificação.
 */
$('seeResult').addEventListener('click', () => {
  const est = estadoCheckin();

  if (
    est.tipo === 'ja_feito' ||
    est.tipo === 'dia8_fechado'
  ) {
    abrirResultado(est.alvo);
    return;
  }

  if (
    est.tipo !== 'novo' &&
    est.tipo !== 'recuperacao'
  ) {
    toast(
      est.texto ||
      MSG_CHECKIN_BLOQUEADO
    );

    return;
  }

  const perguntas =
    perguntasDoDia(est.alvo);

  const respostas =
    S.rascunho?.dia === est.alvo
      ? S.rascunho.ans
      : [];

  if (
    perguntas.length !== 5
  ) {
    $('quizErr').textContent =
      'Questionário indisponível para este dia.';

    return;
  }

  const faltando = perguntas
    .map((q, i) => {
      return !Number.isInteger(respostas[i]) ||
        !q.o[respostas[i]]
          ? i
          : -1;
    })
    .filter(i => i >= 0);

  if (faltando.length) {
    faltando.forEach(i => {
      $sel(`.q[data-q="${i}"]`)
        ?.classList.add('missing');
    });

    $('quizErr').textContent =
      'Responda todas as cinco perguntas.';

    $sel(
      `.q[data-q="${faltando[0]}"]`
    )?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    return;
  }

  const respostasEstruturadas =
    perguntas.map((q, i) => {
      const opcao =
        q.o[respostas[i]];

      return {
        pergunta: q.id,
        alternativa: opcao.id,
        tipo: opcao.tipo,
        valor: opcao.valor
      };
    });

  const pontuaveis =
    respostasEstruturadas.filter(
      r => r.tipo === 'pontuavel'
    );

  const soma = pontuaveis.reduce(
    (total, r) => total + r.valor,
    0
  );

  const pontuacao =
    pontuaveis.length < 3
      ? null
      : Math.round(
          (
            soma /
            (2 * pontuaveis.length)
          ) * 10
        );

  const nivel =
    pontuacao === null
      ? null
      : pontuacao <= 3
        ? 'baixo'
        : pontuacao <= 7
          ? 'mod'
          : 'alto';

  registroDoDia(est.alvo).checkin = {
    versaoCatalogo:
      'rascunho-2026.1',
    respostas:
      respostasEstruturadas,
    pontuacao,
    nivel,
    registradoEm:
      new Date().toISOString(),
    recuperado:
      est.tipo === 'recuperacao'
  };

  S.rascunho = null;

  salvarEstado();
  abrirResultado(est.alvo);
});

/*
 * RESULTADO DO DIA
 */
function showResult() {
  const c = diaResultado
    ? checkinDoDia(diaResultado)
    : null;

  if (!c) {
    go('checkin');
    return;
  }

  const r =
    RESULTS[c.nivel] ||
    RESULTS.neutro;

  $('resEmoji').textContent =
    r.emoji;

  $('resTitle').textContent =
    r.title;

  $('resText').textContent =
    r.text;

  $('resRec').textContent =
    r.rec;

  $('resTipCard').classList.toggle(
    'hidden',
    !r.tip
  );

  $('resTip').textContent =
    r.tip || '';

  $('lvlLabel').textContent =
    r.label;

  $('lvlLabel').style.color =
    r.color === '#FACC15'
      ? '#a16207'
      : r.color;

  const segmentos =
    $$('#gauge .seg');

  segmentos.forEach(s => {
    s.style.background = '';
  });

  setTimeout(() => {
    segmentos.forEach((s, i) => {
      if (i < r.n) {
        s.style.background = r.color;
      }
    });
  }, 150);
}

/*
 * DESAFIOS
 */
function nivelHoje() {
  const dia = diaDoTeste();

  if (
    dia === null ||
    dia < 1 ||
    dia > DIAS_DO_TESTE
  ) {
    return null;
  }

  const c = checkinDoDia(dia);

  return c ? c.nivel : null;
}

function nivelDesafioNovo() {
  const hoje = nivelHoje();

  if (hoje) {
    return hoje;
  }

  const dia = diaDoTeste();

  const limite =
    dia === null
      ? DIAS_DO_TESTE
      : Math.min(
          Math.max(dia, 0),
          DIAS_DO_TESTE
        );

  for (
    let n = limite;
    n >= 1;
    n--
  ) {
    const c = checkinDoDia(n);

    if (c) {
      return c.nivel || 'neutro';
    }
  }

  return 'neutro';
}

function restanteDoDesafio(d) {
  const total =
    CH[d.nivel].min * 60;

  let r;

  if (d.prazo) {
    r = Math.ceil(
      (d.prazo - Date.now()) / 1000
    );
  } else {
    r = Number.isFinite(d.rem)
      ? Math.floor(d.rem)
      : total;
  }

  return Math.min(
    total,
    Math.max(0, r)
  );
}

function formatarTempo(segundos) {
  return `${
    String(
      Math.floor(segundos / 60)
    ).padStart(2, '0')
  }:${
    String(
      segundos % 60
    ).padStart(2, '0')
  }`;
}

function draw() {
  const d = desafioAtivo();

  if (!d) return;

  const total =
    CH[d.nivel].min * 60;

  const r = restanteDoDesafio(d);

  $('clock').textContent =
    formatarTempo(r);

  $('ring').style.strokeDasharray = C;

  $('ring').style.strokeDashoffset =
    C * (1 - r / total);
}

function atualizarBotoesTimer() {
  const d = desafioAtivo();

  const r = d
    ? restanteDoDesafio(d)
    : 0;

  $('pause').textContent =
    running ? 'PAUSAR' : 'RETOMAR';

  $('pause').disabled =
    !d ||
    !coletaLiberada() ||
    (!running && r <= 0);

  $('finish').disabled =
    !d ||
    !podeRegistrar();
}

function startTimer() {
  if (running) return;

  const d = desafioAtivo();

  if (
    !d ||
    d.status !== 'aceito' ||
    !coletaLiberada()
  ) {
    return;
  }

  const r = restanteDoDesafio(d);

  if (r <= 0) {
    draw();
    atualizarBotoesTimer();
    return;
  }

  clearInterval(iv);

  d.rem = r;
  d.prazo =
    Date.now() + r * 1000;

  running = true;

  salvarEstado();
  atualizarBotoesTimer();

  iv = setInterval(tick, 1000);
  tick();
}

function pauseTimer() {
  clearInterval(iv);
  iv = null;

  const d = desafioAtivo();

  if (d && d.prazo) {
    d.rem =
      restanteDoDesafio(d);

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

  if (
    dia !== null &&
    dia !== S.ativo.dia
  ) {
    descartarDesafioAtivo();
    return;
  }

  if (!coletaLiberada()) {
    pauseTimer();
    return;
  }

  const r =
    restanteDoDesafio(d);

  if (r <= 0) {
    pauseTimer();

    concluirDesafio({
      automatico: true
    });

    return;
  }

  d.rem = r;

  draw();
  salvarEstado();
}

function descartarDesafioAtivo() {
  const d = desafioAtivo();

  pauseTimer();

  if (
    d &&
    d.status === 'aceito'
  ) {
    d.status = 'nao_concluido';
    d.prazo = null;
  }

  S.ativo = null;

  salvarEstado();
  renderChallenge();

  if (telaAtual === 'app') {
    toast(
      'O desafio do dia anterior não foi concluído a tempo e não foi contabilizado.'
    );
  }
}

function concluirDesafio({
  automatico = false
} = {}) {
  const d = desafioAtivo();

  if (
    !d ||
    d.status !== 'aceito'
  ) {
    return;
  }

  const dia = diaDoTeste();

  if (
    dia !== null &&
    dia !== S.ativo.dia
  ) {
    descartarDesafioAtivo();
    return;
  }

  if (!podeRegistrar()) {
    pauseTimer();

    if (
      automatico &&
      coletaLiberada()
    ) {
      toast(
        MSG_TEMPO_AGUARDANDO
      );
    } else {
      toast(
        coletaLiberada()
          ? MSG_SEM_CONFIRMACAO
          : MSG_DESAFIO_BLOQUEADO
      );
    }

    renderChallenge();
    return;
  }

  pauseTimer();

  d.status = 'concluido';
  d.rem = 0;
  d.concluidoEm =
    new Date().toISOString();

  S.ativo = null;

  salvarEstado();

  const e = estatisticas();

  toast(
    e.concluidos % 3 === 0
      ? `Desafio concluído! +${d.pontos} pontos e nova medalha!`
      : `Desafio concluído! +${d.pontos} pontos`
  );

  renderChallenge();

  setTimeout(() => {
    if (telaAtual === 'app') {
      go('progress');
    }
  }, 1600);
}

function renderChallenge() {
  const d = desafioAtivo();

  const c =
    CH[
      d
        ? d.nivel
        : nivelDesafioNovo()
    ];

  $('chTag').textContent =
    c.tag;

  $('chTitle').textContent =
    c.title;

  $('chText').textContent =
    c.text;

  $('chPts').textContent =
    `+${c.pts} pontos`;

  $('chList').innerHTML =
    c.list.map(k =>
      `<li class="chip">${ACT[k]}</li>`
    ).join('');

  const liberado =
    coletaLiberada();

  const dia = diaDoTeste();

  const emDia =
    liberado &&
    dia >= 1 &&
    dia <= DIAS_DO_TESTE;

  const jaTemDesafioHoje =
    emDia &&
    desafiosDoDia(dia).length > 0;

  let aviso = '';

  if (!liberado) {
    aviso =
      textoBloqueio('desafios');
  } else if (!acessoConfirmado) {
    aviso =
      MSG_SEM_CONFIRMACAO;
  } else if (
    !d &&
    jaTemDesafioHoje
  ) {
    aviso =
      MSG_UM_POR_DIA;
  }

  $('desafioBloqueioTexto').textContent =
    aviso;

  $('desafioBloqueio').classList.toggle(
    'hidden',
    !aviso
  );

  $('dia8Aviso').classList.toggle(
    'hidden',
    !(
      liberado &&
      dia === DIAS_DO_TESTE + 1
    )
  );

  $('chNote').classList.toggle(
    'hidden',
    !!d || !!nivelHoje()
  );

  const botao = $('accept');

  botao.textContent = d
    ? '✓ DESAFIO ACEITO'
    : 'ACEITAR DESAFIO';

  botao.classList.toggle(
    'done',
    !!d
  );

  botao.disabled =
    !!d ||
    !emDia ||
    !acessoConfirmado ||
    jaTemDesafioHoje;

  $('acceptMsg').classList.toggle(
    'hidden',
    !d
  );

  $('timerBox').classList.toggle(
    'hidden',
    !d
  );

  if (d) {
    draw();
  }

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

  if (
    dia === DIAS_DO_TESTE + 1
  ) {
    toast(MSG_DIA8);
    return;
  }

  if (
    dia < 1 ||
    dia > DIAS_DO_TESTE
  ) {
    toast(MSG_DESAFIO_BLOQUEADO);
    return;
  }

  if (
    desafiosDoDia(dia).length > 0
  ) {
    toast(MSG_UM_POR_DIA);
    return;
  }

  const nivel =
    nivelDesafioNovo();

  const reg =
    registroDoDia(dia);

  reg.desafios.push({
    nivel,
    status: 'aceito',
    pontos: CH[nivel].pts,
    aceitoEm:
      new Date().toISOString(),
    concluidoEm: null,
    rem: CH[nivel].min * 60,
    prazo: null
  });

  S.ativo = {
    dia,
    idx: reg.desafios.length - 1
  };

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

$('finish').addEventListener(
  'click',
  () => concluirDesafio()
);

/*
 * PROGRESSO LOCAL
 */
function estatisticas() {
  let aceitos = 0;
  let concluidos = 0;
  let pontos = 0;
  let sequenciaAtual = 0;
  let maiorSequencia = 0;

  for (
    let n = 1;
    n <= DIAS_DO_TESTE;
    n++
  ) {
    const lista =
      desafiosDoDia(n);

    const feitos =
      lista.filter(
        d => d.status === 'concluido'
      );

    aceitos += lista.filter(
      d =>
        d.status !== 'nao_concluido'
    ).length;

    concluidos += feitos.length;

    pontos += feitos.reduce(
      (soma, d) =>
        soma + (d.pontos || 0),
      0
    );

    if (feitos.length) {
      sequenciaAtual++;
      maiorSequencia = Math.max(
        maiorSequencia,
        sequenciaAtual
      );
    } else {
      sequenciaAtual = 0;
    }
  }

  return {
    aceitos,
    concluidos,
    pontos,
    sequencia: maiorSequencia
  };
}

function pctDia(n) {
  const lista =
    desafiosDoDia(n);

  if (
    lista.some(
      d => d.status === 'concluido'
    )
  ) {
    return 100;
  }

  if (
    lista.some(
      d => d.status === 'aceito'
    )
  ) {
    return 30;
  }

  return 0;
}

function renderProgress() {
  const e = estatisticas();

  $('stPts').textContent =
    e.pontos;

  $('stAcc').textContent =
    e.aceitos;

  $('stDone').textContent =
    e.concluidos;

  $('stStreak').textContent =
    e.sequencia;

  $('progressoVazio').classList.toggle(
    'hidden',
    e.aceitos > 0
  );

  const dia = diaDoTeste();

  const hoje =
    dia !== null &&
    dia >= 1
      ? Math.min(
          dia,
          DIAS_DO_TESTE
        )
      : 0;

  const inicio =
    dataInicioTeste();

  $('week').innerHTML =
    Array.from(
      { length: DIAS_DO_TESTE },
      (_, i) => {
        const n = i + 1;
        const p = pctDia(n);

        const data = inicio
          ? formatarDataCurta(
              somarDias(inicio, i)
            )
          : 'data a definir';

        const destaque =
          n === hoje
            ? 'bg-brand/5'
            : '';

        const rotulo =
          n === hoje
            ? 'font-extrabold text-brand'
            : 'font-semibold';

        const apagado =
          hoje > 0 &&
          n > hoje
            ? 'opacity-50'
            : '';

        return `
          <div class="flex items-center gap-3 rounded-xl px-2 py-1 ${destaque} ${apagado}">
            <span class="w-24 text-sm ${rotulo}">
              Dia ${n}
              <br>
              <span class="text-xs font-normal text-slate-500">
                ${data}
              </span>
            </span>

            <div class="bar flex-1">
              <div class="fill bg-go" data-w="${p}"></div>
            </div>

            <span class="w-10 text-right text-sm font-bold">
              ${p}%
            </span>
          </div>
        `;
      }
    ).join('');

  const valores = [];

  for (
    let n = 1;
    n <= hoje;
    n++
  ) {
    valores.push(
      pctDia(n)
    );
  }

  const media = valores.length
    ? Math.round(
        valores.reduce(
          (a, b) => a + b,
          0
        ) / valores.length
      )
    : 0;

  $('weekPct').textContent =
    `${media}%`;

  const falta =
    3 - (e.concluidos % 3);

  $('nextText').textContent =
    `Complete mais ${falta} ${
      falta === 1
        ? 'desafio'
        : 'desafios'
    } para desbloquear uma nova medalha.`;

  $('nextBar').style.width = '0';

  let nota =
    'Este progresso fica guardado somente neste aparelho, separado por identidade. A gravação definitiva no servidor será implementada em uma próxima etapa. Desafios de dias anteriores não concluídos permanecem no histórico.';

  if (!inicio) {
    nota +=
      ' A data oficial do teste ainda não foi definida, por isso nenhum dia é contabilizado.';
  }

  if (!acessoConfirmado) {
    nota +=
      ' Sem confirmação do servidor agora, novos registros estão bloqueados.';
  }

  $('progressoNota').textContent =
    nota;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $$('#week .fill').forEach(
        f => {
          f.style.width =
            f.dataset.w + '%';
        }
      );

      $('nextBar').style.width =
        ((3 - falta) / 3 * 100) + '%';
    });
  });
}

/*
 * BOTÕES DE ESPERA E BLOQUEIO
 */
$('esperaVerificar').addEventListener(
  'click',
  async () => {
    const botao =
      $('esperaVerificar');

    botao.disabled = true;

    try {
      await verificarAgora();
    } finally {
      botao.disabled = false;
    }
  }
);

$('bloqueioVerificar').addEventListener(
  'click',
  async () => {
    const botao =
      $('bloqueioVerificar');

    botao.disabled = true;

    try {
      await verificarAgora();
    } finally {
      botao.disabled = false;
    }
  }
);

/*
 * FORMULÁRIO DE ENTRADA
 */
$('nameInput').addEventListener(
  'input',
  () => {
    $('nameErr').textContent = '';
  }
);

$('nameStep').addEventListener(
  'submit',
  e => {
    e.preventDefault();
    enviarSolicitacao();
  }
);

/*
 * INICIALIZAÇÃO
 */
function criarNotaProgresso() {
  const nota =
    document.createElement('p');

  nota.id = 'progressoNota';

  nota.className =
    'mt-4 text-xs text-slate-500';

  $('progress').appendChild(
    nota
  );
}

async function iniciar() {
  construirMarca();
  criarNotaProgresso();

  mostrarTela('marca');
  mostrarPassoIntro('marca');

  try {
    await iniciarCliente();
  } catch (err) {
    mostrarFormulario(
      'Não foi possível conectar agora. Atualize a página e tente novamente.'
    );

    return;
  }

  let sessao = null;

  try {
    sessao =
      await sessaoLocal();
  } catch (err) {
    sessao = null;
  }

  if (sessao) {
    carregarEstado(
      sessao.user.id
    );

    await verificarAgora();
    return;
  }

  setTimeout(() => {
    $('brandStep').classList.add(
      'out'
    );
  }, 2500);

  setTimeout(() => {
    mostrarFormulario('');
  }, 2900);
}

iniciar().catch(() => {
  mostrarFormulario(
    'Algo deu errado. Atualize a página e tente novamente.'
  );
});
