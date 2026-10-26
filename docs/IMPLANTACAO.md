# Implantação na Vercel

O código está preparado para implantação. Nenhum projeto Vercel foi conectado e nenhum banco externo foi alterado por esta entrega. A integração Netlify preexistente cria previews automaticamente ao abrir/atualizar o PR, inclusive no projeto fairplay-app; a trava CONTEXT/HEAD bloqueia ORIGINAL nesses previews. A produção em main não foi alterada.

## TESTE primeiro

1. Após autorizar a conexão da Vercel ao GitHub, configure um projeto separado para TESTE. Antes de disparar um deploy, confirme a branch `teste-supabase`, o ambiente Supabase e as variáveis abaixo. Não habilite publicação automática do ORIGINAL.
2. Use Framework **Other**, Root Directory **raiz do repositório**, Node **24.x**, Build Command `npm run build` e Output Directory `public`. `vercel.json` já registra build, saída, funções e compatibilidade das rotas.
3. Restrinja a Production Branch deste projeto de TESTE a `teste-supabase`. Previews também devem usar apenas as credenciais de TESTE. Um deploy de outro nome de branch falha fechado com essa configuração.
4. Cadastre as variáveis no projeto de TESTE, nos escopos necessários, sem copiar valores do ORIGINAL:

| Variável | TESTE | Uso |
| --- | --- | --- |
| `AMBIENTE` | `teste` | Seleção obrigatória do ambiente |
| `SUPABASE_URL` | `https://jzxltkjxdefuptutpkfx.supabase.co` | URL fixada para TESTE |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável do mesmo projeto | Pode chegar ao navegador via configuração pública |
| `SUPABASE_SECRET_KEY` | Chave secreta do mesmo projeto | Somente funções do servidor; marcar como sensível na Vercel |

Nunca coloque chaves no Git, em `public`, em `vercel.json` ou em valores com prefixo `VITE_`, `NEXT_PUBLIC_` ou equivalente. A configuração pública rejeita `sb_secret_*` e JWTs de `service_role`. Use a chave publicável `sb_publishable_*` ou a antiga chave `anon` válida; prefira chaves novas.

5. Antes de testar as novas solicitações, revise o esquema TESTE e aplique a migração `002_protecao.sql` **apenas nesse banco**, conforme [as instruções SQL](../supabase/README.md). Essa migração disponibiliza a RPC transacional `registrar_tentativa_acesso`. Uma base existente não deve receber a baseline `001` sem comparação.
6. No Supabase de TESTE, habilite autenticação anônima para estudantes. Crie o gestor por e-mail/senha e registre apenas seu UID em `public.gestores` por operação administrativa. O navegador não recebe privilégios de escrita direta nas tabelas. Configure Site URL/redirect URLs para o domínio autorizado do TESTE, sem reutilizar cookies ou domínios de produção.
7. Defina `configuracao_teste` com `id=1`, data inicial planejada e `ativo=true` quando a equipe liberar o teste. O nome histórico da tabela é mantido também no ORIGINAL; não significa compartilhamento entre os bancos.
8. No deploy TESTE, confira `/api/config-public` com HTTP 200, `ambiente=teste`, URL correta e ausência da chave secreta. Uma chamada sem token para `/api/checkin` deve retornar 401. Valide login do gestor, cadastro com primeiro nome, solicitação do estudante e aprovação pela equipe, check-in, desafio e restauração após recarregar.

O frontend usa jsDelivr para Supabase JS 2.45.4, Tailwind CDN e Google Fonts, preservando as dependências existentes. Conexões HTTPS a esses serviços precisam estar disponíveis no navegador. As APIs precisam acessar somente o Supabase do ambiente correspondente.

## ORIGINAL — executar somente com aprovação explícita

- Revisar o PR e autorizar a integração à `main`; não promover automaticamente as credenciais do TESTE.
- Confirmar a validação acadêmica dos textos: o código recebido ainda identifica questionário e desafios como rascunho/proposta. Eles foram preservados integralmente.
- Fazer backup do ORIGINAL e comparar o esquema existente com a baseline. Aprovar separadamente a execução das migrações; nunca importar registros, usuários, sessões ou respostas fictícias do TESTE.
- Criar/configurar outro projeto Vercel, com Production Branch `main`, credenciais exclusivas e `AMBIENTE=original`. Definir `SUPABASE_URL` e `SUPABASE_ORIGINAL_URL_ESPERADA` com a mesma URL ORIGINAL, diferente do TESTE. Não atribuir valores ORIGINAL a Preview ou Development.
- O servidor rejeita ORIGINAL em previews e em branches diferentes de `main`. Essas verificações complementam a separação de projetos e credenciais; não substituem a revisão das configurações de implantação.
- Recriar o gestor real no Auth ORIGINAL e cadastrar seu UID administrativamente. Cadastrar participantes reais somente pelo procedimento autorizado da pesquisa. Não copiar contas, senhas ou sessões do TESTE.
- Autorizar o deploy ORIGINAL e executar os testes de aceitação com a equipe antes de liberar aos estudantes. Revisar prazos de coleta, acesso, consentimento e guarda dos dados conforme o protocolo da pesquisa.

## Operação e reversão

Não há tarefa de expurgo ou exclusão de dados. Check-ins são definitivos; desafios só contam pontos após confirmação manual. Alterações de hospedagem não exigem transportar dados entre bancos.

Em falha de implantação, volte à versão anterior da hospedagem e suspenda novas entradas até diagnóstico. Não remova tabelas nem restaure o TESTE sobre o ORIGINAL. A troca das chaves de armazenamento locais exige nova autenticação; os registros confirmados permanecem no Supabase correspondente. Em aparelhos compartilhados, a equipe deve orientar o uso da sessão/dispositivo autorizado de cada participante.
