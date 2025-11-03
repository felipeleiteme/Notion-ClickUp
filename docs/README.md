# Notion ↔ ClickUp Integrations

Automação para sincronizar páginas do Notion em tarefas do ClickUp.

## Visão Geral
- `src/clients/notion.ts`: cliente autenticado do Notion SDK.
- `src/clients/clickup.ts`: cliente Axios configurado para a API do ClickUp.
- `src/mappers/notionToClickup.ts`: traduz uma página do Notion para payload de criação de tarefa.
- `src/core/syncService.ts`: orquestra consulta ao Notion, criação no ClickUp e limpeza da flag.
- `src/api/cron/sync-notion.ts`: ponto de entrada para rodar o job manualmente ou via cron.

## Requisitos
- Node.js 18+ e npm instalados.
- Variáveis de ambiente definidas:
  - `NOTION_API_KEY`
  - `NOTION_DATABASE_ID`
  - `CLICKUP_API_TOKEN`
  - `CLICKUP_LIST_ID`

Crie um arquivo `.env` na raiz e adicione:

```bash
NOTION_API_KEY=coloque_sua_chave_aqui
NOTION_DATABASE_ID=coloque_seu_database_id_aqui
CLICKUP_API_TOKEN=coloque_seu_token_aqui
CLICKUP_LIST_ID=coloque_seu_list_id_aqui
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

## Automação (GitHub Actions)
- Workflow em `.github/workflows/sync.yml`.
- Executa a cada hora (`0 * * * *`) ou manualmente via *workflow dispatch*.
- Configure os *secrets* `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` no repositório antes de habilitar o job.

## Estrutura Próxima
- Adicionar testes unitários/mocks para o serviço de sincronização.
- Configurar monitoramento/alertas para falhas no workflow.
