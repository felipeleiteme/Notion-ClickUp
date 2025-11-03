import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from '../clients/notion.js';
import {
  resetTeamsNotificationFlag,
  sendCompletionNotification,
} from './teamsNotificationService.js';

const isFullPageObjectResponse = (
  page: unknown,
): page is PageObjectResponse =>
  typeof page === 'object' &&
  !!page &&
  'object' in page &&
  (page as PageObjectResponse).object === 'page';

export const runTeamsSync = async (): Promise<void> => {
  console.log('== Iniciando sincronização (Teams)... ==');

  const notionDatabaseId = process.env.NOTION_DATABASE_ID;
  if (!notionDatabaseId) {
    throw new Error('Variável de ambiente NOTION_DATABASE_ID ausente.');
  }

  if (!process.env.TEAMS_WEBHOOK_URL) {
    console.warn('TEAMS_WEBHOOK_URL não definida. Pulando sync do Teams.');
    return;
  }

  const response = await notion.databases.query({
    database_id: notionDatabaseId,
    filter: {
      property: '[✅ Notificado Teams]',
      checkbox: {
        equals: true,
      },
    },
  });

  const pages = response.results.filter(isFullPageObjectResponse);

  if (pages.length === 0) {
    console.log('Nenhuma página marcada para notificar.');
    return;
  }

  console.log(`Encontradas ${pages.length} páginas para notificar.`);

  for (const page of pages) {
    try {
      await sendCompletionNotification(page);
      await resetTeamsNotificationFlag(page.id);
    } catch (error) {
      console.error(
        `Falha ao notificar Teams para página ${page.id}`,
        error,
      );
    }
  }

  console.log('== Sincronização (Teams) concluída. ==');
};
