# Candidata do Fair Play para revisão

Código na branch `teste-supabase`; PR #1 permanece em rascunho. Não representa liberação para pesquisa de campo.

## Evidências desta etapa

- `npm run check`: **119 testes aprovados, zero falhas, zero ignorados**, com validação de build/sintaxe.
- A migração 002 foi testada em PostgreSQL PGlite com dados fictícios históricos, grants por coluna, UNIQUEs com nomes diferentes e índice de sessões pendentes/aprovadas. Não houve cópia do banco externo.
- Verificados: preservação integral das linhas, ausência de índices redundantes, reaplicação, permissões mínimas, RPC pela `service_role` sem default de UUID, triggers, aprovação, pontos 10+20, Dia 8 e reversão/reaplicação sem apagar registros. Índice incompatível e alterações administrativas posteriores abortam com rollback.
- As suítes existentes continuam verificando autenticação, autorização, respostas, classificação, desafios, cronômetro opcional, restauração de dados na interface e identidade dos textos do catálogo recebido.
- Verificação real em `https://fairplay-teste.vercel.app`: páginas e `/api/config-public` retornaram 200; ambiente e URL TESTE confirmados; `/api/checkin` sem token retornou 401. O bloqueio de rede inicial foi resolvido após atualizar os destinos necessários no rascunho da configuração.

- Supabase Auth TESTE confirmou e-mail e usuários anônimos habilitados. Na etapa anterior foi criada **uma identidade anônima fictícia**, marcada com `user_metadata.fairplay_validacao_autonoma=true`, exclusivamente para verificar controles. Tokens ficaram somente em memória e não foram gravados ou publicados.
- Com essa sessão não vinculada: `consultar-acesso` retornou 200, `status=sem_solicitacao`, `pode_entrar=false` e `coleta_liberada=false`; check-ins, desafios e verificação de gestor retornaram 403; listagem de participantes retornou 401. Não foi cadastrado participante nem gravado check-in/desafio por essa verificação.
- A consulta somente de metadados REST com a chave pública retornou 401. Essa chave não fornece a inspeção administrativa necessária para comparar/aplicar a migração; não foi contornada a restrição.

## Estado atual de aceitação

O responsável confirmou a 002 **já aplicada** no TESTE, com RPC, três triggers, visão, registros preservados, um gestor e uma sessão aprovada ativa. Não reaplicar a migração, não recriar o projeto e não solicitar credenciais novamente.

A etapa seguinte executou nove cenários reais em Chromium no aplicativo publicado: formulário, catálogo 7×5, solicitação fictícia 202, limite de reenvio 429, bloqueios de autorização e restauração da mesma sessão após recarga. O login válido de gestor continua não executado nesta ferramenta. Posteriormente, o responsável confirmou a aceitação positiva de `Experimento`: cinco respostas no Dia 2, 8/10, nível alto, `D02_ALTO_ETAPAS` concluído e 30 pontos na visão do TESTE. A evidência foi recebida do ChatGPT administrativo e não repetida nesta sessão. A correção de ACL de `rls_auto_enable()` foi preparada, sem aplicação hospedada. Evidências e limites completos em [Aceitação publicada](ACEITACAO_PUBLICADA.md).

A comparação administrativa dos metadados ORIGINAL não foi executada nesta sessão. A main e o ORIGINAL permanecem sem alterações.

## Preparação do ORIGINAL

A validação do servidor agora fixa também a referência ORIGINAL informada: `swbwbkslcotoecjlbqxe`. Exige `AMBIENTE=original`, URL ORIGINAL e `SUPABASE_ORIGINAL_URL_ESPERADA` iguais; recusa outro projeto mesmo se as duas variáveis coincidirem. As travas de branch `main` e contexto de produção continuam ativas; previews não podem usar ORIGINAL. Isso prepara o código e não altera a configuração do projeto hospedado.

A sequência após a validação do TESTE é: obter somente metadados do ORIGINAL, comparar com o contrato, revisar os ajustes aditivos necessários e apresentar a decisão de integração/publicação ao responsável. O esquema ORIGINAL ainda não foi obtido, portanto não há afirmação de compatibilidade com esse banco.

## Textos e privacidade que dependem da equipe

O questionário permanece identificado no código como rascunho 2026.1. Confirmar com o responsável/professor as 35 perguntas e alternativas, a classificação educativa e seus limiares. O catálogo diário permanece marcado como proposta: 21 atividades para os três níveis e sete neutras. Nenhum texto foi substituído nesta etapa. A confirmação acadêmica não pode ser inferida de testes automatizados.

O aplicativo utiliza UID Auth, primeiro nome, respostas, classificação, horários e estado de desafios. A chave secreta permanece no servidor e as operações dos estudantes são restritas ao próprio vínculo. O navegador mantém sessão e cache/rascunho associados ao projeto e ao UID; aparelhos compartilhados exigem orientação da equipe. Os registros oficiais ficam no Supabase correspondente.

Ainda não foi definido um prazo institucional de retenção, um procedimento de acesso/exportação ou o protocolo de encerramento da pesquisa. Não foi criada rotina de expurgo, exclusão, exportação de dados pessoais ou transferência entre bancos. A identidade fictícia criada não foi excluída, respeitando a proibição de exclusões. O responsável precisa confirmar essas decisões e o procedimento de consentimento aplicável antes da coleta.

## Pendências finais

1. Completar as evidências ainda ausentes de login válido do gestor, solicitação/aprovação e restauração dos registros autorizados após recarga. Check-in, classificação, desafio e 30 pontos de `Experimento` já foram confirmados pelo responsável; não repetir gravações para comprovar o que já foi validado. Revisar o título de desafio que ultrapassa a área interna em 320/375 px, sem substituir seu texto aprovado.
2. Pela integração administrativa já autorizada, conferir metadados/ACL de `rls_auto_enable()` e avaliar a correção pontual, sem reaplicar 002; comparar exclusivamente metadados do ORIGINAL.
3. Validar textos, datas, consentimento, retenção e a aceitação final antes de decidir sobre main e publicação ORIGINAL. Não transferir dados do TESTE.
