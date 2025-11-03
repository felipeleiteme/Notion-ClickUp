# Notion ↔ ClickUp Integrations

Documentação inicial do projeto responsável por integrar automações entre Notion e ClickUp.

## Visão Geral
- `src/clients/notion.ts`: cliente já autenticado do Notion via SDK oficial.
- `src/clients/clickup.ts`: cliente Axios configurado para a API do ClickUp.
- Pastas reservadas para lógica de negócio: `src/api/cron`, `src/core`, `src/mappers`.

## Requisitos
- Node.js 18+ e npm instalados.
- Variáveis de ambiente definidas:
  - `NOTION_API_KEY`
  - `CLICKUP_API_TOKEN`

Crie um arquivo `.env` na raiz e adicione:

```bash
NOTION_API_KEY=coloque_sua_chave_aqui
CLICKUP_API_TOKEN=coloque_seu_token_aqui
```

## Desenvolvimento
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Execute scripts futuros com `tsx` ou outra ferramenta conforme definidos nas próximas etapas.

## Próximos Passos
- Implementar casos de uso dentro de `src/core`.
- Definir rotinas no diretório `src/api/cron`.
- Criar mapeadores em `src/mappers` para alinhar estruturas Notion ↔ ClickUp.
