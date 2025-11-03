// src/mappers/notionToClickup.ts
import type {
  PageObjectResponse,
  PartialUserObjectResponse,
  UserObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NOTION_TO_CLICKUP_USER_MAP } from './userMap';

const DEFAULT_TITLE_PREFIX = 'Task ::';
const DEFAULT_CLICKUP_STATUS = 'in progress';

const PROJECT_PROPERTY_KEYS = [
  'Projetos',
  'Projetos do Notion',
  'Projeto',
  'Projects',
] as const;

const OWNER_PROPERTY_KEYS = [
  'Dono',
  'Donos',
  'Owner',
  'Responsável',
  'Responsaveis',
  'Responsáveis',
  'Assignee',
  'Assignees',
] as const;

const STATUS_PROPERTY_KEYS = [
  'Status',
  'Status Notion',
  'Status - Notion',
  'Status (Notion)',
] as const;

const TITLE_PROPERTY_KEYS = ['Nome', 'Name'] as const;

const STATUS_MAP: Record<string, string> = {
  'QA (WIP 3)': 'qa',
  Deploy: 'deploy',
  'Concluído': 'done',
};

interface ClickUpTaskPayload {
  name: string;
  status: string;
  assignees?: number[];
  priority?: number;
}

type NotionPropertyValue = PageObjectResponse['properties'][string];
type PeopleProperty = Extract<NotionPropertyValue, { type: 'people' }>;
type MultiSelectProperty = Extract<NotionPropertyValue, { type: 'multi_select' }>;
type SelectProperty = Extract<NotionPropertyValue, { type: 'select' }>;
type StatusProperty = Extract<
  NotionPropertyValue,
  { type: 'status' } | { type: 'select' } | { type: 'multi_select' }
>;
type TitleProperty = Extract<NotionPropertyValue, { type: 'title' }>;

type OwnerProperty = PeopleProperty | MultiSelectProperty;
type ProjectProperty = SelectProperty | MultiSelectProperty;

const isOwnerProperty = (
  property: NotionPropertyValue | undefined,
): property is OwnerProperty =>
  !!property &&
  (property.type === 'people' || property.type === 'multi_select');

const isProjectProperty = (
  property: NotionPropertyValue | undefined,
): property is ProjectProperty =>
  !!property &&
  (property.type === 'select' || property.type === 'multi_select');

const isStatusProperty = (
  property: NotionPropertyValue | undefined,
): property is StatusProperty =>
  !!property &&
  (property.type === 'status' ||
    property.type === 'select' ||
    property.type === 'multi_select');

const isTitleProperty = (
  property: NotionPropertyValue | undefined,
): property is TitleProperty => !!property && property.type === 'title';

const getEmailFromUser = (
  user: PartialUserObjectResponse | UserObjectResponse,
): string | undefined => {
  if ('type' in user && user.type === 'person') {
    return user.person?.email ?? undefined;
  }
  return undefined;
};

export const getOwnerProperty = (
  page: PageObjectResponse,
): OwnerProperty | undefined => {
  const ownerPropertyFromKeys = OWNER_PROPERTY_KEYS.reduce<
    OwnerProperty | undefined
  >((found, key) => {
    if (found) {
      return found;
    }

    const property = page.properties[key];
    return isOwnerProperty(property) ? property : undefined;
  }, undefined);

  if (ownerPropertyFromKeys) {
    return ownerPropertyFromKeys;
  }

  const fallbackOwnerProperty = Object.values(page.properties).find(
    (property): property is OwnerProperty => isOwnerProperty(property),
  );

  if (!fallbackOwnerProperty) {
    console.warn(`Nenhum responsável encontrado para a página ${page.id}.`);
    return undefined;
  }

  console.warn(
    `Utilizando a primeira propriedade de responsável encontrada na página ${page.id}. Verifique se está correto.`,
  );

  return fallbackOwnerProperty;
};

export const getNotionUserKeys = (property?: OwnerProperty): string[] => {
  if (!property) {
    return [];
  }

  if (property.type === 'people') {
    return property.people
      .map((person) => {
        const notionEmail = getEmailFromUser(person);

        if (!notionEmail) {
          console.warn('Pessoa na propriedade de responsável sem e-mail.');
        }

        return notionEmail;
      })
      .filter((email): email is string => typeof email === 'string');
  }

  if (property.type === 'multi_select') {
    const labels = property.multi_select
      .map((option) => option.name)
      .filter((name): name is string => typeof name === 'string' && !!name);

    if (labels.length === 0) {
      console.warn(
        'Propriedade de multi-select encontrada, mas sem valores preenchidos.',
      );
    }

    return labels;
  }

  return [];
};

const resolveClickUpAssignees = (keys: string[]): number[] | undefined => {
  const mappedIds = keys
    .map((key) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return undefined;
      }

      const userMapping = NOTION_TO_CLICKUP_USER_MAP[trimmedKey];
      const clickupUserId = userMapping?.clickupId;

      if (typeof clickupUserId === 'number') {
        console.log(
          `Mapeando identificador ${trimmedKey} para ClickUp ID ${clickupUserId}`,
        );
        return clickupUserId;
      }

      if (userMapping) {
        console.warn(
          `Identificador ${trimmedKey} mapeado, mas sem ClickUp ID configurado. Responsável não será atribuído.`,
        );
        return undefined;
      }

      console.warn(
        `Identificador ${trimmedKey} não encontrado no userMap. Responsável não será atribuído.`,
      );
      return undefined;
    })
    .filter((id): id is number => typeof id === 'number');

  return mappedIds.length > 0 ? mappedIds : undefined;
};

const getAssigneesFromProperty = (
  property?: OwnerProperty,
): number[] | undefined => {
  const notionKeys = getNotionUserKeys(property);

  if (notionKeys.length === 0) {
    return undefined;
  }

  return resolveClickUpAssignees(notionKeys);
};

const getProjectLabel = (page: PageObjectResponse): string | undefined => {
  for (const key of PROJECT_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (!isProjectProperty(property)) {
      continue;
    }

    if (property.type === 'select') {
      const label = property.select?.name;
      if (label) {
        return label;
      }
    }

    if (property.type === 'multi_select') {
      const label = property.multi_select[0]?.name;
      if (label) {
        return label;
      }
    }
  }

  return undefined;
};

const getTitleProperty = (page: PageObjectResponse): TitleProperty | undefined => {
  for (const key of TITLE_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (isTitleProperty(property)) {
      return property;
    }
  }

  return Object.values(page.properties).find(isTitleProperty);
};

export const getFormattedTaskName = (page: PageObjectResponse): string => {
  const projectLabel = getProjectLabel(page);
  const titleProperty = getTitleProperty(page);

  let taskName = DEFAULT_TITLE_PREFIX;

  if (projectLabel) {
    taskName = `${taskName} ${projectLabel}`;
  }

  if (!titleProperty) {
    return `${taskName} | Sem título`;
  }

  const firstFragment = titleProperty.title[0];
  const originalName = firstFragment?.plain_text ?? 'Sem título';

  return `${taskName} | ${originalName}`;
};

const getClickUpStatus = (page: PageObjectResponse): string => {
  const availableStatusKeys = Object.entries(page.properties)
    .filter(([, prop]) => isStatusProperty(prop))
    .map(([key]) => key);

  if (availableStatusKeys.length === 0) {
    console.warn(
      `Nenhuma propriedade de status identificada na página ${page.id}.` +
        ' Usando status padrão.',
    );
  } else {
    console.log(
      `Propriedades de status disponíveis na página ${page.id}:`,
      availableStatusKeys.join(', '),
    );
  }

  for (const key of STATUS_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (!isStatusProperty(property)) {
      continue;
    }

    const statusName =
      property.type === 'status'
        ? property.status?.name
        : property.type === 'select'
          ? property.select?.name
          : property.multi_select[0]?.name;

    if (!statusName) {
      continue;
    }

    console.log(
      `Status Notion encontrado (${key}): "${statusName}" para página ${page.id}`,
    );

    const mappedStatus = STATUS_MAP[statusName];
    if (mappedStatus) {
      return mappedStatus;
    }

    console.warn(
      `Status "${statusName}" não mapeado. Usando valor padrão "${DEFAULT_CLICKUP_STATUS}".`,
    );
    break;
  }

  return DEFAULT_CLICKUP_STATUS;
};

export const mapNotionPageToClickupPayload = (
  page: PageObjectResponse,
): ClickUpTaskPayload => {
  console.log('Mapeando página:', page.id);

  const ownerProperty = getOwnerProperty(page);

  const payload: ClickUpTaskPayload = {
    name: getFormattedTaskName(page),
    status: getClickUpStatus(page),
    priority: 3,
  };

  const assignees = getAssigneesFromProperty(ownerProperty);
  if (assignees) {
    payload.assignees = assignees;
  }

  return payload;
};
