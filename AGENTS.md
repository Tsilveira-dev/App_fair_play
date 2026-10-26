# Fair Play

- PR #1 já integrado à `main` (9ef6f8d) e ORIGINAL publicado. Para novas alterações, crie branch a partir da `origin/main` atualizada e novo PR; nunca faça commits diretos na `main`. Preserve `teste-supabase` como TESTE separado.
- Não reaplique migrações já validadas, recrie projetos ou altere dados, calendário, coleta e acessos do ORIGINAL sem autorização aplicável. Verificações sem sessão não devem criar contas/solicitações fictícias.
- Cada tarefa de nuvem já tem isolamento; use o checkout existente. Não crie worktrees sem solicitação explícita.
- Preserve perguntas, alternativas e textos dos desafios. O catálogo recebido está marcado como rascunho/proposta e depende da validação acadêmica do responsável antes da coleta real.
- TESTE e ORIGINAL usam projetos Supabase e Vercel separados. Nunca copie registros, usuários ou credenciais entre eles.
- Chaves secretas ficam exclusivamente no servidor. Arquivos `.env.local` são ignorados. Nunca imprima credenciais ou dados pessoais nos logs.
- Validação local: Node 24, `npm ci`, `npm run check`. Os testes usam serviços simulados e PostgreSQL PGlite em memória; não acessam um banco real.
- Consulte `docs/IMPLANTACAO.md` e `supabase/README.md` antes de qualquer implantação ou migração. A pasta de saída é `public`; a raiz do projeto Vercel inclui `api`.
