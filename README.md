# Fair Play

Aplicativo acadêmico de acompanhamento por sete dias, com cinco perguntas diárias, check-ins e desafios persistidos no Supabase. A migração para a Vercel está preparada na branch `teste-supabase`. A branch `main` e o banco ORIGINAL exigem aprovação antes de qualquer integração, migração ou publicação.

## Desenvolvimento

Node.js 24 e npm são suficientes. Não é necessário conectar Netlify/Vercel para desenvolver ou testar.

```sh
npm ci
npm run check
npm run preparar:local
# Preencher .env.local somente com as chaves do Supabase de TESTE.
npm run dev
```

O servidor local usa a porta 3000 e publica somente a pasta `public` e as nove APIs. Sem as chaves, as páginas abrem, mas a configuração retorna HTTP 500 e o aplicativo bloqueia o acesso. Os testes usam dados sintéticos isolados e nunca acessam Supabase real.

- [Estado da candidata e bloqueios externos](docs/ENTREGA_CANDIDATA.md)
- [Passo a passo: VS Code e painel Vercel](docs/VS_CODE_VERCEL.md)
- [Implantação e separação TESTE/ORIGINAL](docs/IMPLANTACAO.md)
- [Inventário, regras e validação](docs/VALIDACAO.md)
- [Migrações SQL sem dados](supabase/README.md)

## Estrutura

| Local | Função |
| --- | --- |
| `public/` | HTML, CSS, questionário existente e painel do gestor |
| `api/*.mjs` | Entradas Node da Vercel |
| `lib/vercel-adapter.mjs` | Tradução de requisições/respostas para o contrato existente |
| `netlify/functions/` | Lógica de negócio reutilizada, sem reescrita |
| `netlify/lib/` | Validações de ambiente, identidade, chaves e datas |
| `supabase/migrations/` | Esquema e proteções transacionais |
| `tests/` | APIs, interface/DOM, HTTP e PostgreSQL local via PGlite |

A pasta de publicação é `public`, mas a **raiz do projeto Vercel é a raiz do repositório**, para incluir `api`. As URLs antigas `/.netlify/functions/*` continuam aceitas na Vercel. A Netlify mantém um redirecionamento interno equivalente para `/api/*` durante a transição.
