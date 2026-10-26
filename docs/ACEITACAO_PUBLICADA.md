# Aceitação no aplicativo publicado de TESTE

Alvo: `https://fairplay-teste.vercel.app`, código `252061e` da branch `teste-supabase`. O PR #1 permanece em rascunho.

## Estado administrativo recebido

O responsável confirmou que a integração administrativa aplicou a 002 em `jzxltkjxdefuptutpkfx`: migração registrada como `aplicada`, RPC, três triggers e visão de pontuação instalados, registros preservados, um gestor e uma sessão aprovada ativa. **Não reaplicar 002 ou 001, não recriar o projeto e não solicitar novas credenciais.** Esta confirmação é distinta das consultas realizadas nesta sessão.

## Execução real, com Chromium

Foram executados nove cenários contra o aplicativo publicado, com o HTML/JavaScript originais. Não houve respostas de API simuladas nem liberação artificial de acesso. O transporte de requisições do Playwright usou APIRequestContext com a CA já confiável no Node, mantendo a validação TLS. Isso resolveu a rejeição inicial da CA do proxy pelo Chromium, sem desativar a verificação de certificados.

| Cenário | Resultado observado |
| --- | --- |
| Página do estudante | HTTP 200, formulário visível e habilitado |
| Configuração pública | Ambiente `teste`, referência `jzxltkjxdefuptutpkfx` |
| Catálogo publicado | Sete dias, cinco perguntas por dia; sete conjuntos de desafios |
| Nome vazio ou composto | Recusado pela interface antes de criar identidade |
| Solicitação com nome fictício não cadastrado | HTTP 202; consulta retorna `sem_solicitacao`, entrada e coleta bloqueadas |
| Reenvio imediato | HTTP 429, com `Retry-After` positivo dentro da janela de 30 segundos |
| APIs com essa sessão sem autorização | Check-in, desafio e verificação de gestor: 403; listagem de participantes: 401 |
| Recarga da página | Mesmo UID restaurado, sem nova identidade, mantendo entrada/coleta bloqueadas |
| Painel do gestor | Não herdou a sessão do estudante; exibiu login; e-mail/senha vazios recusados |

Resultado final: **9 cenários aprovados, nenhum erro JavaScript ou falha de rede durante a execução final**. Foi criada uma identidade anônima fictícia pela própria interface e exercitado o registro de tentativa pela RPC. O nome aleatório não recebeu vínculo de participante. Não foi utilizada ou modificada a sessão aprovada existente. Não foram enviados check-ins ou desafios, nem excluídos registros. Não foram exportados tokens, senhas ou estado de sessão.

Também foram conferidos por HTTP os bloqueios sem autenticação: check-in, desafio e verificação de gestor responderam 401.

## Aceitação positiva ainda não executada

| Fluxo | Situação nesta execução |
| --- | --- |
| Login com o gestor fictício válido | Sessão de gestor não disponível para esta ferramenta; somente formulário e negativas verificados |
| Cadastrar participante e aprovar solicitação | Não executado; exige o gestor já autorizado |
| Exibir/responder questionário como estudante aprovado | Catálogo conferido; envio autorizado não executado |
| Gravar check-in e classificar resultado | Testado nas suítes locais; não confirmado em gravação publicada nesta execução |
| Aceitar/concluir desafio e confirmar 10 + 20 pontos | Testado nas suítes locais; não confirmado no fluxo publicado |
| Restaurar check-ins/desafios após recarga | A sessão foi restaurada no navegador; restauração de registros autorizados ainda não verificada |
| Limites de dias e recuperação no Dia 8 | Testados localmente, sem alterar a data da coleta hospedada |

A integração administrativa utilizada no outro ChatGPT não está disponível como ferramenta nesta sessão. Não houve tentativa de renovar acessos, de obter tokens do gestor ou de contornar a autorização. A falta dessa sessão não foi classificada como falha do aplicativo.

## `rls_auto_enable()` e comparação do ORIGINAL

A exposição de EXECUTE a `anon`/`authenticated` foi informada pelo responsável. Não houve leitura administrativa do ACL ou da definição hospedada nesta execução. O relatório `supabase/inspecionar_rls_auto_enable.sql` consulta exclusivamente assinatura, hash, proprietário, grants efetivos e event triggers associados, sem invocar a função.

A correção pontual `supabase/restringir_rls_auto_enable.sql` revoga somente EXECUTE de `PUBLIC`, `anon` e `authenticated`. Revogar PUBLIC é necessário porque seus privilégios também são herdados pelos dois papéis. Não reescreve o corpo, muda proprietário/search_path, recria ou desativa event triggers, reaplica 002 ou altera dados de pesquisa. Confere o retorno `event_trigger` e preserva os hashes/associações. Assinatura inesperada ou permissão ainda herdada de outro papel causa rollback, exigindo revisão em vez de ampliar a mudança.

A correção foi preparada e validada localmente; **não foi aplicada ao TESTE hospedado nem ao ORIGINAL**. O teste PostgreSQL confirmou que CREATE TABLE por uma role sem EXECUTE continuou acionando o event trigger e habilitando RLS.

A consulta `supabase/inspecionar_esquema.sql` foi ampliada para comparar apenas metadados: colunas, constraints, índices, RLS, grants, policies, assinaturas/hashes e opções da visão. O banco ORIGINAL `swbwbkslcotoecjlbqxe` não foi consultado ou modificado. Sua comparação efetiva ainda depende da integração administrativa já autorizada, sem solicitar novas credenciais.
