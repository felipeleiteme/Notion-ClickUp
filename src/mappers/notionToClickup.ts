// src/mappers/notionToClickup.ts
import type {
  MultiSelectPropertyValue,
  PageObjectResponse,
  PeoplePropertyValue,
  SelectPropertyValue,
  StatusPropertyValue,
  TitlePropertyValue,
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

const STATUS_PROPERTY_KEYS = ['Status'] as const;

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

type OwnerProperty = PeoplePropertyValue | MultiSelectPropertyValue;
type ProjectProperty = SelectPropertyValue | MultiSelectPropertyValue;
type StatusProperty = StatusPropertyValue | SelectPropertyValue;

const isOwnerProperty = (property: unknown): property is OwnerProperty =>
  !!property &&
  typeof property === 'object' &&
  'type' in property &&
  ((property as PeoplePropertyValue).type === 'people' ||
    (property as MultiSelectPropertyValue).type === 'multi_select');

const isProjectProperty = (property: unknown): property is ProjectProperty =>
  !!property &&
  typeof property === 'object' &&
  'type' in property &&
  ((property as SelectPropertyValue).type === 'select' ||
    (property as MultiSelectPropertyValue).type === 'multi_select');

const isStatusProperty = (property: unknown): property is StatusProperty =>
  !!property &&
  typeof property === 'object' &&
  'type' in property &&
  ((property as StatusPropertyValue).type === 'status' ||
    (property as SelectPropertyValue).type === 'select');

const resolveClickUpAssignees = (keys: string[]): number[] | undefined => {
  const mappedIds = keys
    .map((key) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return undefined;
      }

      const clickupUserId = NOTION_TO_CLICKUP_USER_MAP[trimmedKey];

      if (typeof clickupUserId === 'number') {
        console.log(
          `Mapeando identificador ${trimmedKey} para ClickUp ID ${clickupUserId}`,
        );
        return clickupUserId;
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
  if (!property) {
    return undefined;
  }

  if (property.type === 'people') {
    const emails = property.people
      .map((person) => {
        const notionEmail = person?.person?.email;

        if (!notionEmail) {
          console.warn('Pessoa na propriedade de responsável sem e-mail.');
        }

        return notionEmail ?? undefined;
      })
      .filter((email): email is string => typeof email === 'string');

    return emails.length > 0 ? resolveClickUpAssignees(emails) : undefined;
  }

  if (property.type === 'multi_select') {
    const labels = property.multi_select
      .map((option) => option?.name)
      .filter((name): name is string => typeof name === 'string' && !!name);

    if (labels.length === 0) {
      console.warn(
        'Propriedade de multi-select encontrada, mas sem valores preenchidos.',
      );
      return undefined;
    }

    return resolveClickUpAssignees(labels);
  }

  return undefined;
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

const getFormattedTaskName = (
  page: PageObjectResponse,
  titleProperty?: TitlePropertyValue,
): string => {
  const projectLabel = getProjectLabel(page);

  let taskName = DEFAULT_TITLE_PREFIX;

  if (projectLabel) {
    taskName = `${taskName} ${projectLabel}`;
  }

  if (!titleProperty || titleProperty.type !== 'title') {
    return `${taskName} | Sem título`;
  }

  const firstFragment = titleProperty.title[0];
  const originalName = firstFragment?.plain_text ?? 'Sem título';

  return `${taskName} | ${originalName}`;
};

const getClickUpStatus = (page: PageObjectResponse): string => {
  for (const key of STATUS_PROPERTY_KEYS) {
    const property = page.properties[key];
    if (!isStatusProperty(property)) {
      continue;
    }

    const statusName =
      property.type === 'status'
        ? property.status?.name
        : property.select?.name;

    if (!statusName) {
      continue;
    }

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

  const titleProperty = (page.properties.Nome ??
    page.properties.Name) as TitlePropertyValue | undefined;

  const ownerPropertyFromKeys = OWNER_PROPERTY_KEYS.reduce<
    OwnerProperty | undefined
  >((found, key) => {
    if (found) {
      return found;
    }

    const property = page.properties[key];
    return isOwnerProperty(property) ? property : undefined;
  }, undefined);

  const ownerProperty =
    ownerPropertyFromKeys ??
    (Object.values(page.properties).find((property) =>
      isOwnerProperty(property),
    ) as OwnerProperty | undefined);

  if (!ownerProperty) {
    console.warn(`Nenhum responsável encontrado para a página ${page.id}.`);
  } else if (!ownerPropertyFromKeys) {
    console.warn(
      `Utilizando a primeira propriedade de responsável encontrada na página ${page.id}. Verifique se está correto.`,
    );
  }

  const payload: ClickUpTaskPayload = {
    name: getFormattedTaskName(page, titleProperty),
    status: getClickUpStatus(page),
    priority: 3,
  };

  const assignees = getAssigneesFromProperty(ownerProperty);
  if (assignees) {
    payload.assignees = assignees;
  }

  return payload;
};
