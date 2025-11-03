import type {
  PageObjectResponse,
  TitlePropertyValue,
} from '@notionhq/client/build/src/api-endpoints';

const getTitleFromProperty = (property?: TitlePropertyValue): string => {
  if (!property || property.type !== 'title') {
    return 'Sem título';
  }

  const firstFragment = property.title[0];
  return firstFragment?.plain_text ?? 'Sem título';
};

export const mapNotionPageToClickupPayload = (
  page: PageObjectResponse,
): { name: string } => {
  console.log('Mapeando página:', page.id);

  const property = (page.properties.Name ??
    page.properties.Nome) as TitlePropertyValue | undefined;

  return {
    name: getTitleFromProperty(property),
  };
};
