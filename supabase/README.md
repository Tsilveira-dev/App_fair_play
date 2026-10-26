# Migração incremental sem transportar dados

TESTE: `jzxltkjxdefuptutpkfx`. ORIGINAL: `swbwbkslcotoecjlbqxe`.

O responsável informou que o TESTE já tem tabelas, RLS, registros fictícios e UNIQUEs, incluindo `sessoes_uma_ativa_por_participante` para **pendente e aprovada**. A atualização recebida confirma que a 002 já foi aplicada com sucesso, incluindo RPC, três triggers e visão, preservando os registros. Não reaplicar 002 no TESTE e não recriar o projeto. Essas características foram reproduzidas em PostgreSQL PGlite local; o esquema hospedado não pôde ser inspecionado nesta sessão, que não dispõe de acesso administrativo ao Supabase.

**Não executar `001_schema.sql` no TESTE existente.** A baseline é exclusiva de banco vazio e não deve ser reaplicada depois da proteção 002, pois contém grants iniciais mais amplos.

| Arquivo | Uso |
| --- | --- |
| `inspecionar_esquema.sql` | Consultas somente de metadados para comparar o contrato; não consulta participantes ou respostas. |
| `migrations/001_schema.sql` | Baseline sem seeds, somente para projeto vazio e após revisão. |
| `migrations/002_protecao.sql` | Instalação incremental, atômica e repetível das proteções em esquema compatível. |
| `reverter_002.sql` | Reversão seletiva da nova 002, mantendo todas as linhas e tabelas de pesquisa. |

## Referência de instalação — não executar novamente no TESTE já protegido

1. Confirme no painel/API a referência `jzxltkjxdefuptutpkfx`. Preserve um backup administrativo e execute o relatório de metadados. Compare colunas, defaults, tipos, UNIQUEs, índices parciais, policies, grants de tabela/coluna e triggers. Use a integração administrativa já autorizada para a leitura; não renovar ou solicitar credenciais por esse procedimento.
2. A 002 verifica as colunas necessárias e recusa objetos de proteção preexistentes sem o backup da migração. Caso uma versão antiga da 002 já tenha sido instalada, pare para revisão: não apague funções ou triggers para contornar essa verificação.
3. Execute o arquivo completo em uma janela de manutenção. A transação tem limite de espera por locks e usa bloqueio para evitar aplicação/reversão simultânea. Se qualquer verificação falhar, reverta a transação; não remova registros para fazê-la passar.
4. A migração reconhece UNIQUEs equivalentes mesmo com outros nomes ou ordem de colunas. Preserva o índice que cobre pendentes e aprovadas. Se uma unicidade necessária estiver ausente, cria apenas o índice faltante e registra seu nome para reversão; duplicidades causam rollback, sem correção automática dos dados. Predicados desconhecidos no índice esperado exigem revisão.
5. As únicas gravações de instalação são metadados nas tabelas privadas `fairplay_schema_migrations` e `fairplay_migration_002_backup`. Não altera respostas, nomes, sessões ou desafios existentes, inclusive históricos expirados. A tabela de backup guarda apenas permissões, estado da migração e identificadores de objetos novos; não contém chaves ou dados dos estudantes e não é acessível pelas roles da aplicação.
6. RLS permanece ativo e grants diretos de `anon`, `authenticated` e `public`, inclusive grants por coluna, são removidos das tabelas da pesquisa. Policies preexistentes não são excluídas. A `service_role` recebe somente as operações da API: leitura de gestores/período, cadastro/edição de participantes e sessões, leitura/inserção de check-ins e leitura/inserção/atualização de desafios. Não recebe escrita em gestores/período, alteração de check-ins, acesso direto às tentativas ou ao backup.
7. Confira a existência da RPC `registrar_tentativa_acesso(uuid)`, dos três triggers e da visão `fairplay_pontuacao`. Faça a aceitação com contas fictícias no domínio Vercel TESTE antes de avançar ao ORIGINAL.

A RPC limita tentativas a 30 segundos entre solicitações, dez por UID/hora e 300 por hora no total, serializando a verificação no banco. Gera o UUID explicitamente, portanto não depende de um default na tabela existente. Não há limpeza automática das tentativas.

Os triggers verificam participante ativo, sessão aprovada/não expirada e período na mesma transação da gravação. Check-ins são definitivos. O Dia 8 só permite recuperar o check-in do Dia 7; desafios não podem ser iniciados ou concluídos nesse dia. A pontuação é derivada dos registros: dez pontos por check-in e vinte por desafio concluído.

## Reverter sem apagar os dados

Execute `reverter_002.sql` apenas no mesmo banco e em janela de manutenção, após conferir o estado `aplicada` em `fairplay_migration_002_backup`. A reversão detecta mudanças nas definições das funções, triggers e visão, e nos grants de tabela/coluna após a instalação; nesses casos, interrompe para revisão em vez de sobrescrever alterações.

Remove somente as funções, triggers, visão e eventuais índices criados por essa instalação. Restaura os grants e estados de RLS anteriores. Preserva os índices preexistentes, as tabelas de pesquisa e todas as linhas. As tabelas privadas de metadados permanecem e registram o estado `revertida`; não há exclusão de registros de controle. É possível reaplicar a nova 002 após essa reversão.

A reversão também restaura as permissões antigas, que podem ser mais amplas; suspenda o uso do aplicativo até revisar a situação. A RPC fica indisponível até a reaplicação, portanto novas solicitações devem falhar de forma segura. Não use rollback da hospedagem como substituto da revisão do banco.

## ORIGINAL

A integração administrativa confirmou `000_pre_002.sql` já aplicada no ORIGINAL, tabela de tentativas com RLS, contratos de colunas/UNIQUEs conferidos e 3 participantes/1 gestor/1 sessão preservados. A aplicação da 002 foi bloqueada sem confirmação de execução. Não reaplicar 000, não executar baseline 001 e não repetir migrações no TESTE.

O [roteiro restante](../docs/ORIGINAL.md) confirma o estado da tentativa em leitura e prepara somente `migrations/002_protecao.sql` → `original/002b_grants_visao.sql` → `original/003_verificar.sql`. O último arquivo é somente leitura; qualquer erro interrompe a sequência para revisão. A 002 original permanece inalterada e compatível com os contratos informados; sete testes PGlite modelam o plano, incluindo preservação dos vínculos/Auth fictícios. O Codex não executou SQL hospedado.

Há cópia parcial, **não um backup integral restaurável de Auth/PostgreSQL**. A tabela privada de backup da migração contém somente metadados; reversão seletiva não recupera usuários/senhas/dados perdidos. Resolver a recuperação antes da liberação definitiva. Vercel ORIGINAL não criado; merge/SQL/publicação exigem confirmação administrativa e aprovação. Não copiar contas ou dados do TESTE.

## ACL da função legada `rls_auto_enable()`

A inspeção somente de metadados está em `inspecionar_rls_auto_enable.sql`; a correção mínima está em `restringir_rls_auto_enable.sql`. Ela revoga apenas EXECUTE de PUBLIC/anon/authenticated e confere que definição e event triggers permanecem intactos. Não instala outra função ou reaplica 002. Uma assinatura diferente de `event_trigger` ou herança por outros papéis interrompe a transação. A integração administrativa confirmou que a restrição já foi aplicada e validada no TESTE; não a repetir. No ORIGINAL, considerar o ACL real antes de qualquer aplicação futura aprovada. Ver [Estado dos bancos](../docs/ESTADO_BANCOS.md) e [aceitação publicada](../docs/ACEITACAO_PUBLICADA.md).
