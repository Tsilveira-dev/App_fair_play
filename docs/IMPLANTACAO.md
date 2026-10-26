# Implantação concluída — referência de manutenção

O PR #1 foi integrado à `main` em `9ef6f8d`. O ORIGINAL está publicado em https://fairplay-original.vercel.app, separado do TESTE https://fairplay-teste.vercel.app. A integração administrativa confirmou as migrações/proteções e o responsável confirmou o login do gestor ORIGINAL. Não criar outro projeto, refazer migrações ou reimplantar para repetir tarefas concluídas.

- [Estado dos bancos](ESTADO_BANCOS.md): confirmações administrativas e origem das evidências.
- [Verificação ORIGINAL](VERIFICACAO_ORIGINAL.md): revisão independente, contratos das nove APIs, layout e bloqueio de rede ainda pendente no Codex.
- [Operação de 29/10 a 04/11](OPERACAO_COLETA.md): autorizações, cadastro, calendário, acessos, acompanhamento e encerramento; datas não aplicadas automaticamente.
- [Configuração ORIGINAL](ORIGINAL.md): referência dos parâmetros já utilizados, sem comandos de reinstalação.
- [VS Code/TESTE](VS_CODE_VERCEL.md): desenvolvimento local e comandos exclusivos do TESTE.

A pasta de saída continua `public`; a raiz inclui `api`. Node24, `npm ci` e `npm run check` permanecem o fluxo de validação. Os handlers e a separação dos bancos não mudaram. Segredos ficam somente no servidor, e o ORIGINAL não deve fornecer credenciais a previews.

Alterações futuras devem partir da main em nova branch e PR, sem commits diretos na produção. Não transportar contas/dados do TESTE. Nenhum procedimento de publicação autoriza por si alterar calendário, ativar coleta ou aprovar participantes sem a autorização institucional e dos responsáveis aplicável.
