# Notion ↔ ClickUp Integrations

Automação para sincronizar páginas do Notion em tarefas do ClickUp.

## Visão Geral
- `src/clients/notion.ts`: cliente autenticado do Notion SDK.
- `src/clients/clickup.ts`: cliente Axios configurado para a API do ClickUp.
- `src/mappers/notionToClickup.ts`: traduz uma página do Notion para payload de criação de tarefa (nome, status, prioridade e responsáveis).
- `src/mappers/userMap.ts`: dicionário de usuários (Notion → ClickUp) usado para atribuir responsáveis.
- `src/core/syncService.ts`: orquestra consulta ao Notion, criação no ClickUp e limpeza da flag.
- `src/api/cron/sync-notion.ts`: ponto de entrada para rodar o job manualmente.
- `src/api/cron/sync-scheduler.ts`: agendador em Node que dispara `runSync` periodicamente via `node-cron`.

## Requisitos
- Node.js 18+ e npm instalados.
- Variáveis de ambiente definidas:
  - `NOTION_API_KEY`
  - `NOTION_DATABASE_ID`
  - `CLICKUP_API_TOKEN`
  - `CLICKUP_LIST_ID`
  - `SYNC_CRON_EXPRESSION` (opcional - padrão `*/10 * * * *`)
  - `SYNC_TIMEZONE` (opcional - ex: `America/Sao_Paulo`)
  - `SYNC_RUN_ON_BOOT` (opcional - `true` por padrão)
- Banco do Notion com a propriedade rich_text **`ClickUp Task ID`** para armazenar o identificador da tarefa sincronizada. O serviço preenche e reutiliza esse valor automaticamente.

Crie um arquivo `.env` na raiz e adicione:

```bash
NOTION_API_KEY=coloque_sua_chave_aqui
NOTION_DATABASE_ID=coloque_seu_database_id_aqui
CLICKUP_API_TOKEN=coloque_seu_token_aqui
CLICKUP_LIST_ID=coloque_seu_list_id_aqui
# Opcional: agendador local (cron)
SYNC_CRON_EXPRESSION=* * * * *
SYNC_TIMEZONE=America/Sao_Paulo
SYNC_RUN_ON_BOOT=true
```

## Desenvolvimento
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Rode a sincronização localmente:
   ```bash
   npm run sync
   ```
   - Executa uma sincronização única usando o entrypoint `src/api/cron/sync-notion.ts`.
3. Execute o cron local (opcional):
   ```bash
   npm run cron:sync
   ```
   - Mantém o processo ativo, acionando `runSync` conforme `SYNC_CRON_EXPRESSION` (padrão: a cada 1 min).
   - Respeita `SYNC_TIMEZONE` e evita execuções concorrentes.
   - Se a página já possui valor em **`ClickUp Task ID`**, o job atualiza a tarefa existente no ClickUp em vez de criar uma nova.


## Configuração do Notion
- Banco deve expor a propriedade de checkbox **`[➡️ Enviar p/ ClickUp]`** (true → envia).
- Adicione uma coluna *Rich text* chamada **`ClickUp Task ID`** (sem preencher manualmente). Ela será populada com o ID retornado pelo ClickUp e reutilizada para atualizações.
  - ⚠️ Não utilize tipos `Unique ID`, `Número` ou `Fórmula` para esse campo. Se já existir uma coluna com outro tipo, crie uma nova *Rich text* com o mesmo nome e remova a antiga para evitar duplicações.
- Coluna de título: `Nome` (PT) ou `Name` (EN).
- Coluna de projeto (select ou multi-select): `Projetos`, `Projetos do Notion`, `Projeto` ou `Projects`. O primeiro valor será usado para compor o título no formato `Task :: Projeto | Nome`.
- Coluna de responsável pode ser do tipo pessoas ou multi-select com nomes/e-mails. Suportamos chaves: `Dono`, `Donos`, `Owner`, `Responsável`, `Responsaveis`, `Responsáveis`, `Assignee`, `Assignees`. Caso use outro nome/valor, basta incluir no `userMap`.
- Coluna de status (select/status) chamada `Status`. Valores mapeados:
  - `QA (WIP 3)` → `qa`
  - `Deploy` → `deploy`
  - `Concluído` → `done`
  - Demais valores caem no status padrão `in progress`.

## Automação (GitHub Actions)
- Workflow em `.github/workflows/sync.yml`.
- Executa a cada hora (`0 * * * *`) ou manualmente via *workflow dispatch*.
- Configure os *secrets* `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` no repositório antes de habilitar o job.
- Toda execução respeita o valor de **`ClickUp Task ID`**: se existir, o fluxo apenas atualiza a tarefa correspondente e limpa a flag; se estiver vazio, cria a tarefa e armazena o ID.
- Caso a coluna esteja com tipo diferente de *Rich text*, o workflow irá registrar logs informando o problema e continuará gerando novas tasks. Ajuste o tipo para evitar duplicidades.

## Estrutura Próxima
- Adicionar testes unitários/mocks para o serviço de sincronização.
- Configurar monitoramento/alertas para falhas no workflow.
