# Estado confirmado dos bancos — 26/10/2026

Este documento separa evidências por origem. As confirmações administrativas foram fornecidas pelo responsável, a partir da integração administrativa do ChatGPT. O Codex não as apresenta como consultas próprias e não as repete para comprovar etapas concluídas.

| Ambiente | Confirmado pela integração administrativa do ChatGPT |
| --- | --- |
| TESTE `jzxltkjxdefuptutpkfx` | 002 aplicada; RPC `registrar_tentativa_acesso(uuid)`, três triggers e visão `fairplay_pontuacao` instalados; registros preservados. Restrição de EXECUTE de `rls_auto_enable()` aplicada e validada. |
| TESTE, participante fictício `Experimento` | Cinco respostas do Dia 2 gravadas, pontuação educativa 8/10, nível alto; `D02_ALTO_ETAPAS` concluído; 30 pontos de participação na visão. |
| ORIGINAL `swbwbkslcotoecjlbqxe` | Metadados inspecionados somente em leitura. Oito tabelas iniciais, RLS ativo e índice de unicidade de sessões pendentes/aprovadas. Ausentes `solicitacoes_tentativas`, RPC `registrar_tentativa_acesso(uuid)` e visão `fairplay_pontuacao`. |

O resumo recebido não inclui todas as definições de colunas, constraints, grants, policies e event triggers do ORIGINAL. O número de tabelas e o RLS ativo não provam compatibilidade completa nem ausência de acesso por permissões herdadas. O plano utiliza o contrato conhecido da aplicação e recusa divergências, preservando tabelas adicionais. A revisão final deve aproveitar os metadados já obtidos pela integração administrativa, sem transportar dados ou exigir nova inspeção para confirmar o que já foi informado.

O Codex executou testes automatizados com serviços simulados e PostgreSQL PGlite em memória; conferiu HTTP e cenários de acesso no Vercel TESTE; revisou os textos publicados e inspecionou a apresentação com Chromium. A correção responsiva e os testes do plano ORIGINAL estão descritos em [Aceitação publicada](ACEITACAO_PUBLICADA.md) e [Implantação ORIGINAL](ORIGINAL.md).

O Codex não executou SQL hospedado nesta etapa, não acessou registros do ORIGINAL nem repetiu o fluxo de `Experimento`. Não criou bancos ou contas, reaplicou 001/002 no TESTE, copiou dados, alterou `main` ou publicou o ORIGINAL. Os projetos permanecem separados.

Para o TESTE, **não há pendência de aplicação da 002 ou da restrição de EXECUTE**. Para o ORIGINAL, há preparação para aplicação futura, condicionada à aprovação: [plano incremental](ORIGINAL.md). Login válido do gestor, solicitação/aprovação e recarga dos registros autorizados continuam sem evidência específica nesta ferramenta; o fluxo de check-in/desafio/pontos já validado não precisa ser repetido.
