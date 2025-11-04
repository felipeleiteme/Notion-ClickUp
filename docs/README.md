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
- `src/api/cron/sync-teams.ts`: job que monitora o checkbox `[✅ Notificado Teams]` e dispara notificações para o Microsoft Teams.
- `src/core/teamsNotificationService.ts`: formata as mensagens de conclusão, menciona os responsáveis no Teams e reseta o checkbox.
- `src/core/teamsSyncJob.ts`: encapsula a lógica de sincronização com o Teams para reuso em scripts/cron.

## Requisitos
- Node.js 18+ e npm instalados.
- Variáveis de ambiente definidas:
  - `NOTION_API_KEY`
  - `NOTION_DATABASE_ID`
  - `CLICKUP_API_TOKEN`
  - `CLICKUP_LIST_ID`
  - `TEAMS_WEBHOOK_URL`
  - `SYNC_CRON_EXPRESSION` (opcional - fallback `*/10 * * * *` se não definido)
  - `SYNC_TIMEZONE` (opcional - ex: `America/Sao_Paulo`)
  - `SYNC_RUN_ON_BOOT` (opcional - `true` por padrão)
  - `TEAMS_SYNC_ENABLED` (opcional - `true` por padrão)
  - `TEAMS_SYNC_CRON_EXPRESSION` (opcional - fallback `*/10 * * * *` se não definido)
  - `TEAMS_SYNC_TIMEZONE` (opcional)
  - `TEAMS_SYNC_RUN_ON_BOOT` (opcional - `true` por padrão)
- Banco do Notion com a propriedade rich_text **`ClickUp Task ID`** para armazenar o identificador da tarefa sincronizada. O serviço preenche e reutiliza esse valor automaticamente.

Crie um arquivo `.env` na raiz e adicione:

```bash
NOTION_API_KEY=coloque_sua_chave_aqui
NOTION_DATABASE_ID=coloque_seu_database_id_aqui
CLICKUP_API_TOKEN=coloque_seu_token_aqui
CLICKUP_LIST_ID=coloque_seu_list_id_aqui
TEAMS_WEBHOOK_URL=https://sua-org.webhook.office.com/webhookb2/...
# Opcional: agendador local (cron) - exemplo rodando a cada minuto
SYNC_CRON_EXPRESSION=* * * * *
SYNC_TIMEZONE=America/Sao_Paulo
SYNC_RUN_ON_BOOT=true
TEAMS_SYNC_ENABLED=true
TEAMS_SYNC_CRON_EXPRESSION=* * * * *
TEAMS_SYNC_TIMEZONE=America/Sao_Paulo
TEAMS_SYNC_RUN_ON_BOOT=true
```
> Se você remover as variáveis `SYNC_CRON_EXPRESSION` e `TEAMS_SYNC_CRON_EXPRESSION`, o serviço usa o fallback padrão de 10 em 10 minutos.

## Desenvolvimento
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Rode a sincronização localmente:
   ```bash
    cd "/Users/Felipe/Documents/Projetos/Integrações/Notion-ClickUp"
     npm run sync
   ```
   - Executa uma sincronização única usando o entrypoint `src/api/cron/sync-notion.ts`.
3. Execute o cron local (opcional):
   ```bash
   cd "/Users/Felipe/Documents/Projetos/Integrações/Notion-ClickUp"
  npm run cron:sync
   ```
   - Mantém o processo ativo, acionando o fluxo do ClickUp conforme `SYNC_CRON_EXPRESSION` e, se habilitado (`TEAMS_SYNC_ENABLED=true`), o fluxo do Teams conforme `TEAMS_SYNC_CRON_EXPRESSION`.
   - Respeita cada `TIMEZONE` configurado e evita execuções concorrentes para ambos os jobs.
   - Se a página já possui valor em **`ClickUp Task ID`**, o job atualiza a tarefa existente no ClickUp em vez de criar uma nova.
4. Disparar notificações do Teams manualmente (opcional):
   ```bash
   cd "/Users/Felipe/Documents/Projetos/Integrações/Notion-ClickUp"
   npm run sync:teams
   ```
   - Consulta páginas com **`[✅ Notificado Teams]`** marcado, envia mensagem para o Teams e limpa o checkbox após o envio para evitar duplicações.

## Speed Insights
- A landing page está em `public/index.html` e injeta automaticamente o Vercel Speed Insights via `public/main.js`.
- Sempre que ajustar `src/web/main.ts`, execute `npm run build:web` para gerar o bundle antes do deploy.
- O bundle é commitado no repositório para que a Vercel sirva o arquivo estático sem etapa de build adicional.


## Configuração do Notion
- Banco deve expor a propriedade de checkbox **`[➡️ Enviar p/ ClickUp]`** (true → envia).
- Adicione uma coluna *Rich text* chamada **`ClickUp Task ID`** (sem preencher manualmente). Ela será populada com o ID retornado pelo ClickUp e reutilizada para atualizações.
- ⚠️ Para a coluna **`ClickUp Task ID`**, não utilize tipos `Unique ID`, `Número` ou `Fórmula`. Se já existir uma coluna com outro tipo, crie uma nova *Rich text* com o mesmo nome e remova a antiga para evitar duplicações.
- Coluna de título: `Nome` (PT) ou `Name` (EN).
- Coluna de projeto (select ou multi-select): `Projetos`, `Projetos do Notion`, `Projeto` ou `Projects`. O primeiro valor será usado para compor o título no formato `Task :: Projeto | Nome`.
- Coluna de responsável pode ser do tipo pessoas ou multi-select com nomes/e-mails. Suportamos chaves: `Dono`, `Donos`, `Owner`, `Responsável`, `Responsaveis`, `Responsáveis`, `Assignee`, `Assignees`. Caso use outro nome/valor, basta incluir no `userMap`.
- Coluna de status (select/status) chamada `Status`. Valores mapeados:
  - `QA (WIP 3)` → `qa`
  - `Deploy` → `deploy`
  - `Concluído` → `done`
  - Demais valores caem no status padrão `in progress`.
- Para notificações do Teams, adicione a coluna de checkbox **`[✅ Notificado Teams]`**. Quando marcada manualmente, o job `sync-teams` enviará a mensagem para o canal configurado, mencionará Andreia e Gisele e redefinirá o checkbox para `false` após o envio.

### Comportamento em caso de falhas na sync
- Se ocorrer erro ao criar/atualizar a tarefa no ClickUp, o processo apenas desmarca **`[➡️ Enviar p/ ClickUp]`** para impedir novas tentativas automáticas.
- Corrija a causa da falha (por exemplo, ID inválido no ClickUp) e marque novamente **`[➡️ Enviar p/ ClickUp]`** para reprocessar.

## Automação (GitHub Actions)
- Workflow em `.github/workflows/sync.yml`.
- Executa a cada hora (`0 * * * *`) ou manualmente via *workflow dispatch*.
- Configure os *secrets* `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID` no repositório antes de habilitar o job.
- Toda execução respeita o valor de **`ClickUp Task ID`**: se existir, o fluxo apenas atualiza a tarefa correspondente e limpa a flag; se estiver vazio, cria a tarefa e armazena o ID.
- Caso a coluna esteja com tipo diferente de *Rich text*, o workflow irá registrar logs informando o problema e continuará gerando novas tasks. Ajuste o tipo para evitar duplicidades.

## Deploy na Vercel
1. Instale o CLI (`npm i -g vercel`) e autentique com `vercel login`.
2. Aponte o projeto local para a Vercel com `vercel link` (use a opção *Import Existing Project* se o projeto ainda não existir).
3. Defina as variáveis de ambiente (todas as usadas no `.env`) com `vercel env add <NOME>` ou via dashboard.
4. Faça o primeiro deploy manual executando `vercel --prod` (o CLI usará `vercel.json` e criará as functions `api/sync` e `api/sync-teams` automaticamente).
5. Em contas Hobby os cron jobs ficam limitados a uma execução diária, então `vercel.json` agenda ambos para `0 3 * * *` (03h00 UTC). Ajuste a expressão se fizer upgrade para o plano Pro. Para desativar o Teams, defina `TEAMS_SYNC_ENABLED=false` nas variáveis de ambiente ou remova o cron correspondente. Após o deploy, valide acessando `https://<seu-domínio>/api/sync` (e `/api/sync-teams`) para verificar a resposta `{ ok: true }`.

## Estrutura Próxima
- Adicionar testes unitários/mocks para o serviço de sincronização.
- Configurar monitoramento/alertas para falhas no workflow.
