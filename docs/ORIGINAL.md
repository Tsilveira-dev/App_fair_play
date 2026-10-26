# Liberação ORIGINAL — roteiro restante, sem execução pelo Codex

Alvo: Supabase **swbwbkslcotoecjlbqxe**, futuro projeto Vercel ORIGINAL separado, branch `main`. PR #1 em rascunho na `teste-supabase`. Este documento prepara a operação; não autoriza SQL, merge ou publicação. Prazo acadêmico estimado informado: 09/11/2026.

## O que já está concluído

A integração administrativa confirmou `000_pre_002.sql` aplicada, `solicitacoes_tentativas` existente com RLS, contratos de colunas/UNIQUEs conferidos e preservação de **3 participantes, 1 gestor e 1 sessão**. **Não executar novamente 000, 001 ou migrações no TESTE.** O bloqueio da tentativa administrativa da 002 não confirma nem execução nem ausência de execução; seu estado precisa ser confirmado antes de uma nova tentativa. O Vercel ORIGINAL ainda não existe.

A revisão do Codex mantém a **002 compatível com esse estado informado**, sem modificar seu conteúdo: o pré-requisito está presente; UNIQUEs equivalentes são reutilizados, inclusive pendente/aprovada; os registros existentes não são atualizados; `auth.users` é consultada pelas proteções, sem alteração do esquema ou das contas Auth. A validação final hospedada continua necessária. Um teste PGlite reproduz 000 já aplicada e 3 participantes/1 gestor/1 sessão, compara integralmente registros fictícios de Auth/identidades/sessões e vínculos antes/depois de **002 → 002b → 003**, inclusive uma sessão expirada sem renová-la.

## Antes de executar: riscos ainda não resolvidos

- Existe **cópia parcial**, não um backup integral restaurável de Auth/PostgreSQL. A liberação segura depende de confirmar um mecanismo de recuperação que preserve UIDs, vínculos, dados, esquema, roles/grants e configuração necessária do Auth, com acesso administrativo protegido. Não exportar senhas, hashes ou tokens para Git/chat. A existência de um arquivo ou contagens iguais não prova restauração. Não criar outro banco ou restaurar sobre o ORIGINAL nesta etapa.
- `fairplay_migration_002_backup` guarda **somente metadados de permissões/objetos**. Não contém participantes, usuários Auth, senhas ou sessões e não recupera dados perdidos. `reverter_002.sql` é reversão seletiva de proteção, não backup integral; pode restaurar permissões mais amplas. Tokens/sessões podem exigir nova autenticação em uma recuperação, mesmo preservando UIDs. Não é possível garantir a recuperação integral com a cópia parcial atual.
- A 002 é transacional, mas **002, 002b e 003 são transações separadas**. Uma falha posterior não desfaz uma 002 já confirmada. As novas restrições podem interromper clientes antigos que acessam tabelas diretamente; manter entradas suspensas até validar a API. Nunca conceder acesso público para contornar erro.
- Grants herdados, tabelas adicionais e ACL/event triggers legados precisam estar coerentes com a revisão administrativa. A correção de `rls_auto_enable()` no TESTE não comprova o estado do ORIGINAL. Se 003 denunciar sua exposição, parar para revisão administrativa; não adicionar outra migração por tentativa nem reescrever/desabilitar event triggers.

## SQL Editor — somente após verificação e autorização administrativas

Usar o SQL Editor do projeto **swbwbkslcotoecjlbqxe**, papel administrativo, sem entradas concorrentes. Usar os arquivos da revisão aprovada do PR, executar **todo o conteúdo de um arquivo por vez**, sem selecionar apenas trechos ou juntar os três em uma transação externa.

1. **Confirmar o estado da tentativa anterior, somente leitura.** Uma consulta basta para o caso normal:

```sql
begin transaction read only;
select to_regclass('public.fairplay_migration_002_backup') as controle_002,
  to_regprocedure('public.registrar_tentativa_acesso(uuid)') as rpc,
  to_regclass('public.fairplay_pontuacao') as visao,
  (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and t.tgname in ('fairplay_checkin_protegido','fairplay_desafio_protegido','fairplay_aprovacao_protegida')) as triggers_002,
  (select count(*) from public.participantes) as participantes,
  (select count(*) from public.gestores) as gestores,
  (select count(*) from public.sessoes_participantes) as sessoes;
commit;
```

   Se controle/RPC/visão forem nulos, triggers=0 e contagens=3/1/1, seguir. Se houver objetos, **não repetir 002 automaticamente**: quando o controle existir, consultar `select estado from public.fairplay_migration_002_backup where id=1;`. Somente com estado `aplicada` e confirmação administrativa dos objetos pode-se pular a 002 e seguir à 002b. Estado ausente/incompleto, objetos sem controle ou contagens divergentes exigem revisão. Não apagar objetos ou registros para liberar a execução.

2. **Executar [002_protecao.sql](../supabase/migrations/002_protecao.sql)**, se a etapa anterior confirmar que não foi aplicada. Aguardar sucesso de todo o arquivo. Confirmar com `select estado from public.fairplay_migration_002_backup where id=1;`: deve retornar **aplicada**. A transação inclui RPC, três triggers, visão e grants mínimos, sem alterar dados históricos/Auth. Não tomar a mensagem da ferramenta anterior como confirmação de instalação.
3. **Executar [002b_grants_visao.sql](../supabase/original/002b_grants_visao.sql)**, após 002 confirmada. Deve terminar sem erro. Limita a visão a SELECT para service_role, inclusive diante de defaults amplos; não altera a definição da visão, dados ou permissões globais. Verificação curta: `select has_table_privilege('service_role','public.fairplay_pontuacao','SELECT') as leitura, has_table_privilege('service_role','public.fairplay_pontuacao','INSERT,UPDATE,DELETE') as escrita;` deve retornar **true/false**.
4. **Executar [003_verificar.sql](../supabase/original/003_verificar.sql)**, somente leitura. Deve terminar sem exceção, com grants mínimos e event triggers disponíveis para comparação com o relatório administrativo. Confere RLS, privilégios efetivos/por coluna, RPC exclusiva, visão `security_invoker`, três triggers e ACL da função legada, se existir. Confirmar novamente as contagens **3/1/1**, sem refazer gravações ou expor nomes; aproveitar o relatório de UNIQUEs já conferido. As contagens são uma conferência mínima de preservação, não substituem backup nem provam integridade de Auth.

**Em qualquer erro:** parar, guardar somente mensagem/etapa sem dados pessoais e executar `ROLLBACK;` se a conexão permanecer em transação abortada. Não seguir ao próximo arquivo, não aumentar grants, desabilitar triggers ou remover índices/linhas. Se o erro ocorrer antes do COMMIT da 002, suas alterações transacionais não persistem; se a resposta se perder e o resultado for desconhecido, confirmar o estado em leitura antes de repetir. Se ocorrer na 002b/003, a 002 anterior pode continuar instalada: revisar a falha sem reaplicar as etapas concluídas. O prazo de lock das escritas é 5 s e o limite por comando é 30 s; timeout não autoriza nova tentativa sem conferir o estado.

`003` não corrige permissões automaticamente. Se o erro for exposição da função legada, assinatura inesperada, herança de grants ou evento diferente do relatório, a administração deve resolver e autorizar o ajuste específico antes da liberação. Não há aplicação adicional do patch de TESTE neste roteiro.

## PR e Vercel — depois da validação do banco

O código está preparado para revisão técnica: suíte automatizada, catálogo preservado, APIs compartilhadas, separação de ambientes e bloqueio de ORIGINAL em previews. O PR não deve sair de rascunho/ser integrado como consequência automática da execução SQL. Exigir banco validado por 003, recuperação esclarecida, evidências pendentes de gestor/aprovação/recarga e aceitação acadêmica (datas, textos, consentimento e retenção). Não repetir a aceitação já confirmada de `Experimento`.

Após autorização explícita de integração/publicação:

1. Integrar a revisão aprovada do PR #1 à **main**, preservando `teste-supabase` e o Vercel TESTE.
2. Criar **um projeto Vercel ORIGINAL separado**, importando `Tsilveira-dev/App_fair_play` na branch **main**. A importação pode iniciar o deploy; fazer isso somente depois da liberação. Não importar a branch de TESTE e promovê-la depois. Confirmar Production Branch `main` em Settings → Git antes de aceitar o deployment; não depender da branch padrão do formulário. Se a seleção main não estiver disponível na importação, interromper a publicação e configurar a branch antes do deployment.
3. Usar a raiz **`.`**, Framework **Other**, Node **24.x**, Install `npm ci`, Build `npm run build` e Output **public**. Não selecionar a pasta `public` como raiz: `api` fica na raiz do repositório.
4. Definir exclusivamente no escopo **Production**, antes do primeiro deploy aceito:

| Variável | Valor |
| --- | --- |
| `AMBIENTE` | `original` |
| `SUPABASE_URL` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_ORIGINAL_URL_ESPERADA` | `https://swbwbkslcotoecjlbqxe.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do ORIGINAL |
| `SUPABASE_SECRET_KEY` | Chave secreta do ORIGINAL, sensível, somente servidor |

   Não preencher Preview/Development com credenciais ORIGINAL, copiar valores do TESTE ou sobrescrever `VERCEL_ENV`/`VERCEL_GIT_COMMIT_REF`. Previews devem ficar desabilitados ou sem credenciais. Não inserir segredos no Git, `public`, chat ou variáveis `VITE_`/`NEXT_PUBLIC_`. Se alterar variáveis depois de um deployment, fazer um único redeploy da main aprovada.

5. No Auth ORIGINAL, confirmar e-mail/senha do **gestor já existente**, vínculo ao UID em `gestores`, autenticação anônima e Site URL/redirects do novo domínio. Não recriar gestor, participantes ou sessão preservados. Definir período real de sete dias em `configuracao_teste` somente quando a equipe autorizar a coleta.
6. Conferir `/api/config-public`: HTTP 200, `ambiente=original`, URL ORIGINAL e ausência de segredo; `/api/checkin` sem token: 401. Não usar `npm run verificar:deploy` para ORIGINAL — o comando é restrito ao TESTE. Com a equipe e os acessos existentes, confirmar login, aprovação, registros/pontos e recarga pelo procedimento autorizado; liberar aos estudantes só após aceitação. Não transportar contas/dados fictícios.

Nenhuma dessas operações externas foi executada pelo Codex. O Vercel ORIGINAL permanece não criado e a `main` permanece inalterada nesta etapa.
