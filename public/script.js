/*
 * FAIR PLAY — SCRIPT DO ESTUDANTE
 * Ambiente: TESTE / ORIGINAL (selecionado no servidor)
 * Questionário: 7 dias, 5 perguntas por dia.
 * Catálogo de perguntas: rascunho 2026.1; validar antes da coleta.
 *
 * Auth: Supabase.
 * Autorização: funções no servidor.
 * Check-ins: Supabase.
 * Desafios: persistência no Supabase, com confirmação pelo servidor.
 */
const FUNCOES = {
  config: '/api/config-public',
  solicitar: '/api/solicitar-acesso',
  consultar: '/api/consultar-acesso',
  checkin: '/api/checkin',
  desafio: '/api/desafio'
};
const SUPABASE_ESM =
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const CHAVE_SESSAO = 'fairplay-estudante-auth';
let prefixoEstado = 'fairplay-v5:';
const INTERVALO_VERIFICACAO_MS = 30000;
const FUSO = 'America/Fortaleza';
const DIAS_DO_TESTE = 7;
const TIPO_DISPOSITIVO_PADRAO = 'individual';
const MSG_SEM_REGISTRO =
  'Este navegador ainda não tem um acesso vinculado. Se você já recebeu aprovação, abra o Fair Play no mesmo navegador usado para solicitar acesso. Se trocou de navegador ou aparelho, procure a equipe para liberar um novo acesso. Confira também seu primeiro nome.';
const MSG_CHECKIN_BLOQUEADO =
  'Os check-ins ainda não estão liberados.';
const MSG_DESAFIO_BLOQUEADO =
  'Os desafios ainda não estão liberados.';
const MSG_DIA8 =
  'No Dia 8 não é possível iniciar novos desafios. Você pode apenas recuperar o check-in do Dia 7.';
const MSG_UM_POR_DIA =
  'Você já tem um desafio registrado para este dia do teste. Só é possível um desafio por dia.';
const MSG_SEM_CONFIRMACAO =
  'Não foi possível verificar seu acesso agora. Você poderá continuar assim que a conexão for restabelecida.';
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
  texto: 'No momento, sua participação no Fair Play não está habilitada. Caso precise de ajuda, converse com a equipe responsável.'
};
/*
 * QUESTIONÁRIO ORIGINAL
 *
 * 0, 1, 2 = pontuação educativa.
 * "i" = resposta informativa.
 * "n" = não aplicável.
 *
 * A ordem deve coincidir com checkin.mjs.
 */
const DADOS_QUESTIONARIO = [
  // DIA 1
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
  // DIA 2
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
  // DIA 3
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
  // DIA 4
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
  // DIA 5
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
  // DIA 6
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
  // DIA 7
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
const PERGUNTAS_POR_DIA = DADOS_QUESTIONARIO.map(
  (lista, dia) =>
    lista.map(([texto, alternativas], indice) => {
      const id =
        `D${String(dia + 1).padStart(2, '0')}_P${indice + 1}`;
      return {
        id,
        q: texto,
        o: alternativas.map(([rotulo, codigo], j) => ({
          id: `${id}_A${j + 1}`,
          texto: rotulo,
          tipo: typeof codigo === 'number'
            ? 'pontuavel'
            : codigo === 'i'
              ? 'informativa'
              : 'nao_aplicavel',
          valor: typeof codigo === 'number'
            ? codigo
            : null
        }))
      };
    })
);
function perguntasDoDia(dia) {
  return PERGUNTAS_POR_DIA[Number(dia) - 1] || [];
}
const RESULTS = {
  baixo: {
    label: 'Baixo',
    title: 'Bom equilíbrio nos seus hábitos',
    text: 'Suas respostas mostram uma boa relação entre jogos e outras atividades. Continue observando sua rotina para manter esse equilíbrio.',
    rec: 'Mantenha o que já funciona: combine horários de jogo com estudos, descanso e tempo com a família.',
    tip: null
  },
  mod: {
    label: 'Moderado',
    title: 'Atenção aos seus hábitos',
    text: 'Algumas das suas respostas indicam que pode ser interessante observar melhor seu tempo de jogo e buscar um equilíbrio maior com outras atividades.',
    rec: 'Experimente estabelecer um período para estudar ou realizar outra atividade antes de começar a jogar.',
    tip: 'Combine com sua família um horário fixo para jogar e outro para estudar. Ter horários definidos ajuda a respeitar os limites.'
  },
  alto: {
    label: 'Alto',
    title: 'Hora de ajustar a rotina',
    text: 'Suas respostas sugerem que os jogos podem estar ocupando bastante espaço no seu dia. Pequenos passos podem ajudar a reorganizar a rotina.',
    rec: 'Converse com alguém de confiança e combine pausas entre as partidas, começando por uma atividade fora das telas.',
    tip: 'Prefira partidas curtas. Ao terminar cada uma, levante, beba água e faça uma pausa antes de começar outra.'
  },
  neutro: {
    label: 'Sem classificação',
    title: 'Obrigado por participar',
    text: 'Você respondeu às cinco perguntas. Nem todas se aplicavam à sua rotina, então não há classificação neste dia.',
    rec: 'Continue acompanhando seus hábitos e organizando tempo para descanso, estudos e lazer.',
    tip: null
  }
};
const ACT = {
  study: ' Estudar ',
  sport: ' Fazer atividade física ',
  draw: ' Desenhar ',
  read: ' Ler ',
  family: ' Fazer algo com a família ',
  rest: ' Descansar '
};
/*
 * Desafios antigos preservados.
 * Mantidos como fallback; o catálogo diário abaixo define a atividade exibida.
 */
const CH = {
  baixo: {
    tag: 'Missão de manutenção',
    title: '20 minutos de pausa ativa',
    min: 20,
    pts: 20,
    text: 'Seu equilíbrio está bom! Para mantê-lo, depois de uma sessão de jogo faça uma pausa de 20 minutos com uma atividade fora das telas.',
    list: ['sport', 'read', 'draw', 'family', 'rest']
  },
  mod: {
    tag: 'Missão de organização da rotina',
    title: '30 minutos antes do jogo',
    min: 30,
    pts: 20,
    text: 'Antes de iniciar sua próxima sessão de jogo, escolha uma atividade fora das telas durante 30 minutos e organize o horário do seu dia.',
    list: ['study', 'sport', 'draw', 'read', 'family']
  },
  alto: {
    tag: 'Missão Offline',
    title: '45 minutos sem telas',
    min: 45,
    pts: 20,
    text: 'Reduza o tempo de tela hoje: fique 45 minutos sem telas antes de jogar de novo. Comece por algo de que você goste.',
    list: ['study', 'sport', 'draw', 'read', 'family']
  },
  neutro: {
    tag: 'Atividade de bem-estar',
    title: 'Uma pausa para fazer o que gosta',
    min: 20,
    pts: 20,
    text: 'Faça uma pequena atividade fora das telas, no seu ritmo. O cronômetro é apenas um apoio opcional.',
    list: ['read', 'draw', 'family', 'rest']
  }
};

/*
 * Catálogo de desafios por dia e nível — PROPOSTA DE CONTEÚDO.
 * 21 atividades (7 dias × 3 níveis) + 7 opções sem classificação.
 * Textos novos devem ser validados pelo orientador antes da coleta real.
 * Não representam diagnóstico ou intervenção de saúde.
 */
const DESAFIOS_POR_DIA = [
  {
    baixo: { tag: "Dia 1 • Desafio educativo", title: "Rotina em equilíbrio", min: 8, pts: 20, text: "Reserve alguns minutos para escolher quando vai jogar hoje e qual outra atividade também quer fazer. Siga o combinado no seu ritmo.", list: ["family", "read"] },
    mod: { tag: "Dia 1 • Desafio educativo", title: "Pausa entre as partidas", min: 10, pts: 20, text: "Depois de jogar, faça uma pausa de dez minutos. Você pode conversar, desenhar ou simplesmente descansar antes de continuar.", list: ["draw", "family", "rest"] },
    alto: { tag: "Dia 1 • Desafio educativo", title: "Um tempo longe dos jogos", min: 20, pts: 20, text: "Escolha uma atividade que goste fora das telas e tente praticá-la por vinte minutos. Se precisar, peça ajuda para organizar esse momento.", list: ["sport", "draw", "family"] },
    neutro: { tag: "Dia 1 • Desafio educativo", title: "Conheça sua rotina", min: 10, pts: 20, text: "Escolha uma atividade agradável fora das telas e faça uma pequena pausa. Não é necessário receber uma classificação para participar.", list: ["read", "draw", "rest"] }
  },
  {
    baixo: { tag: "Dia 2 • Desafio educativo", title: "Organização primeiro", min: 10, pts: 20, text: "Antes de jogar, confira seus materiais e separe o que precisa fazer para estudar. Um pequeno plano já ajuda bastante.", list: ["study", "read"] },
    mod: { tag: "Dia 2 • Desafio educativo", title: "Um momento de foco", min: 15, pts: 20, text: "Escolha uma atividade escolar e dedique quinze minutos a ela antes de iniciar outro jogo. Se não houver tarefa, organize o material para o próximo dia.", list: ["study", "read"] },
    alto: { tag: "Dia 2 • Desafio educativo", title: "Responsabilidades por etapas", min: 20, pts: 20, text: "Divida uma tarefa em partes pequenas. Conclua uma etapa com calma antes de voltar aos jogos. Peça apoio a um adulto se precisar.", list: ["study", "family"] },
    neutro: { tag: "Dia 2 • Desafio educativo", title: "Prepare o próximo dia", min: 10, pts: 20, text: "Escolha um material ou uma pequena atividade que ajude a preparar sua rotina de amanhã.", list: ["study", "read"] }
  },
  {
    baixo: { tag: "Dia 3 • Desafio educativo", title: "Um horário para descansar", min: 10, pts: 20, text: "Converse com alguém de casa e combine um horário tranquilo para interromper as telas antes do descanso.", list: ["family", "rest"] },
    mod: { tag: "Dia 3 • Desafio educativo", title: "Pausa de descanso", min: 15, pts: 20, text: "Reserve quinze minutos para descansar longe das telas. Você pode ler, conversar ou ficar em um lugar calmo.", list: ["rest", "read", "family"] },
    alto: { tag: "Dia 3 • Desafio educativo", title: "Descanso sem telas", min: 20, pts: 20, text: "Experimente ficar vinte minutos sem jogos ou vídeos antes do momento de descanso. Escolha uma atividade calma.", list: ["rest", "read", "family"] },
    neutro: { tag: "Dia 3 • Desafio educativo", title: "Tempo de descanso", min: 10, pts: 20, text: "Escolha uma atividade tranquila para desacelerar por alguns minutos.", list: ["rest", "read"] }
  },
  {
    baixo: { tag: "Dia 4 • Desafio educativo", title: "Lembrete de pausa", min: 5, pts: 20, text: "Escolha uma pausa de cinco minutos para levantar, beber água ou descansar os olhos enquanto joga.", list: ["rest", "sport"] },
    mod: { tag: "Dia 4 • Desafio educativo", title: "Pausa com movimento", min: 10, pts: 20, text: "Depois de uma partida, faça dez minutos de movimento leve, se puder, ou uma atividade confortável longe da tela.", list: ["sport", "rest"] },
    alto: { tag: "Dia 4 • Desafio educativo", title: "Outra atividade no intervalo", min: 20, pts: 20, text: "Reserve vinte minutos para uma atividade fora dos jogos. Pode ser desenho, leitura, conversa ou um movimento de que goste.", list: ["draw", "read", "family", "sport"] },
    neutro: { tag: "Dia 4 • Desafio educativo", title: "Sua pausa preferida", min: 5, pts: 20, text: "Escolha um tipo de pausa e experimente fazê-la durante alguns minutos.", list: ["rest", "read"] }
  },
  {
    baixo: { tag: "Dia 5 • Desafio educativo", title: "Lazer além das telas", min: 10, pts: 20, text: "Escolha uma brincadeira ou atividade de que gosta fora das telas e aproveite por dez minutos.", list: ["draw", "sport", "family"] },
    mod: { tag: "Dia 5 • Desafio educativo", title: "Experimente outra atividade", min: 15, pts: 20, text: "Reserve quinze minutos para desenhar, ler, caminhar acompanhado ou conversar com alguém, conforme sua preferência.", list: ["draw", "read", "family", "sport"] },
    alto: { tag: "Dia 5 • Desafio educativo", title: "Descubra outro passatempo", min: 20, pts: 20, text: "Passe vinte minutos com uma atividade sem jogos eletrônicos. O objetivo é experimentar outras formas de diversão.", list: ["draw", "read", "family", "sport"] },
    neutro: { tag: "Dia 5 • Desafio educativo", title: "Um passatempo diferente", min: 10, pts: 20, text: "Experimente uma brincadeira ou um passatempo fora das telas, do seu jeito.", list: ["draw", "family"] }
  },
  {
    baixo: { tag: "Dia 6 • Desafio educativo", title: "Perceba como você está", min: 5, pts: 20, text: "Depois de jogar, pare um instante e pense em como se sentiu. Se quiser, compartilhe com alguém de confiança.", list: ["family", "rest"] },
    mod: { tag: "Dia 6 • Desafio educativo", title: "Pausa para respirar", min: 5, pts: 20, text: "Faça uma pausa tranquila de cinco minutos antes de iniciar outra partida. Respire normalmente e volte quando quiser.", list: ["rest", "family"] },
    alto: { tag: "Dia 6 • Desafio educativo", title: "Uma atividade tranquila", min: 15, pts: 20, text: "Se uma partida deixou você chateado, troque de atividade por quinze minutos. Conversar com alguém também pode ajudar.", list: ["rest", "draw", "family"] },
    neutro: { tag: "Dia 6 • Desafio educativo", title: "Pausa de tranquilidade", min: 10, pts: 20, text: "Escolha uma atividade relaxante por alguns minutos, sem precisar avaliar suas emoções.", list: ["rest", "draw"] }
  },
  {
    baixo: { tag: "Dia 7 • Desafio educativo", title: "Mantenha sua boa rotina", min: 10, pts: 20, text: "Lembre de uma coisa que ajudou a equilibrar jogos, estudos e descanso. Planeje como repetir esse hábito.", list: ["study", "family", "rest"] },
    mod: { tag: "Dia 7 • Desafio educativo", title: "Planeje a próxima semana", min: 15, pts: 20, text: "Escolha horários simples para jogar, estudar e descansar. Anote ou combine esse plano com alguém de casa.", list: ["study", "family", "rest"] },
    alto: { tag: "Dia 7 • Desafio educativo", title: "Escolha uma prioridade", min: 20, pts: 20, text: "Antes de jogar, escolha uma tarefa ou atividade importante para fazer primeiro. Depois, organize seu tempo livre.", list: ["study", "family", "rest"] },
    neutro: { tag: "Dia 7 • Desafio educativo", title: "Seu pequeno plano", min: 10, pts: 20, text: "Escolha uma atividade que deseja repetir na próxima semana para cuidar da sua rotina.", list: ["study", "family", "rest"] }
  }
];

function desafioParaDia(dia, nivel) {
  const indice = Number(dia) - 1;
  if (!Number.isInteger(indice) || indice < 0 || indice >= 7) {
    return CH[nivel] || CH.neutro;
  }
  return DESAFIOS_POR_DIA[indice][nivel] ||
    DESAFIOS_POR_DIA[indice].neutro;
}

const C = 2 * Math.PI * 54;
const $ = id => document.getElementById(id);
const $$ = seletor => [...document.querySelectorAll(seletor)];
const $sel = seletor => document.querySelector(seletor);
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
let checkinsSincronizados = false;
let enviandoCheckin = false;
let requisicaoCheckins = 0;
let desafiosSincronizados = false;
let enviandoDesafio = false;
let requisicaoDesafios = 0;
let carregamentoDesafios = null;
/*
 * DATAS DO TESTE
 */
function hojeFortaleza(agora = new Date()) {
  const partes = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(agora);
  const pegar = tipo =>
    partes.find(p => p.type === tipo)?.value;
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
}
function somarDias(iso, quantidade) {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(
    Date.UTC(ano, mes - 1, dia + quantidade)
  ).toISOString().slice(0, 10);
}
function diferencaDias(inicio, fim) {
  const [a, m, d] = inicio.split('-').map(Number);
  const [b, n, e] = fim.split('-').map(Number);
  return Math.round(
    (Date.UTC(b, n - 1, e) - Date.UTC(a, m - 1, d))
    / 86400000
  );
}
function formatarData(valor, comHora = false) {
  const entrada = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? `${valor}T12:00:00-03:00`
    : valor;
  const data = new Date(entrada);
  if (Number.isNaN(data.getTime())) return '—';
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
  const inicio = acesso?.periodo?.inicio;
  if (!inicio) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return inicio;
  }
  const data = new Date(inicio);
  return Number.isNaN(data.getTime())
    ? null
    : hojeFortaleza(data);
}
function diaDoTeste() {
  const inicio = dataInicioTeste();
  return inicio
    ? diferencaDias(inicio, hojeFortaleza()) + 1
    : null;
}
/*
 * ESTADO LOCAL
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
      prefixoEstado + uidAtual,
      JSON.stringify(S)
    );
  } catch {
    // Armazenamento indisponível.
  }
}
function carregarEstado(uid) {
  if (uidAtual && uidAtual !== uid) {
    pauseTimer();
  }
  checkinsSincronizados = false;
  requisicaoCheckins++;
  desafiosSincronizados = false;
  requisicaoDesafios++;
  carregamentoDesafios = null;
  enviandoDesafio = false;

  uidAtual = uid;
  diaResultado = null;
  quizRenderizadoPara = null;
  let salvo = null;
  try {
    salvo = JSON.parse(
      localStorage.getItem(prefixoEstado + uid) || 'null'
    );
  } catch {
    salvo = null;
  }
  S = estadoInicial();
  if (salvo && typeof salvo === 'object') {
    S.dias =
      salvo.dias &&
      typeof salvo.dias === 'object' &&
      !Array.isArray(salvo.dias)
        ? salvo.dias
        : {};
    S.ativo =
      salvo.ativo &&
      typeof salvo.ativo === 'object'
        ? salvo.ativo
        : null;
    S.rascunho =
      salvo.rascunho &&
      typeof salvo.rascunho === 'object'
        ? salvo.rascunho
        : null;
  }
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
    reg.desafios = reg.desafios.filter(
      d => d && typeof d === 'object'
    );
    for (const d of reg.desafios) {
      if (!CH[d.nivel]) {
        d.nivel = 'mod';
      }
      if (
        !['oferecido', 'aceito', 'concluido', 'nao_concluido']
          .includes(d.status)
      ) {
        d.status = 'nao_concluido';
      }
      if (!Number.isFinite(d.pontos)) {
        d.pontos = CH[d.nivel].pts;
      }
    }
  }
  if (
    S.ativo &&
    (!desafioAtivo() || desafioAtivo().status !== 'aceito')
  ) {
    S.ativo = null;
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
  const registro = S.dias[n]?.checkin;
  return registro?.origem === 'supabase'
    ? registro
    : null;
}
function desafiosDoDia(n) {
  return Array.isArray(S.dias[n]?.desafios)
    ? S.dias[n].desafios
    : [];
}
function desafioAtivo() {
  if (!S.ativo) return null;
  return desafiosDoDia(S.ativo.dia)[S.ativo.idx] || null;
}
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
/*
 * CONTROLE DA INTERFACE
 */
function toast(mensagem) {
  const elemento = $('toast');
  elemento.textContent = mensagem;
  elemento.style.opacity = 1;
  setTimeout(() => {
    elemento.style.opacity = 0;
  }, 2400);
}
function mostrarCarregandoAcesso(ligado) {
  $('carregandoAcesso').classList.toggle(
    'hidden',
    !ligado
  );
}
function mostrarTela(tela) {
  telaAtual = tela;
  if (tela !== 'app') {
    pauseTimer();
  }
  $('intro').classList.toggle(
    'hidden',
    !['marca', 'formulario', 'boasvindas'].includes(tela)
  );
  $('espera').classList.toggle(
    'hidden',
    tela !== 'espera'
  );
  $('bloqueio').classList.toggle(
    'hidden',
    tela !== 'bloqueio'
  );
  $('app').classList.toggle(
    'hidden',
    tela !== 'app'
  );
  $('app').classList.toggle(
    'md:flex',
    tela === 'app'
  );
}
function mostrarPassoIntro(passo) {
  $('brandStep').classList.toggle(
    'hidden',
    passo !== 'marca'
  );
  if (passo === 'marca') {
    $('brandStep').classList.remove('out');
  }
  $('nameStep').classList.toggle(
    'hidden',
    passo !== 'nome'
  );
  if (passo === 'nome') {
    $('nameStep').classList.add('fade-in');
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
    () => verificarAgora({ silencioso: true }),
    INTERVALO_VERIFICACAO_MS
  );
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
  if (telaAtual === 'espera' || telaAtual === 'app') {
    verificarAgora({ silencioso: true });
  }
});
/*
 * AUTENTICAÇÃO
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
    throw new Error('Configuração indisponível.');
  }
  const config = await resposta.json();
  if (
    !config.supabaseUrl ||
    !config.supabasePublishableKey
  ) {
    throw new Error('Configuração inválida.');
  }
  const projeto = new URL(config.supabaseUrl).hostname;
  prefixoEstado = `fairplay-v5:${projeto}:`;
  const { createClient } = await import(SUPABASE_ESM);
  supa = createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: `${CHAVE_SESSAO}:${projeto}`
      }
    }
  );
}
async function sessaoLocal() {
  const { data, error } =
    await supa.auth.getSession();
  return error ? null : data?.session || null;
}
async function encerrarSessao() {
  pararVerificacao();
  pauseTimer();
  requisicaoCheckins++;
  requisicaoDesafios++;
  desafiosSincronizados = false;
  carregamentoDesafios = null;
  enviandoDesafio = false;

  acesso = null;
  acessoConfirmado = false;
  uidAtual = null;
  checkinsSincronizados = false;
  S = estadoInicial();
  diaResultado = null;
  quizRenderizadoPara = null;
  try {
    if (supa) {
      await supa.auth.signOut();
    }
  } catch {
    // Ignora falha ao encerrar sessão.
  }
}
function mensagemFalhaAcesso(erro) {
  return erro?.status === 429
    ? 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
    : 'Não foi possível iniciar seu acesso agora. Verifique sua internet e tente novamente.';
}
async function postServidor(url, { token, corpo } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: corpo !== undefined
        ? JSON.stringify(corpo)
        : undefined,
      cache: 'no-store'
    });
  } catch {
    throw new ErroFluxo(
      'Sem conexão. Verifique sua internet e tente novamente.',
      'rede'
    );
  }
}
async function lerJson(resposta) {
  try {
    return await resposta.json();
  } catch {
    return {};
  }
}
async function tokenDaSessao(renovar = false) {
  if (renovar) {
    const { data, error } =
      await supa.auth.refreshSession();
    if (error || !data?.session) {
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
    { token: await tokenDaSessao() }
  );
  if (resposta.status === 401) {
    resposta = await postServidor(
      FUNCOES.consultar,
      { token: await tokenDaSessao(true) }
    );
  }
  if ([401, 403].includes(resposta.status)) {
    throw new ErroFluxo(
      'Sessão inválida.',
      'sessao',
      resposta.status
    );
  }
  const dados = await lerJson(resposta);
  if (!resposta.ok) {
    throw new ErroFluxo(
      dados.erro || 'Não foi possível verificar seu acesso agora.',
      'servidor',
      resposta.status
    );
  }
  return dados;
}
/*
 * CHECK-INS NO SUPABASE
 */
function aplicarCheckinRemoto(registro) {
  const dia = Number(registro?.dia_numero);
  if (
    !Number.isInteger(dia) ||
    dia < 1 ||
    dia > 7
  ) {
    return;
  }
  registroDoDia(dia).checkin = {
    origem: 'supabase',
    respostas: registro.respostas,
    pontuacao: registro.pontuacao,
    nivel: registro.nivel === 'moderado'
      ? 'mod'
      : registro.nivel,
    registradoEm: registro.primeiro_envio_em,
    recuperado: registro.enviado_atrasado === true
  };
}
async function carregarCheckinsServidor() {
  checkinsSincronizados = false;
  const minhaRequisicao = ++requisicaoCheckins;
  const uidInicial = uidAtual;
  let resposta = await fetch(
    FUNCOES.checkin,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${await tokenDaSessao()}`
      },
      cache: 'no-store'
    }
  );
  if (resposta.status === 401) {
    resposta = await fetch(
      FUNCOES.checkin,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await tokenDaSessao(true)}`
        },
        cache: 'no-store'
      }
    );
  }
  if (!resposta.ok) {
    throw new Error(
      'Não foi possível carregar os check-ins.'
    );
  }
  const dados = await resposta.json();
  if (!Array.isArray(dados.checkins)) {
    throw new Error(
      'Não foi possível verificar seus check-ins. Atualize a página.'
    );
  }
  if (
    minhaRequisicao !== requisicaoCheckins ||
    uidInicial !== uidAtual
  ) {
    return;
  }
  for (let dia = 1; dia <= 7; dia++) {
    const local = registroDoDia(dia);
    if (
      local.checkin &&
      local.checkin.origem !== 'supabase'
    ) {
      local.checkinAnteriorLocal = local.checkin;
    }
    local.checkin = null;
  }
  dados.checkins.forEach(aplicarCheckinRemoto);
  checkinsSincronizados = true;
  salvarEstado();
  atualizarBloqueios();
}
function vinculado() {
  return !!acesso &&
    !!acesso.status &&
    acesso.status !== 'sem_solicitacao';
}
function podeRegistrar() {
  return coletaLiberada() && acessoConfirmado;
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
    if (minha !== seqAcesso) return;
    acessoConfirmado = true;
    registrarVerificacao();
    aplicarAcesso(dados, { aposEnvio });
  } catch (erro) {
    if (minha !== seqAcesso) return;
    tratarFalhaVerificacao(
      erro,
      { silencioso }
    );
  } finally {
    if (minha === seqAcesso) {
      mostrarCarregandoAcesso(false);
    }
  }
}
function tratarFalhaVerificacao(
  erro,
  { silencioso }
) {
  acessoConfirmado = false;
  if (erro.tipo === 'sessao') {
    if (vinculado()) {
      mostrarBloqueio(
        'Sessão não confirmada',
        'Não foi possível confirmar sua sessão. Recarregue a página. Se o problema continuar, procure a equipe.'
      );
    } else {
      encerrarSessao().then(() =>
        mostrarFormulario(
          'Sua sessão expirou. Informe seu nome novamente.'
        )
      );
    }
    return;
  }
  const mensagem =
    erro.message ||
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
function aplicarAcesso(
  dados,
  { aposEnvio = false } = {}
) {
  acesso = dados;
  if (dados.pode_entrar === true) {
    entrarNoApp(aposEnvio);
    return;
  }
  if (dados.motivo === 'aguardando_autorizacao') {
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
  if (dados.motivo === 'participante_inativo') {
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
function textoBloqueio(tipo) {
  if (
    acesso?.fase === 'antes_do_inicio' &&
    acesso.periodo
  ) {
    return `Os ${tipo} começam em ${formatarData(acesso.periodo.inicio)}. Até lá, você pode explorar o aplicativo.`;
  }
  return `Os ${tipo} ainda não estão liberados.`;
}
function entrarNoApp(comBoasVindas) {
  const nome = acesso?.nome || '';
  $('greet').textContent = `Olá, ${nome}`;
  $('sideName').textContent = nome;
  $('hello').textContent = 'Seja bem-vindo(a)';
  $('whoName').textContent = nome;
  if (telaAtual === 'app') {
    atualizarBloqueios();
    if (!checkinsSincronizados) {
      carregarCheckinsServidor().catch(() => {});
    }
    if (coletaLiberada() && !desafiosSincronizados && !carregamentoDesafios) {
      carregarDesafiosServidor().catch(() => {});
    }
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
  mostrarSecao(secaoAtual || 'home');
  atualizarBloqueios();
  ativarVerificacao();
  carregarCheckinsServidor().catch(() => {
    checkinsSincronizados = false;
    atualizarBloqueios();
    toast(
      'Não foi possível verificar seus check-ins. Tente novamente ou atualize a página.'
    );
  });

  if (coletaLiberada()) {
    carregarDesafiosServidor().catch(() => {
      desafiosSincronizados = false;
      atualizarBloqueios();
      toast('Não foi possível verificar seus desafios. Atualize a página.');
    });
  }
}
function atualizarBanner() {
  const banner = $('periodoBanner');
  const dia = diaDoTeste();
  let texto = '';
  if (acesso?.pode_entrar === true) {
    if (!acessoConfirmado) {
      texto = MSG_SEM_CONFIRMACAO;
    } else if (!dataInicioTeste()) {
      texto =
        'Acesso liberado. A data oficial do teste ainda não foi definida; os check-ins ainda não estão disponíveis.';
    } else if (acesso.fase === 'antes_do_inicio') {
      texto =
        `Acesso liberado. Os check-ins começam em ${formatarData(acesso.periodo.inicio)}. Use este tempo para preparar seu aparelho.`;
    } else if (dia === DIAS_DO_TESTE + 1) {
      texto =
        'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Novos desafios não estão disponíveis.';
    } else if (acesso.fase === 'coleta') {
      texto =
        `Check-ins abertos até ${formatarData(acesso.periodo.fim, true)}.`;
    }
  }
  banner.textContent = texto;
  banner.classList.toggle('hidden', !texto);
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
  if (secaoAtual === 'checkin') renderCheckin();
  if (secaoAtual === 'challenge') renderChallenge();
  if (secaoAtual === 'progress') renderProgress();
}
function sincronizarDesafioAtivo() {
  const desafio = desafioAtivo();
  if (!desafio) {
    if (S.ativo) {
      S.ativo = null;
      salvarEstado();
    }
    return;
  }
  if (!running && desafio.prazo) {
    desafio.rem = restanteDoDesafio(desafio);
    desafio.prazo = null;
    salvarEstado();
  }
  const dia = diaDoTeste();
  if (dia !== null && dia !== S.ativo.dia) {
    // O registro permanece no Supabase. Apenas encerramos o acesso local
    // ao desafio do dia anterior, sem fingir que o banco foi alterado.
    descartarDesafioAtivo();
    return;
  }
  if (!coletaLiberada()) {
    pauseTimer();
  }
}
/*
 * NOME E SOLICITAÇÃO DE ACESSO
 */
function construirMarca() {
  [...'Fair Play'].forEach((caractere, indice) => {
    const letra = document.createElement('span');
    letra.className = 'brand-letter';
    letra.style.animationDelay =
      (0.2 + indice * 0.09) + 's';
    letra.textContent =
      caractere === ' ' ? '\u00a0' : caractere;
    $('brandWord').appendChild(letra);
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
  if (!/^\p{L}[\p{L}'’-]*$/u.test(nome)) {
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
  if ([401, 403].includes(resposta.status)) {
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
  $('nameSubmit').disabled = ligado || !supa;
  $('nameSubmit').textContent =
    ligado ? 'ENVIANDO...' : 'CONTINUAR';
  $('nameInput').disabled = ligado;
  if (ligado) {
    $('formAviso').textContent =
      'Enviando sua solicitação...';
  } else if (
    $('formAviso').textContent ===
    'Enviando sua solicitação...'
  ) {
    $('formAviso').textContent = '';
  }
}
async function enviarSolicitacao() {
  if (enviando) return;
  const nome = $('nameInput').value.trim();
  $('nameErr').textContent = '';
  $('formAviso').textContent = '';
  const erroNome = validarNomeEstudante(nome);
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
      if (error || !data?.session) {
        throw new ErroFluxo(
          mensagemFalhaAcesso(error),
          'auth'
        );
      }
      sessao = data.session;
    }
    if (uidAtual !== sessao.user.id) {
      carregarEstado(sessao.user.id);
    }
    const resposta = await postServidor(
      FUNCOES.solicitar,
      {
        token: sessao.access_token,
        corpo: {
          nome,
          tipo_dispositivo: TIPO_DISPOSITIVO_PADRAO
        }
      }
    );
    if (resposta.status !== 202) {
      throw mensagemErroSolicitacao(resposta);
    }
    solicitacaoEnviada = true;
    await verificarAgora({
      aposEnvio: true
    });
  } catch (erro) {
    if (erro.tipo === 'sessao') {
      await encerrarSessao();
    }
    $('formAviso').textContent =
      erro.message ||
      'Algo deu errado. Tente novamente.';
  } finally {
    definirEnvio(false);
  }
}
/*
 * NAVEGAÇÃO
 */
function go(id) {
  mostrarSecao(id);
}
function mostrarSecao(id) {
  if (telaAtual !== 'app' || !$(id)) {
    return;
  }
  secaoAtual = id;
  $$('.screen').forEach(tela => {
    tela.classList.add('hidden');
  });
  $(id).classList.remove('hidden');
  $(id).style.animation = 'none';
  void $(id).offsetWidth;
  $(id).style.animation = '';
  $$('[data-nav]').forEach(botao => {
    botao.classList.toggle(
      'active',
      botao.dataset.nav ===
        (id === 'result' ? 'checkin' : id)
    );
  });
  if (id === 'checkin') renderCheckin();
  if (id === 'result') showResult();
  if (id === 'challenge') renderChallenge();
  if (id === 'progress') renderProgress();
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}
document.addEventListener('click', evento => {
  const botao = evento.target.closest('[data-go]');
  if (botao) {
    go(botao.dataset.go);
  }
});
/*
 * QUESTIONÁRIO DIÁRIO
 */
function estadoCheckin() {
  if (!coletaLiberada()) {
    return {
      tipo: 'bloqueado',
      texto: textoBloqueio('check-ins')
    };
  }
  if (!checkinsSincronizados) {
    return {
      tipo: 'sem_confirmacao',
      texto:
        'Verificando seus registros... Aguarde ou atualize a página.'
    };
  }
  const dia = diaDoTeste();
  let estado;
  if (dia === DIAS_DO_TESTE + 1) {
    estado = checkinDoDia(DIAS_DO_TESTE)
      ? {
          tipo: 'dia8_fechado',
          alvo: DIAS_DO_TESTE,
          texto: 'Hoje é o Dia 8. Seu check-in do Dia 7 já está registrado. Não há novo check-in neste dia.'
        }
      : {
          tipo: 'recuperacao',
          alvo: DIAS_DO_TESTE,
          texto: 'Hoje é o Dia 8: você pode apenas recuperar o check-in do Dia 7. Não há novo check-in para o Dia 8.'
        };
  } else if (
    dia >= 1 &&
    dia <= DIAS_DO_TESTE
  ) {
    estado = checkinDoDia(dia)
      ? {
          tipo: 'ja_feito',
          alvo: dia,
          texto: `Seu check-in do Dia ${dia} já está registrado. Toque em VER MEU RESULTADO para revê-lo.`
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
    ['novo', 'recuperacao'].includes(estado.tipo) &&
    !acessoConfirmado
  ) {
    return {
      tipo: 'sem_confirmacao',
      texto: MSG_SEM_CONFIRMACAO
    };
  }
  return estado;
}
function renderCheckin() {
  const estado = estadoCheckin();
  const dia = diaDoTeste();
  const rotuloDia = $('checkinDiaAtual');
  if (dia >= 1 && dia <= DIAS_DO_TESTE) {
    rotuloDia.textContent = `Dia ${dia} de ${DIAS_DO_TESTE} • ${formatarDataCurta(hojeFortaleza())}`;
    rotuloDia.classList.remove('hidden');
  } else {
    rotuloDia.textContent = '';
    rotuloDia.classList.add('hidden');
  }
  const caixa = $('checkinBloqueio');
  const bloqueado =
    estado.tipo === 'bloqueado' ||
    estado.tipo === 'sem_confirmacao';
  caixa.classList.toggle(
    'hidden',
    estado.tipo === 'novo'
  );
  caixa.classList.toggle(
    'aviso-alerta',
    bloqueado
  );
  caixa.classList.toggle(
    'aviso-info',
    !bloqueado
  );
  $('checkinBloqueioTexto').textContent =
    estado.texto || '';
  $('quizArea').classList.toggle(
    'hidden',
    bloqueado
  );
  if (
    estado.tipo === 'novo' ||
    estado.tipo === 'recuperacao'
  ) {
    renderQuiz(estado.alvo);
  } else {
    limparQuiz();
  }
}
function renderQuiz(dia) {
  const perguntas = perguntasDoDia(dia);
  if (perguntas.length !== 5) {
    $('quizErr').textContent =
      'Questionário indisponível para este dia.';
    return;
  }
  if (
    !S.rascunho ||
    S.rascunho.dia !== dia ||
    !Array.isArray(S.rascunho.ans) ||
    S.rascunho.ans.length !== 5
  ) {
    S.rascunho = {
      dia,
      ans: perguntas.map(() => null)
    };
    salvarEstado();
  }
  if (quizRenderizadoPara === dia) {
    return;
  }
  quizRenderizadoPara = dia;
  $('quizErr').textContent = '';
  $('quiz').innerHTML = perguntas.map((pergunta, i) => `
    <div class="q" data-q="${i}">
      <h2 class="qt font-display font-bold text-lg mb-3">
        ${i + 1}. ${pergunta.q}
      </h2>
      <div class="space-y-2">
        ${pergunta.o.map((alternativa, j) => `
          <button
            type="button"
            class="opt${S.rascunho.ans[i] === j ? ' sel' : ''}"
            data-q="${i}"
            data-v="${j}"
          >${alternativa.texto}</button>
        `).join('')}
      </div>
    </div>
  `).join('');
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
$('quiz').addEventListener('click', evento => {
  const botao = evento.target.closest('.opt');
  if (!botao) return;
  const estado = estadoCheckin();
  if (!['novo', 'recuperacao'].includes(estado.tipo)) {
    toast(
      estado.texto || MSG_CHECKIN_BLOQUEADO
    );
    return;
  }
  if (
    !S.rascunho ||
    S.rascunho.dia !== estado.alvo
  ) {
    return;
  }
  const indice = Number(botao.dataset.q);
  S.rascunho.ans[indice] =
    Number(botao.dataset.v);
  salvarEstado();
  $$(`.opt[data-q="${indice}"]`).forEach(opcao => {
    opcao.classList.toggle(
      'sel',
      opcao === botao
    );
  });
  $sel(`.q[data-q="${indice}"]`)
    ?.classList.remove('missing');
  $('quizErr').textContent = '';
});
/*
 * ENVIO DEFINITIVO DO CHECK-IN
 */
$('seeResult').addEventListener('click', async () => {
  if (enviandoCheckin) return;
  const estado = estadoCheckin();
  if (
    estado.tipo === 'ja_feito' ||
    estado.tipo === 'dia8_fechado'
  ) {
    abrirResultado(estado.alvo);
    return;
  }
  if (!['novo', 'recuperacao'].includes(estado.tipo)) {
    toast(
      estado.texto || MSG_CHECKIN_BLOQUEADO
    );
    return;
  }
  const perguntas =
    perguntasDoDia(estado.alvo);
  const respostas =
    S.rascunho?.dia === estado.alvo
      ? S.rascunho.ans
      : [];
  if (perguntas.length !== 5) {
    $('quizErr').textContent =
      'Questionário indisponível.';
    return;
  }
  const faltando = perguntas
    .map((pergunta, i) =>
      !Number.isInteger(respostas[i]) ||
      !pergunta.o[respostas[i]]
        ? i
        : -1
    )
    .filter(i => i >= 0);
  if (faltando.length) {
    faltando.forEach(i => {
      $sel(`.q[data-q="${i}"]`)
        ?.classList.add('missing');
    });
    $('quizErr').textContent =
      'Responda todas as cinco perguntas.';
    $sel(`.q[data-q="${faltando[0]}"]`)
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    return;
  }
  const alternativas = perguntas.map(
    (pergunta, i) =>
      pergunta.o[respostas[i]].id
  );
  enviandoCheckin = true;
  $('seeResult').disabled = true;
  $('quizErr').textContent =
    'Salvando suas respostas...';
  try {
    let resposta = await postServidor(
      FUNCOES.checkin,
      {
        token: await tokenDaSessao(),
        corpo: { respostas: alternativas }
      }
    );
    if (resposta.status === 401) {
      resposta = await postServidor(
        FUNCOES.checkin,
        {
          token: await tokenDaSessao(true),
          corpo: { respostas: alternativas }
        }
      );
    }
    if (resposta.status === 409) {
      await carregarCheckinsServidor();
      if (checkinDoDia(estado.alvo)) {
        S.rascunho = null;
        salvarEstado();
        abrirResultado(estado.alvo);
        return;
      }
      throw new Error(
        'Check-in já registrado.'
      );
    }
    if (!resposta.ok) {
      const dados = await lerJson(resposta);
      throw new Error(
        dados.erro ||
        'Não foi possível salvar o check-in.'
      );
    }
    const dados = await resposta.json();
    if (!dados.checkin) {
      throw new Error(
        'Não foi possível confirmar seu check-in.'
      );
    }
    aplicarCheckinRemoto(dados.checkin);
    S.rascunho = null;
    salvarEstado();
    $('quizErr').textContent = '';
    abrirResultado(estado.alvo);
  } catch (erro) {
    $('quizErr').textContent =
      `Não conseguimos confirmar seu check-in. Suas respostas continuam preenchidas. ${erro.message || 'Tente novamente.'}`;
  } finally {
    enviandoCheckin = false;
    $('seeResult').disabled = false;
  }
});
/*
 * TELA DE RESULTADO SEM ÍCONES COLORIDOS
 */
function showResult() {
  const checkin = diaResultado
    ? checkinDoDia(diaResultado)
    : null;
  if (!checkin) {
    go('checkin');
    return;
  }
  const resultado =
    RESULTS[checkin.nivel] ||
    RESULTS.neutro;
  $('resTitle').textContent = resultado.title;
  $('resText').textContent = resultado.text;
  $('resRec').textContent = resultado.rec;
  $('resTipCard').classList.toggle(
    'hidden',
    !resultado.tip
  );
  $('resTip').textContent =
    resultado.tip || '';
  $('lvlLabel').textContent =
    resultado.label;
  $('lvlLabel').style.color = '';
}
/*
 * DESAFIOS
 */
/*
 * DESAFIOS — SERVIDOR É A FONTE DA VERDADE.
 * A interface não cria nem conclui desafios antes da confirmação.
 */
async function requisitarDesafio(acao = null) {
  async function executar(token) {
    if (acao) {
      return postServidor(FUNCOES.desafio, {
        token,
        corpo: { acao }
      });
    }
    try {
      return await fetch(FUNCOES.desafio, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
    } catch {
      throw new Error('Não foi possível carregar seus desafios. Verifique sua internet e tente novamente.');
    }
  }

  let resposta = await executar(await tokenDaSessao());
  if (resposta.status === 401) {
    resposta = await executar(await tokenDaSessao(true));
  }
  const dados = await lerJson(resposta);
  if (!resposta.ok) {
    const erro = new Error(
      dados.erro || `Falha ao acessar os desafios (${resposta.status}).`
    );
    erro.status = resposta.status;
    throw erro;
  }
  return dados;
}

function normalizarDesafioRemoto(registro, anterior = null) {
  const nivel = registro.nivel_atribuido === 'moderado'
    ? 'mod'
    : ['baixo', 'alto'].includes(registro.nivel_atribuido)
      ? registro.nivel_atribuido
      : 'neutro';
  const tempoInicial = desafioParaDia(registro.dia_numero, nivel).min * 60;
  const mesmoCodigo = anterior?.codigo === registro.codigo_desafio;
  const aceito = registro.status === 'aceito';
  return {
    origem: 'supabase',
    codigo: registro.codigo_desafio,
    nivel,
    status: registro.status,
    pontos: 20,
    aceitoEm: registro.aceito_em,
    concluidoEm: registro.concluido_em,
    rem: aceito && mesmoCodigo && Number.isFinite(anterior?.rem)
      ? Math.max(0, Math.min(tempoInicial, anterior.rem))
      : tempoInicial,
    prazo: aceito && mesmoCodigo ? anterior.prazo || null : null,
    timerIniciado: aceito && mesmoCodigo
      ? anterior.timerIniciado === true
      : false
  };
}

function aplicarDesafioRemoto(registro) {
  const dia = Number(registro?.dia_numero);
  if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_DO_TESTE) {
    return false;
  }
  if (!registro?.codigo_desafio ||
      !['oferecido', 'aceito', 'concluido'].includes(registro.status)) {
    return false;
  }
  const anterior = desafiosDoDia(dia)[0] || null;
  const local = normalizarDesafioRemoto(registro, anterior);
  registroDoDia(dia).desafios = [local];
  if (local.status === 'aceito' && dia === diaDoTeste()) {
    S.ativo = { dia, idx: 0 };
  } else if (S.ativo?.dia === dia) {
    S.ativo = null;
  }
  salvarEstado();
  return true;
}

async function carregarDesafiosServidor() {
  if (carregamentoDesafios) return carregamentoDesafios;
  const atual = ++requisicaoDesafios;
  const usuario = uidAtual;

  const promessa = (async () => {
    const dados = await requisitarDesafio();
    if (!Array.isArray(dados.desafios)) {
      throw new Error('Não foi possível verificar seus desafios. Atualize a página.');
    }
    if (atual !== requisicaoDesafios || usuario !== uidAtual) return;

    const anteriores = new Map();
    for (let dia = 1; dia <= DIAS_DO_TESTE; dia++) {
      for (const desafio of desafiosDoDia(dia)) {
        if (desafio?.origem === 'supabase' && desafio.codigo) {
          anteriores.set(desafio.codigo, desafio);
        }
      }
      registroDoDia(dia).desafios = [];
    }
    S.ativo = null;
    for (const remoto of dados.desafios) {
      const dia = Number(remoto.dia_numero);
      if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_DO_TESTE ||
          !remoto.codigo_desafio ||
          !['oferecido', 'aceito', 'concluido'].includes(remoto.status)) {
        continue;
      }
      const antigo = anteriores.get(remoto.codigo_desafio) || null;
      const desafio = normalizarDesafioRemoto(remoto, antigo);
      registroDoDia(dia).desafios = [desafio];
      if (desafio.status === 'aceito' && dia === diaDoTeste()) {
        S.ativo = { dia, idx: 0 };
      }
    }
    if (!S.ativo && running) {
      clearInterval(iv);
      iv = null;
      running = false;
    }
    desafiosSincronizados = true;
    salvarEstado();
    atualizarBloqueios();
  })();

  carregamentoDesafios = promessa;
  try {
    await promessa;
  } finally {
    if (carregamentoDesafios === promessa) {
      carregamentoDesafios = null;
    }
  }
}

function nivelHoje() {
  const dia = diaDoTeste();
  if (
    dia === null ||
    dia < 1 ||
    dia > DIAS_DO_TESTE
  ) {
    return null;
  }
  return checkinDoDia(dia)?.nivel || null;
}
function nivelDesafioNovo() {
  // O nível de um dia anterior não deve substituir
  // a ausência de classificação do dia atual.
  return nivelHoje() || 'neutro';
}
function restanteDoDesafio(desafio) {
  const total =
    desafioParaDia(S.ativo?.dia, desafio.nivel).min * 60;
  const restante = desafio.prazo
    ? Math.ceil(
        (desafio.prazo - Date.now()) / 1000
      )
    : Number.isFinite(desafio.rem)
      ? Math.floor(desafio.rem)
      : total;
  return Math.min(
    total,
    Math.max(0, restante)
  );
}
function formatarTempo(segundos) {
  return `${
    String(Math.floor(segundos / 60)).padStart(2, '0')
  }:${
    String(segundos % 60).padStart(2, '0')
  }`;
}
function draw() {
  const desafio = desafioAtivo();
  if (!desafio) return;
  const total =
    desafioParaDia(S.ativo?.dia, desafio.nivel).min * 60;
  const restante =
    restanteDoDesafio(desafio);
  $('clock').textContent =
    formatarTempo(restante);
  $('ring').style.strokeDasharray = C;
  $('ring').style.strokeDashoffset =
    C * (1 - restante / total);
}
function atualizarBotoesTimer() {
  const desafio = desafioAtivo();
  const restante = desafio
    ? restanteDoDesafio(desafio)
    : 0;
  $('pause').textContent = running
    ? 'PAUSAR'
    : desafio?.timerIniciado ? 'RETOMAR' : 'INICIAR';
  $('pause').disabled =
    !desafio ||
    !coletaLiberada() ||
    !desafiosSincronizados ||
    enviandoDesafio ||
    (!running && restante <= 0);
  $('finish').disabled =
    !desafio ||
    !podeRegistrar() ||
    !desafiosSincronizados ||
    enviandoDesafio;
}
function startTimer() {
  if (running) return;
  const desafio = desafioAtivo();
  if (
    !desafio ||
    desafio.status !== 'aceito' ||
    !coletaLiberada()
  ) {
    return;
  }
  const restante =
    restanteDoDesafio(desafio);
  if (restante <= 0) {
    draw();
    atualizarBotoesTimer();
    return;
  }
  clearInterval(iv);
  desafio.rem = restante;
  desafio.prazo =
    Date.now() + restante * 1000;
  desafio.timerIniciado = true;
  running = true;
  salvarEstado();
  atualizarBotoesTimer();
  iv = setInterval(tick, 1000);
  tick();
}
function pauseTimer() {
  clearInterval(iv);
  iv = null;
  const desafio = desafioAtivo();
  if (desafio?.prazo) {
    desafio.rem =
      restanteDoDesafio(desafio);
    desafio.prazo = null;
    salvarEstado();
  }
  running = false;
  atualizarBotoesTimer();
  draw();
}
function tick() {
  const desafio = desafioAtivo();
  if (!desafio) {
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
  if (restanteDoDesafio(desafio) <= 0) {
    pauseTimer();
    toast(
      'Tempo finalizado. Confirme a conclusão do desafio quando estiver pronto.'
    );
    renderChallenge();
    return;
  }
  desafio.rem =
    restanteDoDesafio(desafio);
  draw();
  salvarEstado();
}
function descartarDesafioAtivo() {
  const desafio = desafioAtivo();
  pauseTimer();
  // Não se modifica status local, pois o servidor mantém 'aceito'
  // até o fim do teste; ele não contabiliza pontos sem conclusão.
  if (desafio) desafio.prazo = null;
  S.ativo = null;
  salvarEstado();
  renderChallenge();
  if (telaAtual === 'app') {
    toast(
      'O desafio do dia anterior não foi concluído a tempo e não foi contabilizado.'
    );
  }
}
async function concluirDesafio() {
  const desafio = desafioAtivo();
  if (enviandoDesafio || !desafiosSincronizados ||
      !desafio || desafio.status !== 'aceito') return;

  const dia = diaDoTeste();
  if (dia !== S.ativo?.dia) {
    descartarDesafioAtivo();
    return;
  }
  if (!podeRegistrar()) {
    toast(coletaLiberada() ? MSG_SEM_CONFIRMACAO : MSG_DESAFIO_BLOQUEADO);
    return;
  }

  // Cronômetro opcional: não é necessário terminar a contagem.
  pauseTimer();
  enviandoDesafio = true;
  renderChallenge();

  try {
    const dados = await requisitarDesafio('concluir');
    if (dados?.desafio?.status !== 'concluido' ||
        !aplicarDesafioRemoto(dados.desafio)) {
      throw new Error('Não foi possível confirmar a conclusão do desafio.');
    }
    desafiosSincronizados = true;
    const estatistica = estatisticas();
    toast(estatistica.concluidos % 3 === 0
      ? 'Desafio concluído! Você ganhou 20 pontos e uma nova medalha.'
      : 'Desafio concluído! Você ganhou 20 pontos.');
    setTimeout(() => {
      if (telaAtual === 'app') go('progress');
    }, 1200);
  } catch (erro) {
    // Em caso de resposta perdida, consultar a verdade do Supabase.
    try {
      await carregarDesafiosServidor();
      if (desafiosDoDia(dia)[0]?.status === 'concluido') {
        toast('Desafio concluído! Você ganhou 20 pontos.');
        if (telaAtual === 'app') go('progress');
        return;
      }
    } catch {
      desafiosSincronizados = false;
    }
    toast(erro.message || 'Não foi possível confirmar a conclusão.');
  } finally {
    enviandoDesafio = false;
    renderChallenge();
    if (secaoAtual === 'progress') renderProgress();
  }
}

function renderChallenge() {
  const dia = diaDoTeste();
  const desafio = desafiosSincronizados ? desafioAtivo() : null;
  const existente = desafiosSincronizados && dia >= 1 && dia <= DIAS_DO_TESTE
    ? desafiosDoDia(dia).find(d => d.origem === 'supabase') || null
    : null;
  const nivel = desafio?.nivel || existente?.nivel || nivelDesafioNovo();
  const config = desafioParaDia(dia, nivel);

  $('chTag').textContent = config.tag;
  $('chTitle').textContent = config.title;
  $('chText').textContent = config.text;
  $('chPts').textContent = '+20 pontos';
  $('chList').innerHTML = config.list.map(
    chave => `<li class="chip">${ACT[chave]}</li>`
  ).join('');

  const liberado = coletaLiberada();
  const emDia = liberado && dia >= 1 && dia <= DIAS_DO_TESTE;
  let aviso = '';
  if (!liberado) {
    aviso = textoBloqueio('desafios');
  } else if (!acessoConfirmado) {
    aviso = MSG_SEM_CONFIRMACAO;
  } else if (!desafiosSincronizados || !checkinsSincronizados) {
    aviso = 'Verificando seus registros... Aguarde ou atualize a página.';
  } else if (enviandoDesafio) {
    aviso = 'Salvando seu desafio...';
  } else if (!desafio && existente?.status === 'concluido') {
    aviso = 'Desafio concluído! Você ganhou 20 pontos.';
  } else if (!desafio && existente) {
    aviso = MSG_UM_POR_DIA;
  }

  $('desafioBloqueioTexto').textContent = aviso;
  $('desafioBloqueio').classList.toggle('hidden', !aviso);
  $('dia8Aviso').classList.toggle(
    'hidden', !(liberado && dia === DIAS_DO_TESTE + 1)
  );
  $('chNote').classList.toggle('hidden', !!desafio || !!nivelHoje());

  $('accept').textContent = desafio
    ? 'DESAFIO ACEITO'
    : existente?.status === 'concluido'
      ? 'DESAFIO CONCLUÍDO'
      : existente ? 'DESAFIO JÁ REGISTRADO' : 'ACEITAR DESAFIO';
  $('accept').classList.toggle('done', !!existente);
  $('accept').disabled = !!existente || !emDia || !acessoConfirmado ||
    !desafiosSincronizados || !checkinsSincronizados || enviandoDesafio;
  $('acceptMsg').classList.toggle('hidden', !desafio);
  $('timerBox').classList.toggle('hidden', !desafio);
  if (desafio) draw();
  atualizarBotoesTimer();
}

$('accept').addEventListener('click', async () => {
  if (enviandoDesafio) return;
  if (!coletaLiberada() || !acessoConfirmado) {
    toast(coletaLiberada() ? MSG_SEM_CONFIRMACAO : MSG_DESAFIO_BLOQUEADO);
    return;
  }
  if (!desafiosSincronizados || !checkinsSincronizados) {
    toast('Aguarde a verificação dos seus registros antes de continuar.');
    return;
  }
  const dia = diaDoTeste();
  if (dia === DIAS_DO_TESTE + 1) {
    toast(MSG_DIA8);
    return;
  }
  if (!Number.isInteger(dia) || dia < 1 || dia > DIAS_DO_TESTE) {
    toast(MSG_DESAFIO_BLOQUEADO);
    return;
  }
  if (desafiosDoDia(dia).length > 0) {
    toast(MSG_UM_POR_DIA);
    return;
  }

  enviandoDesafio = true;
  renderChallenge();
  try {
    const dados = await requisitarDesafio('aceitar');
    if (dados?.desafio?.status !== 'aceito' ||
        !aplicarDesafioRemoto(dados.desafio)) {
      throw new Error('Não foi possível confirmar seu desafio.');
    }
    desafiosSincronizados = true;
    toast('Desafio aceito e salvo! O cronômetro é opcional.');
    // Não iniciar o cronômetro automaticamente.
  } catch (erro) {
    try {
      await carregarDesafiosServidor();
    } catch {
      desafiosSincronizados = false;
    }
    if (desafiosDoDia(dia)[0]?.origem === 'supabase') {
      toast('Seu desafio já foi registrado.');
    } else {
      toast(erro.message || 'Não foi possível salvar o desafio.');
    }
  } finally {
    enviandoDesafio = false;
    renderChallenge();
  }
});

$('pause').addEventListener('click', () => {
  if (running) {
    pauseTimer();
    return;
  }
  if (!coletaLiberada() || !desafiosSincronizados) {
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
 * PROGRESSO
 */
function estatisticas() {
  let aceitos = 0;
  let concluidos = 0;
  let checkins = 0;
  let sequencia = 0;
  let maiorSequencia = 0;

  for (let dia = 1; dia <= DIAS_DO_TESTE; dia++) {
    if (checkinsSincronizados && checkinDoDia(dia)) checkins++;
    const desafios = desafiosSincronizados
      ? desafiosDoDia(dia).filter(d => d.origem === 'supabase')
      : [];
    const feitos = desafios.filter(d => d.status === 'concluido');
    aceitos += desafios.filter(
      d => d.status === 'aceito' || d.status === 'concluido'
    ).length;
    concluidos += feitos.length;
    if (feitos.length) {
      sequencia++;
      maiorSequencia = Math.max(maiorSequencia, sequencia);
    } else {
      sequencia = 0;
    }
  }
  return {
    aceitos,
    concluidos,
    checkins,
    pontos: checkins * 10 + concluidos * 20,
    sequencia: maiorSequencia
  };
}

function pctDia(dia) {
  const desafio = desafiosSincronizados
    ? desafiosDoDia(dia).find(d => d.origem === 'supabase')
    : null;
  if (desafio?.status === 'concluido') return 100;
  if (desafio?.status === 'aceito') return 75;
  if (checkinDoDia(dia)) return 50;
  return 0;
}

function renderProgress() {
  const estatistica = estatisticas();
  $('stPts').textContent = estatistica.pontos;
  $('stAcc').textContent = estatistica.aceitos;
  $('stDone').textContent = estatistica.concluidos;
  $('stStreak').textContent = estatistica.sequencia;
  $('progressoVazio').classList.toggle(
    'hidden',
    estatistica.aceitos > 0 || estatistica.checkins > 0
  );
  const dia = diaDoTeste();
  const hoje =
    dia !== null && dia >= 1
      ? Math.min(dia, DIAS_DO_TESTE)
      : 0;
  const inicio = dataInicioTeste();
  $('week').innerHTML = Array.from(
    { length: DIAS_DO_TESTE },
    (_, i) => {
      const numero = i + 1;
      const percentual = pctDia(numero);
      const data = inicio
        ? formatarDataCurta(somarDias(inicio, i))
        : 'data a definir';
      const destaque =
        numero === hoje ? 'bg-brand/5' : '';
      const rotulo =
        numero === hoje
          ? 'font-extrabold text-brand'
          : 'font-semibold';
      const apagado =
        hoje > 0 && numero > hoje
          ? 'opacity-50'
          : '';
      return `
        <div class="flex items-center gap-3 rounded-xl px-2 py-1 ${destaque} ${apagado}">
          <span class="w-24 text-sm ${rotulo}">
            Dia ${numero}
            <br>
            <span class="text-xs font-normal text-slate-500">${data}</span>
          </span>
          <div class="bar flex-1">
            <div class="fill bg-go" data-w="${percentual}"></div>
          </div>
          <span class="w-10 text-right text-sm font-bold">${percentual}%</span>
        </div>
      `;
    }
  ).join('');
  const valores = Array.from(
    { length: hoje },
    (_, i) => pctDia(i + 1)
  );
  const media = valores.length
    ? Math.round(
        valores.reduce((a, b) => a + b, 0)
        / valores.length
      )
    : 0;
  $('weekPct').textContent =
    `${media}%`;
  const falta =
    3 - (estatistica.concluidos % 3);
  $('nextText').textContent =
    `Complete mais ${falta} ${
      falta === 1 ? 'desafio' : 'desafios'
    } para desbloquear uma nova medalha.`;
  $('nextBar').style.width = '0';
  let nota =
    'Cada check-in confirmado vale 10 pontos e cada desafio concluído vale 20 pontos. Você pode conquistar até 210 pontos nos sete dias. O cronômetro é opcional.';
  if (!inicio) {
    nota +=
      ' A data oficial do teste ainda não foi definida.';
  }
  if (!acessoConfirmado) {
    nota +=
      ' Não foi possível verificar seu acesso agora. Aguarde para fazer novos registros.';
  }
  if (!desafiosSincronizados && coletaLiberada()) {
    nota += ' Estamos verificando seus desafios. A pontuação exibida pode estar incompleta.';
  }
  $('progressoNota').textContent = nota;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $$('#week .fill').forEach(elemento => {
        elemento.style.width =
          elemento.dataset.w + '%';
      });
      $('nextBar').style.width =
        ((3 - falta) / 3 * 100) + '%';
    });
  });
}
/*
 * EVENTOS FINAIS
 */
$('esperaVerificar').addEventListener(
  'click',
  async () => {
    const botao = $('esperaVerificar');
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
    const botao = $('bloqueioVerificar');
    botao.disabled = true;
    try {
      await verificarAgora();
    } finally {
      botao.disabled = false;
    }
  }
);
$('nameInput').addEventListener('input', () => {
  $('nameErr').textContent = '';
});
$('nameStep').addEventListener('submit', evento => {
  evento.preventDefault();
  enviarSolicitacao();
});
function criarNotaProgresso() {
  if ($('progressoNota')) return;
  const nota = document.createElement('p');
  nota.id = 'progressoNota';
  nota.className =
    'mt-4 text-xs text-slate-500';
  $('progress').appendChild(nota);
}
async function iniciar() {
  construirMarca();
  criarNotaProgresso();
  mostrarTela('marca');
  mostrarPassoIntro('marca');
  try {
    await iniciarCliente();
  } catch {
    mostrarFormulario(
      'Não foi possível conectar agora. Atualize a página e tente novamente.'
    );
    return;
  }
  let sessao = null;
  try {
    sessao = await sessaoLocal();
  } catch {
    sessao = null;
  }
  if (sessao) {
    carregarEstado(sessao.user.id);
    await verificarAgora();
    return;
  }
  setTimeout(() => {
    $('brandStep').classList.add('out');
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
