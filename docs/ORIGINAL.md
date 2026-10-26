# ORIGINAL publicado — operação e estado atual

PR #1 integrado à `main` em **9ef6f8d**. Vercel ORIGINAL: **https://fairplay-original.vercel.app**. Supabase ORIGINAL: **swbwbkslcotoecjlbqxe**. A implantação foi concluída pelo responsável; os roteiros anteriores de instalação são históricos e não devem ser reaplicados.

A integração administrativa confirmou 002, 002b, correção de `rls_auto_enable()` e auditoria 003 concluídas/aprovadas. O responsável confirmou login do gestor, três participantes (um ativo), uma solicitação pendente, ausência de check-ins/desafios e de período de coleta. Não refazer migrações, recriar projetos/gestor, importar o TESTE ou aprovar a pendência automaticamente.

A confirmação independente e seus limites estão em [Verificação ORIGINAL](VERIFICACAO_ORIGINAL.md). O GitHub confirma o deployment do projeto ORIGINAL para o commit integrado; a leitura HTTP do domínio pelo Codex está bloqueada pelo proxy da máquina. A comparação dos arquivos publicados, a conferência externa das nove APIs e a ausência de segredos nas respostas permanecem pendentes nessa máquina, sem indicar falha confirmada do aplicativo.

## Para iniciar a pesquisa, sem nova implantação

Seguir [Operação da coleta — 29/10 a 04/11](OPERACAO_COLETA.md): obter as autorizações aplicáveis, conferir cadastros e recuperação, aprovar o calendário e só então configurar o período, orientar solicitações e autorizar os acessos corretos. O gestor já existe e já entrou; não solicitar suas credenciais ou criar contas fictícias para testar o ORIGINAL.

Sem período válido/ativo, o aplicativo bloqueia aprovações e registros. Os sete dias previstos são 29/10 a 04/11; o código preserva 05/11 somente para recuperar o check-in do Dia 7. A equipe precisa definir a utilização dessa janela no protocolo. Nenhuma alteração de calendário ou ativação foi feita pelo Codex.

## Referência de configuração — preservar, não recriar

Vercel ORIGINAL separado do TESTE, Production Branch `main`, raiz `.`, Other, Node24, instalação `npm ci`, build `npm run build`, saída `public`. Variáveis exclusivas de Production:

| Variável | Valor configurado esperado |
| --- | --- |
| `AMBIENTE` | `original` |
| `SUPABASE_URL` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_ORIGINAL_URL_ESPERADA` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do ORIGINAL |
| `SUPABASE_SECRET_KEY` | Segredo do ORIGINAL, somente servidor |

Não promover credenciais para Preview/Development, copiá-las do TESTE ou publicá-las em Git/chat. Não modificar a configuração atual para repetir uma implantação já confirmada. `npm run verificar:deploy` permanece restrito ao TESTE; a conferência ORIGINAL é somente de leitura/negativas sem sessão, conforme o relatório.

## Manutenção e recuperação

Qualquer falha de código confirmada deve ser corrigida em **nova branch a partir da main**, com testes e novo PR, nunca diretamente na `main`. A revisão atual usa `docs/preparacao-coleta-2026-10` apenas para documentação; nenhum código do aplicativo precisou ser corrigido.

A última informação específica sobre recuperação era de cópia parcial, sem backup integral restaurável de Auth/PostgreSQL. A auditoria aprovada não confirma automaticamente atualização desse backup: a administração deve esclarecer a abrangência e o procedimento de recuperação antes da coleta, preservando UIDs/vínculos e a guarda dos dados. `fairplay_migration_002_backup` contém somente metadados, e reversão da migração não restaura contas/dados perdidos. Não executar reversões ou restaurações como parte deste checklist.
