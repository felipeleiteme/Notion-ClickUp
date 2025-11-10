import 'dotenv/config';
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
  DatabaseObjectResponse,
  PartialDatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { notion } from '../clients/notion';
import { clickup } from '../clients/clickup';
import {
  mapNotionPageToClickupPayload,
  getDescriptionFromPage,
} from '../mappers/notionToClickup';
import {
  buildClickUpTaskIdPropertyUpdate,
  CLICKUP_TASK_ID_PROPERTY,
  getClickUpTaskIdFromPage,
} from './notionProperties';
import { sendNotifications } from '../services/notificationService';

const NOTION_FLAG_PROPERTY = '[➡️ Enviar p/ ClickUp]';
const assertEnv = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }

  return value;
};

const isFullPageObjectResponse = (
  page:
    | PageObjectResponse
    | PartialPageObjectResponse
    | PartialDatabaseObjectResponse
    | DatabaseObjectResponse,
): page is PageObjectResponse => page.object === 'page';

const updateNotionPageAfterSync = async (
  page: PageObjectResponse,
  taskId?: string,
) => {
  const properties: Record<string, any> = {
    [NOTION_FLAG_PROPERTY]: {
      checkbox: false,
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

const addCommentToClickUpTask = async (
  taskId: string,
  comment: string,
): Promise<void> => {
  try {
    await clickup.post(`task/${taskId}/comment`, {
      comment_text: comment,
    });
    console.log(`Comentário adicionado à tarefa ${taskId}.`);
  } catch (error) {
    console.error(
      `Falha ao adicionar comentário à tarefa ${taskId}:`,
      error,
    );
  }
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

  const syncedTasks: Array<{
    taskId: string;
    taskName: string;
    action: 'created' | 'updated';
  }> = [];

  const getTaskName = (page: PageObjectResponse): string => {
    const titleProperty = Object.values(page.properties).find(
      (prop) => prop.type === 'title',
    );
    if (titleProperty && titleProperty.type === 'title') {
      return (
        titleProperty.title.map((t) => t.plain_text).join('') || 'Sem título'
      );
    }
    return 'Sem título';
  };

  for (const page of pages) {
    try {
      console.log('Mapeando página:', page.id);

      const payload = mapNotionPageToClickupPayload(page);
      const existingClickUpTaskId = getClickUpTaskIdFromPage(page);
      const description = getDescriptionFromPage(page);

      if (existingClickUpTaskId) {
        console.log(
          `Atualizando tarefa existente no ClickUp (${existingClickUpTaskId})...`,
          payload,
        );
        await clickup.put(`task/${existingClickUpTaskId}`, payload);

        if (description) {
          await addCommentToClickUpTask(existingClickUpTaskId, description);
        }

        await updateNotionPageAfterSync(page, existingClickUpTaskId);

        syncedTasks.push({
          taskId: existingClickUpTaskId,
          taskName: getTaskName(page),
          action: 'updated',
        });
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

      if (createdTaskId && description) {
        await addCommentToClickUpTask(createdTaskId, description);
      }

      console.log('Atualizando página no Notion...');
      await updateNotionPageAfterSync(page, createdTaskId);

      if (createdTaskId) {
        syncedTasks.push({
          taskId: createdTaskId,
          taskName: getTaskName(page),
          action: 'created',
        });
      }
    } catch (error) {
      console.error(`Falha ao sincronizar página ${page.id}`, error);

      try {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            [NOTION_FLAG_PROPERTY]: { checkbox: false },
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

  await sendNotifications(syncedTasks);
}
