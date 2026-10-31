# language: pt
Funcionalidade: Persistência de check-ins e pontuação
  Como participante
  Quero que meus registros confirmados persistam
  Para continuar a atividade sem perder progresso

  Cenário: Confirmação do check-in
    Dado que o participante foi aprovado
    E respondeu as cinco perguntas válidas do dia oficial
    Quando envia o check-in
    Então o servidor grava um único check-in
    E contabiliza 10 pontos de participação

  Cenário: Recarregar o aplicativo
    Dado que o servidor confirmou um check-in
    Quando o participante atualiza a página no mesmo navegador
    Então o aplicativo recupera o check-in confirmado
    E não adiciona pontos novamente

  Cenário: Envio repetido
    Dado que o dia atual já tem um check-in confirmado
    Quando ocorre outra tentativa de envio para o mesmo dia
    Então o servidor impede duplicidade

  Cenário: Pontos do desafio
    Dado que um desafio foi aceito
    Quando o cronômetro chega a zero sem confirmação de conclusão
    Então nenhum ponto de conclusão é concedido
    Quando o servidor confirma a conclusão do desafio
    Então são contabilizados 20 pontos adicionais uma única vez
