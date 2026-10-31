# language: pt
Funcionalidade: Acesso seguro do participante
  Como integrante da equipe
  Quero garantir que somente a sessão aprovada acesse os registros
  Para preservar as respostas individuais

  Cenário: Mesmo navegador com sessão aprovada
    Dado que a identidade anônima do navegador está vinculada a um participante ativo
    E a sessão foi aprovada e não expirou
    Quando o participante consulta o acesso
    Então ele pode entrar no aplicativo

  Cenário: Outro navegador não herda acesso pelo nome
    Dado que existe uma sessão aprovada para um participante
    E o estudante abre o site com uma identidade anônima diferente
    Quando ele informa o mesmo primeiro nome
    Então a nova identidade não recebe acesso automaticamente
    E o aplicativo orienta a procurar a equipe para regularizar a autorização

  Cenário: Solicitação pendente
    Dado que a identidade do navegador tem uma solicitação pendente
    Quando o participante verifica o acesso
    Então o aplicativo informa que aguarda aprovação
    E não permite enviar check-ins

  Cenário: Identidade revogada
    Dado que a sessão foi revogada pelo gestor
    Quando a identidade tenta consultar o acesso
    Então o aplicativo bloqueia a participação
