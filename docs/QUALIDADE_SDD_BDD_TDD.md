# Processo de qualidade — Fair Play

## Objetivo e limites

Aplicar **SDD (Specification-Driven Development, desenvolvimento orientado por especificação)**, **BDD (Behavior-Driven Development, desenvolvimento orientado por comportamento)** e **TDD (Test-Driven Development, desenvolvimento orientado por testes)** como etapas complementares. Nenhum processo elimina todos os defeitos; o objetivo é detectar regressões antes da publicação.

**O projeto ORIGINAL está em coleta.** Não alterar dados reais, datas de participantes, Auth, RLS, migrações, variáveis de produção ou domínio por execução automatizada. Usar dados sintéticos e o ambiente TESTE. Toda publicação em ORIGINAL exige revisão e autorização específicas.

## 1 — SDD: especificar ANTES de alterar

Para cada mudança, abrir uma issue ou uma seção de proposta com:
- **ID**, problema reproduzível, público afetado e objetivo.
- **Comportamento atual / esperado**, regras de negócio, datas e fuso `America/Fortaleza`.
- **Contrato** de interface e API (requisição, resposta, erros, autorização, persistência).
- **Dados e segurança:** se a alteração toca sessão, banco ou informações de estudantes; estratégia para preservar histórico.
- **Critérios de aceite** observáveis e plano de reversão.

Se alterar uma regra aprovada, revisar primeiro a especificação e o cenário BDD correspondente. Se houver divergência entre código e especificação, não alterar o banco para fazer o teste passar sem investigar.

## 2 — BDD: escrever os comportamentos

Descrever cada comportamento com **Dado / Quando / Então**, incluindo um cenário positivo, um de erro e um limite. Os cenários em `features/` são a linguagem compartilhada da equipe e devem ter cobertura correspondente em `tests/*.test.mjs`. Arquivos `.feature` **não são executados automaticamente** pelo runner Node: exigir o teste automatizado de verdade para cada cenário crítico.

## 3 — TDD: ciclo RED → GREEN → REFACTOR

1. **RED**: adicionar teste específico que falhe pelo comportamento ausente e registrar a falha esperada.
2. **GREEN**: implementar a menor mudança que faça o teste passar.
3. **REFACTOR**: melhorar nomes/estrutura sem mudar o resultado; executar `npm run check` novamente.
4. Adicionar testes de regressão para qualquer erro que tenha sido reportado em produção; não substituir testes por mocks que assumam o sucesso.
5. Fazer revisão por outra pessoa antes do merge.

## Invariantes do Fair Play (não regredir)

- Período de 7 dias, cinco perguntas diferentes por dia; o servidor determina o dia e valida IDs D01…D07. Não reiniciar o calendário para cada participante.
- Um check-in por estudante/dia. No Dia 8 somente recuperação do Dia 7 quando permitida.
- Check-in confirmado: +10; desafio concluído: +20; cronômetro opcional, sem pontuação automática.
- Cadastro pelo primeiro nome **não é credencial de autenticação**. Acesso depende de sessão Auth anônima associada e aprovação do gestor. Não conceder acesso apenas pelo nome, evitando exposição de respostas de estudantes.
- Interface exibe estado de acesso correto e mensagens úteis para troca de aparelho ou navegador.
- Separação física e de configuração entre Supabase TESTE e ORIGINAL; nenhuma chave secreta no frontend.

## Matriz mínima de rastreabilidade

| Requisito | BDD | TDD / verificação |
| --- | --- | --- |
| FP-01 — dia do questionário | `features/questionario-diario.feature` | testar 27/10 como D01, 28/10 como D02, virada de mês e renderização no cliente; validar IDs no servidor |
| FP-02 — acesso por sessão | `features/acesso-participante.feature` | sessão aprovada entra, sessão nova não herda autorização pelo nome, sessão pendente aguarda |
| FP-03 — persistência | `features/checkin-persistencia.feature` | recarregar mantém respostas confirmadas; envio duplicado não gera dois registros |
| FP-04 — pontuação | `features/checkin-persistencia.feature` | +10 confirmado, +20 somente por desafio concluído, total não duplica |
| FP-05 — proteção da produção | políticas de CI deste repositório | `npm run check` em PRs e push; revisão humana antes do deploy |

## Fluxo de pull request

1. Especificação e cenário BDD aprovados.
2. Teste RED → implementação GREEN → REFACTOR.
3. `npm ci` e `npm run check` localmente.
4. PR para `main` com lista de requisitos, cenário, evidências de testes, impacto no banco e rollback.
5. CI verde e revisão manual; quando houver mudança de interface, teste real em celular e revisão de responsividade.
6. Se a alteração tocar autenticação, data, API ou Supabase, verificar integração no TESTE (sem copiar dados do ORIGINAL).
7. Publicar na Vercel ORIGINAL **somente após aprovação específica**, preferindo manutenção fora da coleta. Conferir logs e comportamento após deploy.

## Configurações adicionais necessárias

O arquivo `.github/workflows/test.yml` executa a suíte em PRs e na `main`, mas **isso não obriga o GitHub a bloquear merges**. No GitHub: Settings → Branches ou Rulesets → proteger `main`, exigir PR, pelo menos uma revisão e o check **test** do workflow “Validar Fair Play”; restringir bypass. Na Vercel: validar o domínio TESTE com preview primeiro e garantir que somente a branch de produção autorizada publica em ORIGINAL. Verificar que GitHub não permite publicar automaticamente uma alteração não revisada.

## Gestão de erros

Ao receber erro: registrar aparelho/navegador, data e hora com fuso, texto da tela e cenário; nunca solicitar tokens ou senhas; reproduzir com dados de teste; criar teste de regressão; corrigir; revisar; publicar; observar. Evitar corrigir diretamente dados históricos para mascarar defeitos.
