# language: pt
Funcionalidade: Questionário diário do Fair Play
  Como participante aprovado
  Quero receber cinco perguntas específicas do dia oficial
  Para acompanhar meus hábitos ao longo de sete dias

  Cenário: Primeiro dia da coleta
    Dado que a coleta oficial começa em 27/10/2026 no fuso America/Fortaleza
    E que o participante possui uma sessão aprovada
    Quando ele abre o check-in em 27/10/2026
    Então o aplicativo apresenta as cinco perguntas do Dia 1
    E o servidor aceita somente os identificadores do Dia 1

  Cenário: Segundo dia mostra outro conjunto de perguntas
    Dado que a coleta oficial começa em 27/10/2026 no fuso America/Fortaleza
    E que o participante possui uma sessão aprovada
    Quando ele abre o check-in em 28/10/2026
    Então o aplicativo apresenta as cinco perguntas do Dia 2
    E as perguntas são diferentes das do Dia 1
    E o servidor aceita somente os identificadores do Dia 2

  Cenário: Virada do mês durante a coleta
    Dado que a coleta oficial começa em 27/10/2026
    Quando o participante abre o check-in em 01/11/2026
    Então o dia oficial corresponde ao Dia 6

  Cenário: Check-in no dia já respondido
    Dado que o participante já confirmou o check-in do dia atual
    Quando ele abre a seção de check-in novamente
    Então o aplicativo oferece o resultado confirmado
    E não permite duplicar o check-in
