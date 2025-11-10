import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export const CLICKUP_TASK_ID_PROPERTY = 'ClickUp Task ID';

export const getClickUpTaskIdFromPage = (
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

export const buildClickUpTaskIdPropertyUpdate = (
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
