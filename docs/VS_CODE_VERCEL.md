# Abrir no VS Code e publicar o TESTE

Os arquivos e configurações estão na branch `teste-supabase`, no PR #1. Não é necessário integrar o PR à `main` para publicar o TESTE.

## No VS Code

1. Abra a pasta raiz `App_fair_play`, onde ficam `package.json`, `public` e `api`. Confira `teste-supabase` na barra inferior e obtenha as atualizações dessa branch pelo Git. Use Node.js **24.x**.
2. Abra **Terminal → Run Task / Executar Tarefa** e escolha **Fair Play: preparar projeto**. Essa tarefa instala com `npm ci` e cria `.env.local` sem sobrescrever um arquivo existente.
3. Abra `.env.local` e preencha apenas `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` com as chaves do projeto Supabase de TESTE. URL e `AMBIENTE=teste` já vêm preenchidos. Esse arquivo é ignorado pelo Git e pelo envio à Vercel; não compartilhe seu conteúdo.
4. Pressione **Ctrl+Shift+B** para validar o código e executar os testes. As chaves reais não são utilizadas na suíte automatizada.
5. Pressione **F5**, usando **Fair Play: iniciar TESTE**. A configuração é conferida antes de iniciar o servidor Node, com HTML e APIs funcionando no mesmo processo. Credenciais ausentes ou configuração ORIGINAL interrompem essa tarefa; corrija o arquivo e execute novamente, sem escolher “Debug Anyway”.
6. Após publicar na Vercel, execute **Fair Play: conferir deploy de TESTE** e informe a URL raiz HTTPS gerada pela plataforma. A conferência verifica páginas, referência do banco de TESTE e rejeição de check-in sem login, sem imprimir chaves ou escrever no banco.

Os mesmos comandos funcionam no terminal:

```sh
npm ci
npm run preparar:local
npm run verificar:ambiente
npm run check
npm run dev
# Depois do deploy, substitua o endereço abaixo pelo domínio real de TESTE:
npm run verificar:deploy -- https://SEU-PROJETO-DE-TESTE.vercel.app
```

## No painel da Vercel

Use um projeto separado, como `fairplay-teste`. O projeto ORIGINAL não deve receber essas credenciais nem esta implantação.

1. Vincule `Tsilveira-dev/App_fair_play` e selecione **teste-supabase** para a implantação. Confira em **Settings → Git** que a Production Branch desse projeto de TESTE é `teste-supabase`. Não integre o PR à `main` para conseguir fazer isso.
2. O projeto `fairplay-teste` já existe e está publicado; não recrie, não execute nova importação ou vinculação. Preserve a branch `teste-supabase`.
3. Em **Settings → Build and Deployment** (ou os campos equivalentes de configuração da implantação), use:

| Campo | Valor |
| --- | --- |
| Framework Preset | Other |
| Root Directory | Raiz do repositório: `.`; não selecionar `public` |
| Node.js Version | 24.x |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `public` |

4. Em **Settings → Environment Variables**, adicione os quatro valores abaixo. Para esse projeto de TESTE, use somente valores de TESTE nos escopos Production e Preview que serão utilizados:

| Nome | Valor |
| --- | --- |
| `AMBIENTE` | `teste` |
| `SUPABASE_URL` | `https://jzxltkjxdefuptutpkfx.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável desse projeto de TESTE |
| `SUPABASE_SECRET_KEY` | Chave secreta desse projeto de TESTE; marcar como sensível |

Não use as chaves do ORIGINAL. Não é necessário definir `SUPABASE_ORIGINAL_URL_ESPERADA` no projeto de TESTE. As variáveis automáticas `VERCEL_ENV` e `VERCEL_GIT_COMMIT_REF` devem permanecer sob controle da Vercel.

5. Crie o deployment da branch **teste-supabase**. Se alterar as variáveis depois de um deploy, execute **Redeploy** para que os novos valores sejam carregados.
6. Use a URL gerada na tarefa de conferência do VS Code. Se a Vercel exigir login para esse endereço, a conferência sem autenticação não passará; valide também a proteção de acesso do projeto. Para o uso por estudantes, a equipe precisa decidir qual endereço TESTE pode ser acessado pelos participantes.
7. Faça a aceitação com um gestor e participante de TESTE: login, solicitação, aprovação, cinco respostas, confirmação do check-in, aceite/conclusão do desafio e recarga da página. Esperado: 10 pontos após check-in e 30 após concluir o desafio. A conferência automatizada sem login não substitui esse teste de persistência.

## O Supabase também precisa estar configurado

Essas etapas dependem do projeto hospedado e não são concluídas apenas com os arquivos no VS Code:

- Habilitar autenticação anônima dos estudantes e login de gestor por e-mail/senha.
- Conferir o esquema existente. O arquivo [inspecionar_esquema.sql](../supabase/inspecionar_esquema.sql) é somente leitura e não consulta dados pessoais ou respostas. Abra-o no VS Code e execute-o no SQL Editor **do TESTE** para fazer a comparação.
- A 002 já está aplicada ao TESTE, com RPC e proteções confirmadas. Não reaplicar 002 ou 001; os próximos passos são a aceitação positiva e a auditoria pontual de ACL, usando os acessos já autorizados.
- Cadastrar administrativamente o UID do gestor real de TESTE em `gestores` e definir a data oficial em `configuracao_teste`, conforme [as instruções SQL](../supabase/README.md). A aplicação não inventa uma data ou uma identidade de gestor.
- Atualizar Site URL e URLs de redirecionamento do Auth para o domínio de TESTE autorizado após a Vercel gerar o endereço.

Acesso, credenciais, esquema externo e aprovação acadêmica do catálogo continuam necessários. A `main`, o banco ORIGINAL e sua produção não são alterados por esses passos de TESTE.
