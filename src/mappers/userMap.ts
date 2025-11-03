export interface UserMapping {
  clickupId?: number;
  teamsUpn: string;
}

/**
 * Mapa de tradução de e-mails/nomes do Notion
 * para IDs numéricos do ClickUp e UPNs do Teams.
 */
export const NOTION_TO_CLICKUP_USER_MAP: Record<string, UserMapping> = {
  // Usuários Mapeados:
  'michael.petterson@cashforce.com.br': {
    clickupId: 89340222,
    teamsUpn: 'michael.petterson@cashforce.com.br',
  },
  'joao.matheus@cashforce.com.br': {
    clickupId: 89254885,
    teamsUpn: 'joao.matheus@cashforce.com.br',
  },
  'matheus.gois@cashforce.com.br': {
    clickupId: 49151715,
    teamsUpn: 'matheus.gois@cashforce.com.br',
  },
  'mychael.jales@cashforce.com.br': {
    clickupId: 49151714,
    teamsUpn: 'mychael.jales@cashforce.com.br',
  },
  'alexandre@cashforce.com.br': {
    clickupId: 49151712,
    teamsUpn: 'alexandre@cashforce.com.br',
  },
  'felipe.leite@cashforce.com.br': {
    clickupId: 49138230,
    teamsUpn: 'felipe.leite@cashforce.com.br',
  },
  'andreia.dias@cashforce.com.br': {
    teamsUpn: 'andreia.dias@cashforce.com.br',
  },

  // Mapeamento por Nomes (apontando para o mesmo objeto)
  'Michael Petterson': {
    clickupId: 89340222,
    teamsUpn: 'michael.petterson@cashforce.com.br',
  },
  'Joao Matheus': {
    clickupId: 89254885,
    teamsUpn: 'joao.matheus@cashforce.com.br',
  },
  'João Matheus': {
    clickupId: 89254885,
    teamsUpn: 'joao.matheus@cashforce.com.br',
  },
  'Matheus Gois': {
    clickupId: 49151715,
    teamsUpn: 'matheus.gois@cashforce.com.br',
  },
  'Matheus Góis': {
    clickupId: 49151715,
    teamsUpn: 'matheus.gois@cashforce.com.br',
  },
  'Mychael Jales': {
    clickupId: 49151714,
    teamsUpn: 'mychael.jales@cashforce.com.br',
  },
  Alexandre: {
    clickupId: 49151712,
    teamsUpn: 'alexandre@cashforce.com.br',
  },
  'Felipe Leite': {
    clickupId: 49138230,
    teamsUpn: 'felipe.leite@cashforce.com.br',
  },
  'Andreia Dias': {
    teamsUpn: 'andreia.dias@cashforce.com.br',
  },
  Andreia: {
    teamsUpn: 'andreia.dias@cashforce.com.br',
  },
  'Gisele dos Santos Almeida': {
    teamsUpn: 'gisele.almeida@cashforce.com.br',
  },
  'gisele.almeida@cashforce.com.br': {
    teamsUpn: 'gisele.almeida@cashforce.com.br',
  },
  Gisele: {
    teamsUpn: 'gisele.almeida@cashforce.com.br',
  },
};
