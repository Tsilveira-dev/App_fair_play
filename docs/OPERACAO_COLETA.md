# Operação da pesquisa — 29/10 a 04/11/2026

Este é um checklist para a equipe. As datas são planejadas, **não aplicadas** ao banco. A publicação do aplicativo não inicia nem conclui a pesquisa. Não houve participação de estudantes confirmada neste relatório.

## Antes de liberar qualquer estudante

- [ ] Confirmar autorização institucional, consentimento dos responsáveis e assentimento dos estudantes, quando aplicáveis ao protocolo. Guardar esses documentos no local institucional definido, sem publicar dados pessoais no Git.
- [ ] Confirmar os textos educativos já aprovados, a população participante, os responsáveis pelo acompanhamento, o procedimento para aparelhos compartilhados e o prazo de guarda/acesso aos dados.
- [ ] Conferir os três cadastros já existentes e sua elegibilidade. Somente um está ativo segundo o responsável; manter inativos os que não estiverem autorizados. Cadastrar apenas participantes reais autorizados pelo gestor, usando primeiro nome, sem recriar os registros existentes ou importar o TESTE.
- [ ] Confirmar com a administração o mecanismo de recuperação/backup e a guarda segura de credenciais. A confirmação das migrações não comprova, por si, recuperação integral de Auth/PostgreSQL; a última informação específica sobre backup era de uma cópia parcial.
- [ ] Definir quem autoriza e executa o calendário no ORIGINAL. Após autorização, configurar `configuracao_teste` com `id=1`, `data_inicio=2026-10-29` e `ativo=true`. **Não executar isso automaticamente.** Sem configuração válida/ativa, aprovações e registros permanecem bloqueados por projeto. Não há editor de calendário no painel atual; esta etapa é administrativa.
- [ ] Decidir expressamente se o protocolo permite a recuperação existente no Dia 8 (05/11). Não mudar as regras ou o calendário para ocultar essa janela sem aprovação da equipe.
- [ ] Orientar o acesso a `https://fairplay-original.vercel.app`. O estudante informa seu primeiro nome no aparelho autorizado e a equipe confere a solicitação. Após calendário e consentimentos autorizados, o gestor aprova somente o acesso do participante correto; a solicitação pendente atual não foi aprovada pelo Codex.
- [ ] A equipe deve confirmar no ORIGINAL o funcionamento do acesso autorizado e a restauração após recarga no procedimento institucional de aceitação, sem contas fictícias. O gestor já entrou no sistema e o fluxo de 30 pontos do TESTE já foi validado; não refazer esses trabalhos para comprovar o que já foi confirmado.
- [ ] Concluir a conferência HTTP externa ainda bloqueada na máquina Codex, conforme [Verificação ORIGINAL](VERIFICACAO_ORIGINAL.md), sem contas/solicitações fictícias ou leitura de dados pessoais.

## Calendário de acompanhamento

O aplicativo calcula os dias pela data inicial comum, no fuso `America/Fortaleza` (UTC−3, igual ao horário de São Paulo neste período), e não pela data de aprovação de cada aluno.

| Dia | Data | Atividade prevista |
| --- | --- | --- |
| 1 | Quinta, 29/10/2026 | Cinco perguntas e um desafio do Dia 1 |
| 2 | Sexta, 30/10/2026 | Cinco perguntas e um desafio do Dia 2 |
| 3 | Sábado, 31/10/2026 | Cinco perguntas e um desafio do Dia 3 |
| 4 | Domingo, 01/11/2026 | Cinco perguntas e um desafio do Dia 4 |
| 5 | Segunda, 02/11/2026 | Cinco perguntas e um desafio do Dia 5 |
| 6 | Terça, 03/11/2026 | Cinco perguntas e um desafio do Dia 6 |
| 7 | Quarta, 04/11/2026 | Cinco perguntas e um desafio do Dia 7 |

Planejar suporte para o fim de semana e o feriado de 02/11. Não responder pelos estudantes ou inferir participação quando não houver registro.

O Dia 8, quinta-feira **05/11/2026**, permite exclusivamente recuperar o check-in do Dia 7; não há novas perguntas do Dia 8 nem novos desafios/conclusões nesse dia. Se essa recuperação for autorizada, a janela existente vai até 05/11 às 23:59:59 UTC−3. A aplicação fica fora do período depois disso. Se o protocolo exigir encerramento total em 04/11, a equipe deve decidir e autorizar administrativamente a suspensão da coleta naquele momento; o Codex não alterou essa configuração.

## Rotina diária da equipe

- [ ] Conferir acessos pendentes e identidade/elegibilidade antes de qualquer aprovação. Não permitir acesso em aparelho de outra pessoa sem o procedimento autorizado de compartilhamento.
- [ ] Orientar cinco respostas sinceras por dia, um check-in e um desafio por dia. O cronômetro é opcional e não conclui o desafio sozinho; a conclusão é manual.
- [ ] Explicar que cada check-in confirmado soma 10 pontos e cada desafio concluído soma 20; máximo de 210 em sete dias. A nota educativa 0–10 é diferente dos pontos de participação e não constitui diagnóstico.
- [ ] Em erro de conexão, preservar as respostas preenchidas, verificar o registro antes de tentar novamente e comunicar a equipe. Não criar um segundo cadastro/sessão para contornar o problema.
- [ ] Registrar ocorrências operacionais de forma mínima e protegida, sem senhas, tokens, respostas pessoais ou nomes em logs públicos. Não prometer relatórios agregados no painel: o painel atual gerencia participantes e acessos; a conferência de registros deve seguir o procedimento administrativo autorizado.
- [ ] Não modificar perguntas/desafios, retroagir datas ou preencher dias anteriores. A única recuperação implementada é a do Dia 7 no Dia 8.

## Encerramento

- [ ] Em 04/11, encerrar o acompanhamento dos sete dias e comunicar à equipe a situação dos registros efetivamente obtidos. Usar 05/11 apenas se a recuperação tiver sido autorizada.
- [ ] Após a janela autorizada, confirmar encerramento do período e não aprovar novas entradas. Qualquer alteração de `ativo` ou de acessos exige autorização administrativa aplicável; não excluir registros.
- [ ] Conferir integridade e quantidade dos registros apenas pelos acessos institucionais autorizados. Tratar ausências como ausências, sem inventar respostas, avaliações ou feedbacks.
- [ ] Fazer guarda/exportação somente conforme protocolo e permissões da equipe, preservando separação TESTE/ORIGINAL e política de retenção. Não anexar dados pessoais ao GitHub.
- [ ] Produzir análise e devolutiva somente depois da participação real. O prazo acadêmico estimado de 09/11 não autoriza declarar a pesquisa concluída antecipadamente.
