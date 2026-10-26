# Estado confirmado dos bancos — 26/10/2026

Este documento separa evidências por origem. As confirmações administrativas foram fornecidas pelo responsável, a partir da integração administrativa do ChatGPT. O Codex não as apresenta como consultas próprias e não as repete para comprovar etapas concluídas.

| Ambiente | Confirmado pela integração administrativa do ChatGPT |
| --- | --- |
| TESTE `jzxltkjxdefuptutpkfx` | 002 aplicada; RPC `registrar_tentativa_acesso(uuid)`, três triggers e visão `fairplay_pontuacao` instalados; registros preservados. Restrição de EXECUTE de `rls_auto_enable()` aplicada e validada. |
| TESTE, participante fictício `Experimento` | Cinco respostas do Dia 2 gravadas, pontuação educativa 8/10, nível alto; `D02_ALTO_ETAPAS` concluído; 30 pontos de participação na visão. |
| ORIGINAL `swbwbkslcotoecjlbqxe` | 002, 002b, correção de `rls_auto_enable()` e auditoria 003 concluídas/aprovadas. Login do gestor confirmado pelo responsável. Painel com 3 participantes, 1 ativo e 1 solicitação pendente. Sem check-ins/desafios; período não configurado. |

Os contratos/UNIQUEs e as proteções foram conferidos administrativamente. O PR #1 já foi integrado à main em `9ef6f8d`, e o ORIGINAL está publicado em `https://fairplay-original.vercel.app`; ambiente e referência Supabase foram confirmados pelo responsável. O Codex consultou o GitHub e confirmou merge e status de deployment ORIGINAL para esse SHA. A leitura HTTP independente do domínio está bloqueada pelo proxy desta máquina, conforme [Verificação ORIGINAL](VERIFICACAO_ORIGINAL.md).

O Codex não executou SQL hospedado, não acessou registros do ORIGINAL nem repetiu o fluxo de `Experimento` nesta etapa. Não criou contas, aprovou solicitações, configurou período, reaplicou migrações ou transferiu dados. TESTE e ORIGINAL permanecem separados.

Não há pendência de merge, publicação ORIGINAL ou aplicação de 000/001/002/002b/patch no roteiro atual. A confirmação anterior de bloqueio da tentativa da 002 foi superada pela atualização administrativa de conclusão; não repetir a tentativa. A última confirmação específica sobre backup era de cópia parcial, e a situação de recuperação deve ser esclarecida com a administração, sem inferir recuperação integral a partir da auditoria.

Restam autorizações, calendário, elegibilidade/ativação/aprovação dos participantes e a aceitação do uso autorizado antes da coleta. O login do gestor ORIGINAL e os 30 pontos do TESTE são etapas concluídas; a participação dos estudantes e os resultados da pesquisa não foram confirmados. Seguir [Operação da coleta](OPERACAO_COLETA.md).
