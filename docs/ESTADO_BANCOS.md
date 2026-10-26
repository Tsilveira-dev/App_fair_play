# Estado confirmado dos bancos — 26/10/2026

Este documento separa evidências por origem. As confirmações administrativas foram fornecidas pelo responsável, a partir da integração administrativa do ChatGPT. O Codex não as apresenta como consultas próprias e não as repete para comprovar etapas concluídas.

| Ambiente | Confirmado pela integração administrativa do ChatGPT |
| --- | --- |
| TESTE `jzxltkjxdefuptutpkfx` | 002 aplicada; RPC `registrar_tentativa_acesso(uuid)`, três triggers e visão `fairplay_pontuacao` instalados; registros preservados. Restrição de EXECUTE de `rls_auto_enable()` aplicada e validada. |
| TESTE, participante fictício `Experimento` | Cinco respostas do Dia 2 gravadas, pontuação educativa 8/10, nível alto; `D02_ALTO_ETAPAS` concluído; 30 pontos de participação na visão. |
| ORIGINAL `swbwbkslcotoecjlbqxe` | `000_pre_002.sql` aplicada; `solicitacoes_tentativas` com RLS. Contratos de colunas/UNIQUEs conferidos. Preservados 3 participantes, 1 gestor e 1 sessão. Tentativa administrativa da 002 bloqueada pela segurança da ferramenta, sem confirmação de execução. Cópia parcial existente, sem backup integral restaurável de Auth/PostgreSQL. Vercel ORIGINAL não criado. |

Os contratos de colunas e índices UNIQUE foram conferidos administrativamente. O resumo recebido não contém a íntegra de grants, policies, memberships e event triggers do ORIGINAL; RLS ativo não prova ausência de acesso por permissões herdadas. O plano utiliza o contrato conhecido da aplicação e recusa divergências, preservando tabelas adicionais. A revisão final deve aproveitar os metadados já obtidos pela integração administrativa, sem transportar dados ou exigir nova inspeção para confirmar o que já foi informado.

O Codex executou testes automatizados com serviços simulados e PostgreSQL PGlite em memória; conferiu HTTP e cenários de acesso no Vercel TESTE; revisou os textos publicados e inspecionou a apresentação com Chromium. A correção responsiva e os testes do plano ORIGINAL estão descritos em [Aceitação publicada](ACEITACAO_PUBLICADA.md) e [Implantação ORIGINAL](ORIGINAL.md).

O Codex não executou SQL hospedado nesta etapa, não acessou registros do ORIGINAL nem repetiu o fluxo de `Experimento`. Não criou bancos ou contas, reaplicou 001/002 no TESTE, copiou dados, alterou `main` ou publicou o ORIGINAL. Os projetos permanecem separados.

Para o TESTE, **não há pendência de aplicação da 002 ou da restrição de EXECUTE**. No ORIGINAL, o pré-requisito 000 está concluído; não reaplicá-lo. Restam confirmação administrativa do estado da 002, recuperação restaurável e a sequência 002 → 002b → 003: [roteiro restante](ORIGINAL.md). Login válido do gestor, solicitação/aprovação e recarga dos registros autorizados continuam sem evidência específica nesta ferramenta; o fluxo de check-in/desafio/pontos já validado não precisa ser repetido.

O bloqueio administrativo da 002 foi relatado pelo responsável; não é uma recusa recebida de ferramenta nesta sessão do Codex. O Codex não tentou contorná-lo, executar SQL no ORIGINAL ou renovar credenciais. A tabela de backup da migração guarda metadados, sem substituir o backup integral ausente. A main continua inalterada.
