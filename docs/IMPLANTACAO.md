# Implantação na Vercel

Para executar a preparação no editor e configurar o painel, siga [VS Code e Vercel](VS_CODE_VERCEL.md).

O projeto Vercel de TESTE `fairplay-teste` já está conectado e tem deploy bem-sucedido registrado no GitHub. O [estado dos bancos](ESTADO_BANCOS.md) separa a validação do Codex das confirmações administrativas: 002 e restrição de EXECUTE já aplicadas no TESTE, fluxo de Experimento validado e metadados ORIGINAL já inspecionados somente em leitura. Não repetir essas etapas. A integração Netlify preexistente cria previews automaticamente ao abrir/atualizar o PR, inclusive no projeto fairplay-app; a trava CONTEXT/HEAD bloqueia ORIGINAL nesses previews. A produção em main não foi alterada.

## TESTE primeiro

1. Utilize o projeto Vercel de TESTE já existente, `fairplay-teste`, separado do ORIGINAL. Antes de disparar um deploy, confirme a branch `teste-supabase`, o ambiente Supabase e as variáveis abaixo. Não habilite publicação automática do ORIGINAL.
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

5. A 002 já foi aplicada ao TESTE e confirmada pela integração administrativa: RPC, três triggers, visão e registros preservados. Não reaplicar a migração, não executar 001 e não recriar o projeto. Continue a aceitação conforme [o relatório publicado](ACEITACAO_PUBLICADA.md).
6. No Supabase de TESTE, habilite autenticação anônima para estudantes. Crie o gestor por e-mail/senha e registre apenas seu UID em `public.gestores` por operação administrativa. O navegador não recebe privilégios de escrita direta nas tabelas. Configure Site URL/redirect URLs para o domínio autorizado do TESTE, sem reutilizar cookies ou domínios de produção.
7. Defina `configuracao_teste` com `id=1`, data inicial planejada e `ativo=true` quando a equipe liberar o teste. O nome histórico da tabela é mantido também no ORIGINAL; não significa compartilhamento entre os bancos.
8. No deploy TESTE, confira `/api/config-public` com HTTP 200, `ambiente=teste`, URL correta e ausência da chave secreta. Uma chamada sem token para `/api/checkin` deve retornar 401. Valide login do gestor, cadastro com primeiro nome, solicitação do estudante e aprovação pela equipe, check-in, desafio e restauração após recarregar.

O frontend usa jsDelivr para Supabase JS 2.45.4, Tailwind CDN e Google Fonts, preservando as dependências existentes. Conexões HTTPS a esses serviços precisam estar disponíveis no navegador. As APIs precisam acessar somente o Supabase do ambiente correspondente.

## ORIGINAL — executar somente com aprovação explícita

O roteiro completo e o checklist mínimo estão em [Plano ORIGINAL](ORIGINAL.md), incluindo tabela de tentativas antes da 002, grants, índices, event triggers e configuração Vercel `main`/Production com banco ORIGINAL. O ORIGINAL existente tem oito tabelas e RLS ativo conforme inspeção administrativa; não executar a baseline 001.

A preparação não executa SQL, integra o PR ou publica. Autorizar essas ações separadamente após a aceitação do TESTE. Não copiar dados/contas fictícias nem credenciais entre ambientes.

## Operação e reversão

Não há tarefa de expurgo ou exclusão de dados. Check-ins são definitivos; desafios só contam pontos após confirmação manual. Alterações de hospedagem não exigem transportar dados entre bancos.

Em falha de implantação, volte à versão anterior da hospedagem e suspenda novas entradas até diagnóstico. Não remova tabelas nem restaure o TESTE sobre o ORIGINAL. A troca das chaves de armazenamento locais exige nova autenticação; os registros confirmados permanecem no Supabase correspondente. Em aparelhos compartilhados, a equipe deve orientar o uso da sessão/dispositivo autorizado de cada participante.
