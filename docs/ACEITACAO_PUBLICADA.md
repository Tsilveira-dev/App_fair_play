# Aceitação no aplicativo publicado de TESTE

Alvo: `https://fairplay-teste.vercel.app`, branch `teste-supabase`. A execução inicial abaixo utilizou o código `252061e`; a revisão de mensagens está descrita ao final. O PR #1 permanece em rascunho.

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

## Aceitação positiva: execução inicial e resultado recebido

| Fluxo | Situação nesta execução |
| --- | --- |
| Login com o gestor fictício válido | Sessão de gestor não disponível para esta ferramenta; somente formulário e negativas verificados |
| Cadastrar participante e aprovar solicitação | Não executado; exige o gestor já autorizado |
| Exibir/responder questionário como estudante aprovado | O responsável confirmou cinco respostas gravadas no teste de `Experimento` |
| Gravar check-in e classificar resultado | Confirmado posteriormente pelo responsável: Dia 2, cinco respostas, 8/10, nível alto |
| Aceitar/concluir desafio e confirmar 10 + 20 pontos | Confirmado posteriormente pelo responsável: `D02_ALTO_ETAPAS` concluído e 30 pontos na visão |
| Restaurar check-ins/desafios após recarga | A sessão foi restaurada no navegador; restauração de registros autorizados ainda não verificada |
| Limites de dias e recuperação no Dia 8 | Testados localmente, sem alterar a data da coleta hospedada |

A integração administrativa utilizada no outro ChatGPT não está disponível como ferramenta nesta sessão. Não houve tentativa de renovar acessos, de obter tokens do gestor ou de contornar a autorização. A falta dessa sessão não foi classificada como falha do aplicativo.

## `rls_auto_enable()` e comparação do ORIGINAL

A exposição de EXECUTE a `anon`/`authenticated` foi informada pelo responsável. Não houve leitura administrativa do ACL ou da definição hospedada nesta execução. O relatório `supabase/inspecionar_rls_auto_enable.sql` consulta exclusivamente assinatura, hash, proprietário, grants efetivos e event triggers associados, sem invocar a função.

A correção pontual `supabase/restringir_rls_auto_enable.sql` revoga somente EXECUTE de `PUBLIC`, `anon` e `authenticated`. Revogar PUBLIC é necessário porque seus privilégios também são herdados pelos dois papéis. Não reescreve o corpo, muda proprietário/search_path, recria ou desativa event triggers, reaplica 002 ou altera dados de pesquisa. Confere o retorno `event_trigger` e preserva os hashes/associações. Assinatura inesperada ou permissão ainda herdada de outro papel causa rollback, exigindo revisão em vez de ampliar a mudança.

A correção foi preparada e validada localmente; **não foi aplicada ao TESTE hospedado nem ao ORIGINAL**. O teste PostgreSQL confirmou que CREATE TABLE por uma role sem EXECUTE continuou acionando o event trigger e habilitando RLS.

A consulta `supabase/inspecionar_esquema.sql` foi ampliada para comparar apenas metadados: colunas, constraints, índices, RLS, grants, policies, assinaturas/hashes e opções da visão. O banco ORIGINAL `swbwbkslcotoecjlbqxe` não foi consultado ou modificado. Sua comparação efetiva ainda depende da integração administrativa já autorizada, sem solicitar novas credenciais.

## Atualização de 26/10/2026 — mensagens e Progresso

O responsável informou o teste funcional bem-sucedido de **Experimento** no domínio TESTE, com confirmação pelo Supabase TESTE: check-in do Dia 2 com cinco respostas, pontuação educativa **8/10**, nível alto, desafio **D02_ALTO_ETAPAS** concluído e **30 pontos** acumulados em `fairplay_pontuacao`. É uma evidência recebida da integração administrativa do ChatGPT; esta sessão não repetiu a gravação nem leu registros desse participante. A nota 8/10 do questionário é diferente dos pontos de participação (10 pelo check-in + 20 pelo desafio).

A revisão modifica exclusivamente textos em `public/script.js` e `public/index.html`: substitui referências a Supabase, servidor, sincronização e gravação por orientações sobre registros, acesso e desafios. Mensagens de falha continuam sendo falhas; a conclusão só aparece nas mesmas condições de confirmação anteriores. Identificadores, autenticação, APIs, armazenamento, regras e catálogo foram preservados.

**Progresso de 50% confirmado como comportamento esperado:** `pctDia()` usa 0% sem atividade, 50% com check-in, 75% com desafio aceito e 100% com desafio concluído. `renderProgress()` calcula a média apenas dos dias decorridos, incluindo hoje e dias sem atividade. No Dia 2, `(0 + 100) / 2 = 50%`; não divide pelos sete dias futuros nem usa a nota educativa como percentual. A legenda foi corrigida (antes dizia 30% para desafio em andamento) e explica a média até hoje. Nenhuma fórmula foi alterada.

A inspeção gráfica usa Chromium com estados fictícios apenas em memória, **sem autenticar participante, simular sucesso de API ou escrever no Supabase**. São conferidos questionário, verificação/salvamento, desafio aceito/concluído, Progresso e cinco avisos temporários nas larguras 320, 375, 390, 768 e 1280 px. Isso avalia apresentação e textos; não representa uma nova aceitação funcional autenticada nem um teste em aparelho físico.

O rótulo do cronômetro foi encurtado para **INICIAR**, preservando sua natureza opcional, para que os controles não ultrapassem a tela. Rótulos de estatísticas foram abreviados para **desafios feitos** e **dias em série**, evitando palavras maiores que os cartões em 768 px. Os novos avisos permanecem legíveis e sem cortes nas larguras verificadas.

**Pendência de layout identificada:** o título aprovado “Responsabilidades por etapas” excede a área interna do cartão em 320/375 px e causa rolagem horizontal em 320 px. O texto do desafio e o CSS foram preservados conforme a restrição desta tarefa a mensagens da interface; o ajuste responsivo continua pendente. A inspeção não autoriza concluir que todos os títulos do catálogo cabem em qualquer dispositivo.

A validação local continua com `npm run check` (119 testes). A publicação desta revisão se restringe ao projeto Vercel TESTE; `main`, banco ORIGINAL, migrações e registros permanecem intactos. Não foram criadas novas identidades fictícias nesta revisão.
