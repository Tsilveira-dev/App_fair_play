# Verificação final do ORIGINAL — 26/10/2026

Alvo: `https://fairplay-original.vercel.app`, Supabase ORIGINAL `swbwbkslcotoecjlbqxe`. Este relatório distingue observação do Codex, confirmação administrativa e verificações ainda não executadas. Nenhum teste desta etapa criou contas/solicitações ou alterou dados, calendário ou acessos do ORIGINAL.

## Concluído e confirmado

| Evidência | Origem e resultado |
| --- | --- |
| PR #1 | GitHub consultado pelo Codex: MERGED, commit `9ef6f8d3422e2dd4dbe9e129847fc5989fbadc9a`; origem `main` confirmada |
| Vercel ORIGINAL para esse commit | Status GitHub `Vercel – fairplay-original`: success; deployment `H8KT4aJqENaRzr8BH4rNXVJeXB88` |
| Código local de revisão | Checkout derivado de `origin/main` em `9ef6f8d`; árvore idêntica à revisão `b5d2d4b` integrada |
| Configuração pública publicada | Responsável confirmou `ambiente=original` e URL Supabase ORIGINAL; não foi relida pelo Codex nesta execução |
| Banco ORIGINAL | Integração administrativa confirmou 002, 002b, correção de `rls_auto_enable()` e auditoria 003 concluídas/aprovadas; não repetir migrações |
| Gestor e painel ORIGINAL | Responsável confirmou login, três participantes, um ativo, uma solicitação pendente; sem check-ins/desafios e sem período configurado |
| Fluxo de check-in/desafio/30 pontos | Já validado no TESTE; não repetido no ORIGINAL |
| Suíte automatizada | Última suíte aceita: 126 testes aprovados; não houve mudança no aplicativo que exigisse repetir a suíte nesta revisão documental |

## Nove APIs: contratos locais e bloqueio externo

O proxy da máquina Codex recusou o túnel HTTPS para `fairplay-original.vercel.app` com **403**, antes de receber uma resposta HTTP do aplicativo. O domínio está ausente da lista de rede da configuração ativa; foi salvo um rascunho adicionando apenas esse destino, preservando os existentes. **Salvar o rascunho não aplica a mudança à máquina.**

Não foram repetidas chamadas remotas bloqueadas. Portanto, as nove APIs publicadas, seus corpos/cabeçalhos e a comparação dos cinco arquivos públicos com o commit **continuam sem verificação HTTP independente nesta execução**. O 403 do proxy não foi classificado como defeito da Vercel ou da aplicação.

Foram exercitados os handlers locais da `main`, com variáveis ORIGINAL fictícias, sem credenciais reais e com qualquer fetch externo proibido:

| API | Métodos verificados localmente, sem sessão | Resultado esperado e observado localmente |
| --- | --- | --- |
| `config-public` | GET | 200, ambiente ORIGINAL e URL correta, apenas chave publicável fictícia |
| `solicitar-acesso` | POST | 401 |
| `consultar-acesso` | POST | 401 |
| `verificar-gestor` | POST | 401 |
| `listar-participantes` | GET | 401 |
| `salvar-participante` | POST | 401 |
| `gerenciar-acesso` | GET e POST | 401 |
| `checkin` | GET e POST | 401 |
| `desafio` | GET e POST | 401 |

Resultado: **12 chamadas locais aprovadas, zero requisições externas**, sem tentar acionar escrita autenticada. Isso comprova os controles locais, não substitui a conferência do serviço publicado. As requisições POST de conferência externa, quando liberadas, devem usar corpo `{}` e nenhuma sessão/Authorization; não devem cadastrar dados.

Para concluir a conferência pública, revisar/salvar nas configurações do ambiente de nuvem o domínio `fairplay-original.vercel.app` e publicar a configuração conforme a interface solicitar. Isso é configuração do ambiente Codex, **não redeploy do aplicativo nem ativação da coleta**. Retomar somente as verificações pendentes após o acesso estar disponível. Não são necessárias novas credenciais do Supabase.

O verificador preparado deve comparar `index.html`, `script.js`, `style.css`, `admin.html` e `admin.js` com `9ef6f8d`, além dos 12 contratos acima. Confirmar que `/api/config-public` contém apenas `ambiente`, `supabaseUrl` e `supabasePublishableKey`; nenhum `sb_secret_*`, JWT com role `service_role`, stack ou dados pessoais deve aparecer. **A ausência de segredos nas respostas publicadas ainda não foi atestada diretamente pelo Codex.** Não exibir ou salvar conteúdos sensíveis caso sejam encontrados.

## Apresentação em celular e computador

Chromium sobre arquivos da `main` em origem local isolada, com fontes/CDNs reais e estados fictícios em memória: larguras **320, 375, 390, 768 e 1280 px**. Não houve login real, requisição de escrita ou simulação de sucesso de APIs do ORIGINAL.

- 150 conferências de desafios: 28 títulos por largura, mais estados aceito/concluído do título crítico.
- 65 conferências do estudante: formulário, questionário, mensagens de verificação/salvamento, desafio, Progresso e avisos temporários.
- 20 conferências do gestor: login, painel com dados de exemplo apenas em memória, edição e confirmação. Aprovar permanece desabilitado sem período.

**235 conferências sem cortes/rolagem horizontal, sem erros JavaScript e sem escritas.** Capturas de celular e desktop inspecionadas visualmente. No painel, houve instrumentação local apenas para renderizar estados, sem alterar arquivos do projeto ou autenticar uma sessão; não é evidência de uso autenticado do painel publicado. Não equivale a teste em aparelho físico.

## Impedimentos e conclusão técnica

Não foi identificado defeito de código nas verificações executadas que exija correção da aplicação ou nova funcionalidade. O calendário ausente é um **bloqueio operacional esperado** para aprovação/coleta. O fluxo ORIGINAL com estudante e a recarga de registros reais ainda dependem do procedimento autorizado da equipe; não foram inventados resultados.

A verificação externa permanece incompleta pelo acesso de rede desta máquina. A participação dos estudantes ainda não ocorreu segundo o estado informado. O [checklist operacional](OPERACAO_COLETA.md) planeja 29/10 a 04/11 e explicita a recuperação existente no Dia 8 (05/11), condicionada ao protocolo. A publicação e o login do gestor não significam pesquisa iniciada ou concluída.
