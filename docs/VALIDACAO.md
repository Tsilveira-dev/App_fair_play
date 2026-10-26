# Inventário e validação

Base inspecionada: `teste-supabase`, commit `4e9ded1b460e05e393a8094e3517abc7187dd3b5`. A branch já tinha pasta `public`, questionário diário, check-ins, desafios e separação por ambiente. A lógica foi aproveitada e as entradas Vercel compartilham os mesmos handlers da Netlify.

## Funcionalidades e contratos

| Função | Método | Controle/resultado |
| --- | --- | --- |
| `config-public` | GET | Somente URL, ambiente e chave publicável; sem cache |
| `solicitar-acesso` | POST | UID anônimo validado, primeiro nome, sem aprovação automática; resposta uniforme para nome existente/inexistente |
| `consultar-acesso` | POST | Apenas a sessão do UID autenticado, participante ativo, validade e período |
| `verificar-gestor` | POST | E-mail autenticado e UID cadastrado em gestores |
| `listar-participantes` | GET | Exclusiva do gestor; colunas necessárias para o painel |
| `salvar-participante` | POST | Cadastro/correção/ativação/desativação; preserva histórico |
| `gerenciar-acesso` | GET/POST | Aprovar/recusar pendente e revogar aprovada; conflito protegido pelo status anterior |
| `checkin` | GET/POST | Um por participante/dia; respostas, classificação e dia calculados no servidor |
| `desafio` | GET/POST | Um por participante/dia; aceite e conclusão manual confirmados no banco |

Todas têm entradas `/api/<nome>` e compatibilidade `/.netlify/functions/<nome>` na Vercel. O adaptador preserva status, cabeçalhos, parâmetros de consulta, corpo JSON e método, com limite de 4096 bytes e erros sem detalhes privados.

## Regras preservadas

- Sete dias e cinco perguntas por dia, total de 35. Os textos e alternativas, os 21 desafios por nível e sete neutros têm hashes SHA-256 iguais aos da branch recebida, registrados nos testes.
- Três níveis: pontuação educativa normalizada de 0 a 10, baixo até 3, moderado até 7, alto acima de 7. Com menos de três respostas pontuáveis, classificação nula e desafio neutro. Alternativas informativas/não aplicáveis não entram no cálculo.
- Dez pontos por check-in confirmado; vinte por desafio concluído, com máximo de 210 em sete dias. O cliente ignora pontuação enviada pelo usuário e a visão SQL deriva os totais dos registros.
- Dia 8 é somente recuperação do check-in do Dia 7. Não cria novo dia nem aceita/conclui desafios.
- Cronômetro opcional, com pausa e retomada; chegar a zero não conclui nem concede pontos.
- Estudante por primeiro nome e identidade anônima, autorizado pela equipe. Gestor por e-mail/senha com cadastro explícito.

## Correções

- Expiração malformada agora bloqueia os desafios; antes, `Date.parse` com NaN passava pela comparação.
- Check-ins e desafios recusam datas impossíveis, sem normalização silenciosa do calendário.
- Todas as rotas do gestor exigem identidade Auth de e-mail, além do cadastro; uma identidade anônima não recebe acesso nem se cadastrada por engano.
- Configuração pública rejeita também JWTs legados de `service_role`.
- Previews e branches de TESTE não podem selecionar ORIGINAL, tanto na Vercel quanto na Netlify (CONTEXT/HEAD). Cookies/storage de autenticação e cache passam a incluir a referência do projeto Supabase; sessões de estudantes e gestores têm chaves distintas.
- Pontos em cache só são exibidos após sincronização; aceite não concede pontos e respostas repetidas não duplicam registros.
- Limite de solicitações passa a ser transacional no PostgreSQL, com bloqueio compartilhado entre instâncias Vercel. Exige a RPC da migração 002.
- SQL protege unicidade, preservação de histórico, validade e autorização no instante da gravação. A baseline recusa instalações sobre esquemas preexistentes sem revisão.
- Texto inicial corrigido para cinco perguntas; conteúdo do instrumento não foi substituído.

## Evidências e limites

`npm run check` passou com **126 testes, zero falhas e zero ignorados**, na última execução. O comando executa validação de sintaxe/build e a suíte Node. A suíte cobre APIs com Supabase simulado, interface real em DOM JSDOM (incluindo envio das cinco respostas, desafio, 30 pontos e restauração em outra página), servidor HTTP real e PostgreSQL PGlite com execução das migrações, grants, triggers, índices, RPC e visão de pontuação.

Esses testes não conectam Vercel ou Supabase hospedados. JSDOM não é navegador gráfico. A revisão de mensagens acrescenta inspeção em Chromium nas larguras 320, 375, 390, 768 e 1280 px com estados fictícios em memória, sem gravações; não equivale a teste em aparelho físico ou aceitação autenticada. A correção responsiva (150 casos de apresentação, 28 títulos em cinco larguras) e o resultado funcional de `Experimento` informado pelo responsável estão em [Aceitação publicada](ACEITACAO_PUBLICADA.md). A integração administrativa confirmou a inspeção somente de metadados do ORIGINAL; o Codex recebeu o resumo, sem consultar o banco. Ver [Estado dos bancos](ESTADO_BANCOS.md). As verificações reais públicas e com identidade anônima estão registradas na entrega candidata. Nenhuma conexão, execução SQL ou publicação ORIGINAL faz parte da validação realizada.

## Pendências de implantação

1. O Vercel TESTE já está conectado e configurado; a 002 já foi aplicada pela integração administrativa. Não reaplicar 001/002, recriar projetos ou solicitar novamente credenciais.
2. Completar somente as evidências de aceitação ainda ausentes (gestor, aprovação e recarga de registros), sem repetir o fluxo de `Experimento` já confirmado pelo responsável.
3. A correção do cartão foi conferida em celular e desktop com Chromium; concluir a aceitação da equipe em dispositivo físico conforme disponibilidade.
4. Revisar o [plano ORIGINAL](ORIGINAL.md) com os metadados já confirmados e validar catálogo, datas, consentimento e retenção. Restrição de EXECUTE e migração 002 do TESTE já concluídas.
5. Aprovar separadamente PR/integração à `main`, eventuais ajustes no ORIGINAL e publicação ORIGINAL. Não transportar dados do TESTE.

O projeto também inclui tarefas VS Code (preparação, testes, F5 e conferência do deploy), criação idempotente de `.env.local`, validação de configuração TESTE e conferência HTTP sem credenciais. O relatório SQL de esquema é somente leitura. Esses recursos não executam migração remota ou deploy automaticamente.

A revisão incremental da 002 e a preparação da referência ORIGINAL estão detalhadas em [Entrega candidata](ENTREGA_CANDIDATA.md). A nova suíte reproduz as características de esquema informadas pelo responsável, sem afirmar inspeção ou alteração de bancos externos.

A aceitação no sistema publicado está separada em [Aceitação publicada](ACEITACAO_PUBLICADA.md): nove cenários reais de Chromium passaram. Os três novos testes locais verificam a correção pontual de ACL de `rls_auto_enable()` e a continuidade de seu event trigger. A 002 já aplicada não foi reaplicada nesta etapa.

Sete testes locais em `tests/sql-original.test.mjs` exercitam a sequência incremental ORIGINAL preparada: tabela de tentativas ausente, índice pendente/aprovada, event trigger, grants e visão, permissões herdadas, divergências/rollback e defaults amplos de CREATE VIEW. São testes em PGlite, não execução no ORIGINAL.

A revisão do estado com 000 já aplicada acrescenta um teste de preservação integral de registros Auth fictícios (usuários, identidades e sessões), três participantes, um gestor, uma sessão da aplicação e seus vínculos. O teste não copia dados reais, reaplica 000 hospedada ou prova recuperabilidade de backup; a sequência restante está em [ORIGINAL](ORIGINAL.md). O PR é tecnicamente revisável, mas integração/publicação aguardam verificação administrativa, recuperação e aceitação final.
