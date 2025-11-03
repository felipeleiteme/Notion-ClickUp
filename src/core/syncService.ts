import 'dotenv/config';
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { notion } from '../clients/notion';
import { clickup } from '../clients/clickup';
import { mapNotionPageToClickupPayload } from '../mappers/notionToClickup';

const NOTION_FLAG_PROPERTY = '[➡️ Enviar p/ ClickUp]';
const CLICKUP_TASK_ID_PROPERTY = 'ClickUp Task ID';
const NOTION_SYNC_ERROR_PROPERTY = '[Sync Error]';
const NOTION_SYNC_ERROR_MESSAGE_PROPERTY = '[Sync Error Message]';

const assertEnv = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }

  return value;
};

const isFullPageObjectResponse = (
  page: PageObjectResponse | PartialPageObjectResponse,
): page is PageObjectResponse => page.object === 'page';

const getClickUpTaskIdFromPage = (
  page: PageObjectResponse,
): string | undefined => {
  const property = page.properties[CLICKUP_TASK_ID_PROPERTY];

  if (!property) {
    return undefined;
  }

  if (property.type === 'rich_text') {
    return property.rich_text[0]?.plain_text?.trim() || undefined;
  }

  if (property.type === 'url') {
    return property.url?.trim() || undefined;
  }

  if (property.type === 'title') {
    return property.title[0]?.plain_text?.trim() || undefined;
  }

  if (property.type === 'formula' && property.formula.type === 'string') {
    return property.formula.string?.trim() || undefined;
  }

  console.warn(
    `Propriedade ${CLICKUP_TASK_ID_PROPERTY} encontrada na página ${page.id}, ` +
      `mas o tipo ${property.type} não é suportado para leitura do ID.`,
  );

  return undefined;
};

const buildClickUpTaskIdPropertyUpdate = (
  page: PageObjectResponse,
  taskId: string,
) => {
  const property = page.properties[CLICKUP_TASK_ID_PROPERTY];

  if (!property) {
    console.warn(
      `Propriedade ${CLICKUP_TASK_ID_PROPERTY} não encontrada na página ${page.id}. ` +
        'Crie uma propriedade rich_text para armazenar o ID do ClickUp.',
    );
    return undefined;
  }

  if (property.type === 'rich_text') {
    return {
      rich_text: [
        {
          type: 'text' as const,
          text: { content: taskId },
        },
      ],
    };
  }

  if (property.type === 'url') {
    return {
      url: taskId,
    };
  }

  if (property.type === 'title') {
    return {
      title: [
        {
          type: 'text' as const,
          text: { content: taskId },
        },
      ],
    };
  }

  console.warn(
    `Propriedade ${CLICKUP_TASK_ID_PROPERTY} da página ${page.id} é do tipo ${property.type}, ` +
      'que não é suportado para atualização automática do ID.',
  );

  return undefined;
};

const updateNotionPageAfterSync = async (
  page: PageObjectResponse,
  taskId?: string,
) => {
  const properties: Record<string, any> = {
    [NOTION_FLAG_PROPERTY]: {
      checkbox: false,
    },
    [NOTION_SYNC_ERROR_PROPERTY]: {
      checkbox: false,
    },
    [NOTION_SYNC_ERROR_MESSAGE_PROPERTY]: {
      rich_text: [
        {
          type: 'text' as const,
          text: { content: '' },
        },
      ],
    },
  };

  if (taskId) {
    const taskIdProperty = buildClickUpTaskIdPropertyUpdate(page, taskId);
    if (taskIdProperty) {
      properties[CLICKUP_TASK_ID_PROPERTY] = taskIdProperty;
    }
  }

  await notion.pages.update({
    page_id: page.id,
    properties,
  });
};

const ensureSyncErrorPropertiesExist = async (databaseId: string) => {
  const database = await notion.databases.retrieve({
    database_id: databaseId,
  });

  const missingProperties: Record<string, any> = {};

  if (!database.properties[NOTION_SYNC_ERROR_PROPERTY]) {
    missingProperties[NOTION_SYNC_ERROR_PROPERTY] = {
      checkbox: {},
    };
  }

  if (!database.properties[NOTION_SYNC_ERROR_MESSAGE_PROPERTY]) {
    missingProperties[NOTION_SYNC_ERROR_MESSAGE_PROPERTY] = {
      rich_text: {},
    };
  }

  if (Object.keys(missingProperties).length === 0) {
    return;
  }

  await notion.databases.update({
    database_id: databaseId,
    properties: missingProperties,
  });
};

export async function runSync(): Promise<void> {
  const notionDatabaseId = assertEnv(
    process.env.NOTION_DATABASE_ID,
    'NOTION_DATABASE_ID',
  );
  const clickupListId = assertEnv(
    process.env.CLICKUP_LIST_ID,
    'CLICKUP_LIST_ID',
  );

  console.log('Buscando páginas no Notion...');

  await ensureSyncErrorPropertiesExist(notionDatabaseId);

  const response = await notion.databases.query({
    database_id: notionDatabaseId,
    filter: {
      property: NOTION_FLAG_PROPERTY,
      checkbox: {
        equals: true,
      },
    },
  });

  const pages = response.results.filter(isFullPageObjectResponse);

  if (pages.length === 0) {
    console.log('Nenhuma página marcada para sincronização.');
    return;
  }

  for (const page of pages) {
    try {
      console.log('Mapeando página:', page.id);

      const payload = mapNotionPageToClickupPayload(page);
      const existingClickUpTaskId = getClickUpTaskIdFromPage(page);

      if (existingClickUpTaskId) {
        console.log(
          `Atualizando tarefa existente no ClickUp (${existingClickUpTaskId})...`,
          payload,
        );
        await clickup.put(`task/${existingClickUpTaskId}`, payload);
        await updateNotionPageAfterSync(page, existingClickUpTaskId);
        continue;
      }

      console.log('Criando tarefa no ClickUp...', payload);
      const { data } = await clickup.post(`list/${clickupListId}/task`, payload);
      const createdTaskId = data?.id;
      if (!createdTaskId) {
        console.warn(
          `ID da tarefa criada não retornado para a página ${page.id}. ` +
            'Verifique o payload e permissões da integração.',
        );
      }

      console.log('Atualizando página no Notion...');
      await updateNotionPageAfterSync(page, createdTaskId);
    } catch (error) {
      console.error(`Falha ao sincronizar página ${page.id}`, error);

      try {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await notion.pages.update({
          page_id: page.id,
          properties: {
            [NOTION_FLAG_PROPERTY]: { checkbox: false },
            [NOTION_SYNC_ERROR_PROPERTY]: { checkbox: true },
            [NOTION_SYNC_ERROR_MESSAGE_PROPERTY]: {
              rich_text: [
                {
                  type: 'text' as const,
                  text: { content: errorMessage.substring(0, 100) },
                },
              ],
            },
          },
        });
      } catch (notifyError) {
        console.error(
          `Falha ao notificar erro no Notion para a página ${page.id}`,
          notifyError,
        );
      }
    }
  }

  console.log('Sincronização concluída.');
}
