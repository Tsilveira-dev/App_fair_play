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

`npm run check` passou com **97 testes, zero falhas e zero ignorados**, após reinstalação com `npm ci`. O comando executa validação de sintaxe/build e a suíte Node. A suíte cobre APIs com Supabase simulado, interface real em DOM JSDOM (incluindo envio das cinco respostas, desafio, 30 pontos e restauração em outra página), servidor HTTP real e PostgreSQL PGlite com execução das migrações, grants, triggers, índices, RPC e visão de pontuação.

Esses testes não conectam Vercel ou Supabase hospedados. JSDOM não é navegador gráfico: layout responsivo, renderização de fontes/CDNs e teste em celular ainda exigem aceitação no ambiente TESTE publicado. O esquema externo não foi inspecionado, porque faltam as chaves de TESTE. Nenhuma conexão, execução SQL ou publicação ORIGINAL faz parte da validação realizada.

## Pendências de implantação

1. Cadastrar as chaves exclusivamente de TESTE nas configurações seguras do ambiente/projeto. URL e referência de TESTE já são conhecidas; não enviar segredos pelo chat.
2. Comparar o esquema Supabase de TESTE com as migrações e instalar a RPC/proteções compatíveis, sem excluir registros.
3. Autorizar conexão ao projeto Vercel de TESTE e validar login, autorização, persistência e recarga no domínio publicado e em celular.
4. Confirmar com o responsável os textos que o código identifica como rascunho/proposta antes da coleta.
5. Aprovar separadamente PR/integração à `main`, migrações no ORIGINAL e publicação ORIGINAL, nessa ordem.
