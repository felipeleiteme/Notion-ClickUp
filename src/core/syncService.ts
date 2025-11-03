import 'dotenv/config';
import type {
  PageObjectResponse,
  PartialPageObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { notion } from '../clients/notion';
import { clickup } from '../clients/clickup';
import { mapNotionPageToClickupPayload } from '../mappers/notionToClickup';

const NOTION_FLAG_PROPERTY = '[➡️ Enviar p/ ClickUp]';

const assertEnv = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }

  return value;
};

const isFullPageObjectResponse = (
  page: PageObjectResponse | PartialPageObjectResponse,
): page is PageObjectResponse => page.object === 'page';

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

  for (const page of pages) {
    try {
      console.log('Mapeando página:', page.id);

      const payload = mapNotionPageToClickupPayload(page);

      console.log('Criando tarefa no ClickUp...', payload);
      await clickup.post(`list/${clickupListId}/task`, payload);

      console.log('Limpando flag no Notion...');
      await notion.pages.update({
        page_id: page.id,
        properties: {
          [NOTION_FLAG_PROPERTY]: {
            checkbox: false,
          },
        },
      });
    } catch (error) {
      console.error(`Falha ao sincronizar página ${page.id}`, error);
    }
  }

  console.log('Sincronização concluída.');
}
