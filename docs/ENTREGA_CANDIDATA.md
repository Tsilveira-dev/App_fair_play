# Candidata do Fair Play para revisão

Código na branch `teste-supabase`; PR #1 permanece em rascunho. Não representa liberação para pesquisa de campo.

## Evidências desta etapa

- `npm run check`: **116 testes aprovados, zero falhas, zero ignorados**, com validação de build/sintaxe.
- A migração 002 foi testada em PostgreSQL PGlite com dados fictícios históricos, grants por coluna, UNIQUEs com nomes diferentes e índice de sessões pendentes/aprovadas. Não houve cópia do banco externo.
- Verificados: preservação integral das linhas, ausência de índices redundantes, reaplicação, permissões mínimas, RPC pela `service_role` sem default de UUID, triggers, aprovação, pontos 10+20, Dia 8 e reversão/reaplicação sem apagar registros. Índice incompatível e alterações administrativas posteriores abortam com rollback.
- As suítes existentes continuam verificando autenticação, autorização, respostas, classificação, desafios, cronômetro opcional, restauração de dados na interface e identidade dos textos do catálogo recebido.
- Verificação real em `https://fairplay-teste.vercel.app`: páginas e `/api/config-public` retornaram 200; ambiente e URL TESTE confirmados; `/api/checkin` sem token retornou 401. O bloqueio de rede inicial foi resolvido após atualizar os destinos necessários no rascunho da configuração.

- Supabase Auth TESTE confirmou e-mail e usuários anônimos habilitados. Foi criada **uma identidade anônima fictícia**, marcada com `user_metadata.fairplay_validacao_autonoma=true`, exclusivamente para verificar controles. Tokens ficaram somente em memória e não foram gravados ou publicados.
- Com essa sessão não vinculada: `consultar-acesso` retornou 200, `status=sem_solicitacao`, `pode_entrar=false` e `coleta_liberada=false`; check-ins, desafios e verificação de gestor retornaram 403; listagem de participantes retornou 401. Não foi cadastrado participante nem gravado check-in/desafio por essa verificação.
- A consulta somente de metadados REST com a chave pública retornou 401. Essa chave não fornece a inspeção administrativa necessária para comparar/aplicar a migração; não foi contornada a restrição.

## Estado e limites

| Frente | Resultado |
| --- | --- |
| Arquivos e SQL incremental | Preparados e validados localmente |
| Banco TESTE hospedado | Criada somente a identidade Auth fictícia de verificação; nenhuma migração SQL aplicada; sem token/conexão administrativa |
| Fluxo completo na Vercel com gestor real de TESTE | Não executado por completo: controles públicos e de sessão anônima verificados; operações de gestor/gravação dependem da migração e do acesso administrativo/de gestor |
| Banco ORIGINAL | Não consultado nem alterado; comparação externa ainda pendente |
| Integração à main e publicação ORIGINAL | Não executadas |

## Preparação do ORIGINAL

A validação do servidor agora fixa também a referência ORIGINAL informada: `swbwbkslcotoecjlbqxe`. Exige `AMBIENTE=original`, URL ORIGINAL e `SUPABASE_ORIGINAL_URL_ESPERADA` iguais; recusa outro projeto mesmo se as duas variáveis coincidirem. As travas de branch `main` e contexto de produção continuam ativas; previews não podem usar ORIGINAL. Isso prepara o código e não altera a configuração do projeto hospedado.

A sequência após a validação do TESTE é: obter somente metadados do ORIGINAL, comparar com o contrato, revisar os ajustes aditivos necessários e apresentar a decisão de integração/publicação ao responsável. O esquema ORIGINAL ainda não foi obtido, portanto não há afirmação de compatibilidade com esse banco.

## Textos e privacidade que dependem da equipe

O questionário permanece identificado no código como rascunho 2026.1. Confirmar com o responsável/professor as 35 perguntas e alternativas, a classificação educativa e seus limiares. O catálogo diário permanece marcado como proposta: 21 atividades para os três níveis e sete neutras. Nenhum texto foi substituído nesta etapa. A confirmação acadêmica não pode ser inferida de testes automatizados.

O aplicativo utiliza UID Auth, primeiro nome, respostas, classificação, horários e estado de desafios. A chave secreta permanece no servidor e as operações dos estudantes são restritas ao próprio vínculo. O navegador mantém sessão e cache/rascunho associados ao projeto e ao UID; aparelhos compartilhados exigem orientação da equipe. Os registros oficiais ficam no Supabase correspondente.

Ainda não foi definido um prazo institucional de retenção, um procedimento de acesso/exportação ou o protocolo de encerramento da pesquisa. Não foi criada rotina de expurgo, exclusão, exportação de dados pessoais ou transferência entre bancos. A identidade fictícia criada não foi excluída, respeitando a proibição de exclusões. O responsável precisa confirmar essas decisões e o procedimento de consentimento aplicável antes da coleta.

## Operações externas ainda necessárias

1. Disponibilizar acesso administrativo seguro ao Supabase de TESTE nesta sessão, ou executar a revisão/aplicação da 002 pelo procedimento documentado, sem fornecer segredos no chat. A exigência `SUPABASE_ACCESS_TOKEN` foi registrada nas configurações seguras para a Management API; não há valor vinculado.
2. Aplicar a 002 somente após conferir o esquema e a referência TESTE; validar login do gestor, cadastro fictício, solicitação/aprovação, check-in, desafio, 30 pontos e restauração após recarga no domínio Vercel TESTE.
3. Obter metadados do ORIGINAL, confirmar datas, textos, acesso e retenção com a equipe e decidir sobre integração/publicação ORIGINAL. Nenhuma dessas decisões autoriza transportar dados fictícios.
