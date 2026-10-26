# Plano de implantação ORIGINAL — preparado, não executado

Alvo exclusivo futuro: Supabase `swbwbkslcotoecjlbqxe`, Vercel ORIGINAL separado, branch `main`. O PR #1 continua em rascunho na `teste-supabase`. Este plano não autoriza execução SQL, integração ou publicação. Prazo acadêmico estimado informado: 09/11/2026.

## Base da preparação

O [estado dos bancos](ESTADO_BANCOS.md) registra a inspeção somente de metadados confirmada pela integração administrativa: ORIGINAL com oito tabelas, RLS ativo e UNIQUE de sessões pendentes/aprovadas; faltam tabela de tentativas, RPC e visão. Não executar a baseline 001 nesse banco existente. Não copiar contas, sessões, participantes, respostas ou desafios do TESTE.

O plano reutiliza a 002 existente, sem criar uma segunda implementação das proteções. A íntegra dos metadados administrativos não foi recebida neste checkout; conferir tipos, constraints, nomes de índices, grants e event triggers com esse relatório antes de executar o plano. Não remover objetos/registros para fazê-lo passar. Os testes locais modelam somente as características informadas e não provam identidade com o banco hospedado.

## Sequência SQL após aprovação explícita

1. Confirmar no painel a referência **swbwbkslcotoecjlbqxe**, guardar backup administrativo do ORIGINAL e reservar janela de manutenção. Manter aplicativo ORIGINAL sem entradas novas. SQL não identifica com segurança a URL do projeto; a confirmação do alvo deve ocorrer na conexão/painel administrativo.
2. Revisar os metadados já coletados com o contrato da 002. Os relatórios [inspecionar_esquema.sql](../supabase/inspecionar_esquema.sql) e [inspecionar_rls_auto_enable.sql](../supabase/inspecionar_rls_auto_enable.sql) são referências somente de leitura; não exigem refazer a inspeção já confirmada. Registrar antes da instalação os nomes/definições dos índices, ACLs por tabela/coluna, memberships, policies e definição/hash/estado dos event triggers. As tabelas adicionais entre as oito originais ficam intactas e exigem revisão própria de exposição; o plano não inventa seu contrato.
3. Executar [original/000_pre_002.sql](../supabase/original/000_pre_002.sql) **no ORIGINAL, após aprovação**. Cria somente `solicitacoes_tentativas` com UUID, FK para `auth.users`, data e dois índices de consulta. Habilita RLS e remove grants diretos inclusive por coluna de PUBLIC/anon/authenticated/service_role. Não insere tentativas ou usuários. Recusa tabelas obrigatórias sem RLS, índice de sessões não reconhecido, contrato de tentativas divergente ou índice homônimo incompatível. Preserva o UNIQUE pendente/aprovada e todas as tabelas/registros existentes. É repetível apenas antes da proteção; recusa RPC/visão já instaladas.
4. Executar a íntegra de [migrations/002_protecao.sql](../supabase/migrations/002_protecao.sql), sem editar/remontar sua implementação e sem executar 001. Cria RPC, três triggers de linhas, visão e metadados privados da migração; aplica grants mínimos; reconhece UNIQUEs equivalentes e preserva o índice pendente/aprovada. Constraints/colunas divergentes ou objetos de proteção anteriores sem backup compatível interrompem a transação. Não atualiza linhas da pesquisa.
5. Executar [original/002b_grants_visao.sql](../supabase/original/002b_grants_visao.sql). Limita os grants diretos da visão, inclusive por coluna, a SELECT para service_role. É necessário considerar defaults amplos do projeto: CREATE VIEW pode herdar INSERT/UPDATE/DELETE para service_role, e a 002 não os revoga dessa visão. O teste isolado reproduziu essa condição. Não modifica a definição da visão, dados ou default privileges globais.
6. Revisar a função legada `rls_auto_enable()` e os event triggers do **ORIGINAL** pelos metadados recebidos. A restrição aplicada no TESTE não prova o ACL do ORIGINAL. Se houver EXECUTE público indevido e a assinatura for `event_trigger`, submeter a aplicação de [restringir_rls_auto_enable.sql](../supabase/restringir_rls_auto_enable.sql) à aprovação dessa instalação. O patch altera somente EXECUTE; preserva corpo, proprietário, associações e finalidade. Se a função não existir ou já estiver restrita, não criá-la nem repetir a correção por rotina. Assinatura/herança inesperada exige revisão, sem recriar/desabilitar event triggers. Não mudar default privileges globais indiscriminadamente.
7. Executar [original/003_verificar.sql](../supabase/original/003_verificar.sql), **somente leitura**. Confere estado da 002, RLS, ausência de permissões públicas efetivas (incluindo grants herdados/por coluna), grants da service_role, RPC exclusiva, visão `security_invoker`, três triggers habilitados e ACL da função legada, quando existir. Lista grants e hashes/estado dos event triggers para comparar com os metadados anteriores; não consulta participantes, Auth ou respostas. Comparar também os índices com o relatório anterior: nenhum enfraquecimento ou duplicação do UNIQUE existente.

Cada arquivo usa sua própria transação com rollback em erro; os limites de espera da instalação são 5 s para locks e 30 s por comando. **A sequência inteira não é uma única transação.** Se a 002 falhar após a etapa 3, a tabela de tentativas permanece protegida, sem grants diretos; não publicar, não excluí-la e revisar o erro. Em erro no SQL Editor, executar `ROLLBACK` antes de outra tentativa. As verificações finais recusam permissões herdadas inesperadas sem revogar papéis externos automaticamente.

Se for necessário reverter a proteção após decisão administrativa, [reverter_002.sql](../supabase/reverter_002.sql) preserva os registros e restaura ACL/RLS anteriores, podendo restaurar privilégios mais amplos. Manter o serviço suspenso até revisão. Não apaga a nova tabela de tentativas nem reverte automaticamente o patch independente de `rls_auto_enable()`. Não usar restauração do TESTE como rollback do ORIGINAL.

## Grants esperados depois da 002

PUBLIC, anon e authenticated não recebem acesso direto às tabelas da pesquisa ou à visão. O navegador usa apenas as APIs autenticadas.

| Objeto | Privilégios da service_role |
| --- | --- |
| `gestores`, `configuracao_teste` | SELECT |
| `participantes`, `sessoes_participantes` | SELECT, INSERT, UPDATE |
| `checkins` | SELECT, INSERT |
| `desafios_registros` | SELECT, INSERT, UPDATE |
| `solicitacoes_tentativas` | Nenhum; somente RPC `registrar_tentativa_acesso(uuid)` |
| `fairplay_pontuacao` | SELECT |
| Metadados privados da migração | Nenhum |

Nenhuma operação da aplicação necessita DELETE/TRUNCATE. Policies preexistentes não são excluídas. Grants de tabelas adicionais, funções legadas e permissões herdadas devem ser revisados pelo administrador, sem ampliação automática de acesso.

## Configuração Vercel ORIGINAL após autorização

Utilizar um projeto Vercel separado do `fairplay-teste`, ligado ao mesmo repositório. Não executar a importação/configuração agora: a criação do projeto pode disparar um deployment. Se já existir um projeto ORIGINAL, revisar esse projeto em vez de criar duplicata. Liberar o deploy somente depois da revisão do PR, autorização de integração à `main`, aplicação aprovada do plano SQL e validação acadêmica.

| Campo | Valor |
| --- | --- |
| Production Branch | `main` |
| Framework | Other |
| Root Directory | Raiz do repositório (`.`), não `public` |
| Node.js | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `public` |

Configurar exclusivamente no escopo **Production** do projeto ORIGINAL:

| Variável | Valor |
| --- | --- |
| `AMBIENTE` | `original` |
| `SUPABASE_URL` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_ORIGINAL_URL_ESPERADA` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do ORIGINAL |
| `SUPABASE_SECRET_KEY` | Chave secreta do ORIGINAL, sensível, somente servidor |

Não preencher Preview/Development com credenciais ORIGINAL, não copiar valores do TESTE e não sobrescrever `VERCEL_ENV`/`VERCEL_GIT_COMMIT_REF`. Previews do projeto ORIGINAL devem permanecer desabilitados ou sem credenciais; a API recusa ORIGINAL fora de produção/main. Não disparar previews para tentar testar o ORIGINAL. Não publicar segredos no Git, em `public`, no chat ou em variáveis `VITE_`/`NEXT_PUBLIC_`.

No Supabase ORIGINAL, revisar Auth por e-mail/senha para o gestor e autenticação anônima para estudantes; criar o gestor real apenas se ainda necessário e cadastrar seu UID em `gestores` administrativamente. Não copiar contas de TESTE. Configurar Site URL/redirects do domínio ORIGINAL e definir o período real de sete dias em `configuracao_teste` somente após liberação da equipe. O nome histórico dessa tabela não indica compartilhamento entre bancos.

## Checklist mínimo de liberação definitiva

- [ ] Validar com a equipe as perguntas/desafios já preservados, datas, consentimento, uso em aparelhos compartilhados e retenção.
- [ ] Completar as evidências ainda ausentes de gestor/aprovação/recarga no TESTE; considerar o fluxo de `Experimento` já validado.
- [ ] Aprovar o PR #1 e autorizar separadamente integração à `main`, execução SQL no ORIGINAL e publicação ORIGINAL.
- [ ] Confirmar alvo/backup, revisar metadados e executar o plano incremental aprovado; verificar grants, índices e event triggers, sem transferir dados.
- [ ] Configurar Vercel ORIGINAL como acima e Auth/período/gestor reais; publicar somente o commit aprovado de `main`.
- [ ] Conferir `/api/config-public`: 200, `ambiente=original`, URL ORIGINAL e ausência de segredo; `/api/checkin` sem sessão deve retornar 401. **Não usar `npm run verificar:deploy` para ORIGINAL:** esse comando aceita somente TESTE por segurança.
- [ ] Com a equipe, confirmar login, solicitação/aprovação, cinco respostas, desafio manual, 10+20 pontos e recarga no procedimento autorizado de aceitação ORIGINAL, antes de liberar a coleta. Não importar participantes/contas fictícias nem abrir coleta antes dessa aceitação.
