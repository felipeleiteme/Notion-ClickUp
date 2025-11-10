import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { teams } from '../clients/teams';
import { getFormattedTaskName } from '../mappers/notionToClickup';
import { notion } from '../clients/notion';
import { getClickUpTaskIdFromPage } from './notionProperties';
import { notifyRecipientsByEmail } from '../services/notificationService';

const ALWAYS_NOTIFY_USERS = [
  {
    upn: 'andreia.dias@cashforce.com.br',
    displayName: 'Andreia Dias',
  },
  {
    upn: 'gisele.almeida@cashforce.com.br',
    displayName: 'Gisele Almeida',
  },
] as const;
const MEDIA_PROPERTY_KEYS = ['Arquivos e mídia', 'Files & media'] as const;
const DESCRIPTION_PROPERTY_KEYS = [
  'Descrição da necessidade',
  'Descrição',
  'Description',
] as const;

type NotionPropertyValue = PageObjectResponse['properties'][string];
type FilesProperty = Extract<NotionPropertyValue, { type: 'files' }>;
type FileDescriptor = FilesProperty['files'][number];
type RichTextProperty = Extract<NotionPropertyValue, { type: 'rich_text' }>;

const extractFileUrl = (file: FileDescriptor | undefined): string | undefined => {
  if (!file) {
    return undefined;
  }

  if ('external' in file) {
    return file.external.url;
  }

  if ('file' in file) {
    return file.file.url;
  }

  return undefined;
};

const getMediaUrl = (page: PageObjectResponse): string | undefined => {
  for (const key of MEDIA_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (property && property.type === 'files') {
      return extractFileUrl(property.files[0]);
    }
  }

  const fallbackProperty = Object.values(page.properties).find(
    (prop): prop is FilesProperty => prop?.type === 'files',
  );

  if (!fallbackProperty) {
    return undefined;
  }

  console.warn(
    `Propriedade "${MEDIA_PROPERTY_KEYS.join('" / "')}" não encontrada. ` +
      'Usando primeira propriedade de arquivos disponível.',
  );

  return extractFileUrl(fallbackProperty.files[0]);
};

const buildTeamsPayload = (
  taskName: string,
  imageUrl: string | undefined,
  notifyUsers: ReadonlyArray<{ upn: string; displayName: string }>,
  description: string | undefined,
) => {
  const mentionDescriptors = notifyUsers.map(({ upn, displayName }) => {
    const tag = `<at>${displayName}</at>`;
    return {
      placeholder: tag,
      entity: {
        type: 'mention' as const,
        text: tag,
        mentioned: {
          id: upn,
          name: displayName,
        },
      },
    };
  });

  const completionHeadline = `**Tarefa Concluída: ${taskName}${
    description ? ` [${description}]` : ''
  }**`;

  return {
    text: imageUrl
      ? `${completionHeadline}\nClique no link para visualizar o contexto da solicitação: [Visualizar imagem](${imageUrl})`
      : completionHeadline,
    entities:
      mentionDescriptors.length > 0
        ? mentionDescriptors.map((descriptor) => descriptor.entity)
        : undefined,
  };
};

const collapseRichText = (property: RichTextProperty): string | undefined => {
  const value = property.rich_text
    .map((fragment) => fragment.plain_text ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return value.length > 0 ? value : undefined;
};

const getDescription = (page: PageObjectResponse): string | undefined => {
  for (const key of DESCRIPTION_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (property && property.type === 'rich_text') {
      const value = collapseRichText(property);
      if (value) {
        return value;
      }
    }
  }

  const fallbackProperty = Object.values(page.properties).find(
    (prop): prop is RichTextProperty => prop?.type === 'rich_text',
  );

  if (!fallbackProperty) {
    return undefined;
  }

  console.warn(
    `Propriedade "${DESCRIPTION_PROPERTY_KEYS.join('" / "')}" não encontrada. ` +
      'Usando primeira propriedade rich_text disponível como descrição.',
  );

  return collapseRichText(fallbackProperty);
};

export const sendCompletionNotification = async (
  page: PageObjectResponse,
) => {
  if (!teams.defaults.baseURL) {
    throw new Error(
      'TEAMS_WEBHOOK_URL não configurada. Notificações do Teams não podem ser enviadas.',
    );
  }

  console.log(`Formatando notificação do Teams para página ${page.id}`);

  const taskName = getFormattedTaskName(page);
  const clickUpTaskId = getClickUpTaskIdFromPage(page);
  const mediaUrl = getMediaUrl(page);
  const description = getDescription(page);

  const payload = buildTeamsPayload(
    taskName,
    mediaUrl,
    ALWAYS_NOTIFY_USERS,
    description,
  );

  await teams.post('', payload);

  console.log(`Notificação do Teams enviada para ${page.id}`);

  if (clickUpTaskId) {
    await notifyRecipientsByEmail({
      taskId: clickUpTaskId,
      taskName,
      action: 'teams_notified',
    });
  } else {
    console.warn(
      `Página ${page.id} notificada no Teams sem ClickUp Task ID. Pulei o envio de email.`,
    );
  }
};

export const resetTeamsNotificationFlag = async (pageId: string) => {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      '[✅ Notificado Teams]': {
        checkbox: false,
      },
    },
  });
};
