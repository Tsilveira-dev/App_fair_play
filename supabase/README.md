# Migrações sem dados de pesquisa

Estes arquivos **não foram executados em Supabase externo**. A validação usa PostgreSQL embutido PGlite, com `auth.users` e papéis locais de teste. Não representa inspeção do esquema ou das permissões atualmente publicados no Supabase.

| Arquivo | Aplicação |
| --- | --- |
| `migrations/001_schema.sql` | Projeto Supabase vazio. Cria as sete tabelas esperadas, restrições, referências e RLS. Recusa base existente sem a versão 001 registrada. Não cadastra participantes, gestores ou período de coleta. |
| `migrations/002_protecao.sql` | Após a baseline, ou em base existente compatível após comparação. Cria unicidade, RPC de tentativas, proteções transacionais e visão de pontuação; restringe acesso direto às tabelas. |

Ambos usam transações e podem ser reaplicados após instalação bem-sucedida. Falhas devem causar rollback, sem apagar ou corrigir dados automaticamente. Os testes confirmam que a baseline interrompe em banco preexistente sem alterar seus registros.

O arquivo [inspecionar_esquema.sql](inspecionar_esquema.sql) reúne consultas somente de metadados para auxiliar a comparação no SQL Editor de TESTE. Não consulta registros da pesquisa.

## Procedimento de revisão

1. Confirme o projeto pelo painel e a URL. TESTE é `jzxltkjxdefuptutpkfx`. O ORIGINAL deve ter outra referência. Não execute comandos recebidos nesta entrega no ORIGINAL sem aprovação específica.
2. Faça backup e obtenha **somente o esquema**, com ferramentas administrativas confiáveis. Compare colunas, tipos, defaults, índices, triggers, grants e policies com os arquivos. Não exporte respostas, nomes, tokens ou dados do Auth para o repositório.
3. Para projeto vazio, revise e execute `001`, depois `002`, no SQL Editor como administrador. Para projeto já utilizado, não rode `001`: compare o esquema, investigue diferenças e prepare ajustes aditivos antes de executar `002`. A entrega não presume compatibilidade com um esquema externo não inspecionado.
4. Índices únicos podem recusar duplicidades antigas. Resolva-as por procedimento aprovado pela equipe, preservando registros; a migração não contém `DELETE`, `TRUNCATE`, importação de fixtures ou atualização das respostas existentes.
5. `002` revoga acesso direto das roles `anon`, `authenticated` e `public` às tabelas da pesquisa. O gestor continua operando pelas APIs. A role `service_role` recebe somente os acessos usados no servidor; as funções auxiliares de trigger não ficam disponíveis como RPC pública.
6. Confira que Auth contém o campo `is_anonymous` e `raw_app_meta_data`, como no Supabase atual. Habilite login anônimo e por e-mail; registre um gestor real por administração segura e configure a data oficial da coleta separadamente. Não há seeds de pessoas ou contas nesta pasta.
7. Execute a validação de aceitação no TESTE antes de solicitar aprovação do ORIGINAL. Inspecione também grants/policies de outros objetos preexistentes não abrangidos por estas migrações.

A RPC de tentativas usa bloqueio transacional: 30 segundos por UID, dez por hora/UID e 300 por hora no total. Não há limpeza automática das tentativas. A equipe deve definir retenção conforme o protocolo; isso não autoriza excluir registros.

Os triggers validam participante ativo, sessão aprovada/não expirada, período e dia no momento da gravação. O check-in do Dia 7 pode ser recuperado no Dia 8. Desafios não são iniciados nem concluídos no Dia 8. A chave de unicidade é participante/dia, inclusive para dispositivos diferentes. A visão `fairplay_pontuacao` deriva dez pontos por check-in e vinte por desafio concluído.
