import 'dotenv/config';
import cron from 'node-cron';
import { runSync } from '../../core/syncService.js';
import { runTeamsSync } from '../../core/teamsSyncJob.js';

const CLICKUP_CRON_EXPRESSION =
  process.env.SYNC_CRON_EXPRESSION?.trim() || '*/10 * * * *';
const CLICKUP_TIMEZONE = process.env.SYNC_TIMEZONE?.trim();
const CLICKUP_RUN_ON_BOOT =
  process.env.SYNC_RUN_ON_BOOT?.toLowerCase() !== 'false';

const TEAMS_CRON_EXPRESSION =
  process.env.TEAMS_SYNC_CRON_EXPRESSION?.trim() || '*/10 * * * *';
const TEAMS_TIMEZONE = process.env.TEAMS_SYNC_TIMEZONE?.trim();
const TEAMS_RUN_ON_BOOT =
  process.env.TEAMS_SYNC_RUN_ON_BOOT?.toLowerCase() !== 'false';
const TEAMS_ENABLED = process.env.TEAMS_SYNC_ENABLED?.toLowerCase() !== 'false';

if (!cron.validate(CLICKUP_CRON_EXPRESSION)) {
  console.error(
    `Expressão CRON inválida: "${CLICKUP_CRON_EXPRESSION}". Ajuste SYNC_CRON_EXPRESSION no .env.`,
  );
  process.exit(1);
}

if (TEAMS_ENABLED && !cron.validate(TEAMS_CRON_EXPRESSION)) {
  console.error(
    `Expressão CRON inválida: "${TEAMS_CRON_EXPRESSION}". Ajuste TEAMS_SYNC_CRON_EXPRESSION no .env.`,
  );
  process.exit(1);
}

console.log(
  `== Agendador ClickUp iniciado (cron: "${CLICKUP_CRON_EXPRESSION}"${
    CLICKUP_TIMEZONE ? `, timezone: ${CLICKUP_TIMEZONE}` : ''
  }) ==`,
);

if (TEAMS_ENABLED) {
  console.log(
    `== Agendador Teams iniciado (cron: "${TEAMS_CRON_EXPRESSION}"${
      TEAMS_TIMEZONE ? `, timezone: ${TEAMS_TIMEZONE}` : ''
    }) ==`,
  );
} else {
  console.log('== Agendador Teams desativado (TEAMS_SYNC_ENABLED=false) ==');
}

let isClickUpRunning = false;
let isTeamsRunning = false;

const executeClickUpSync = async () => {
  if (isClickUpRunning) {
    console.warn('Sync ClickUp anterior ainda em andamento. Ignorando disparo.');
    return;
  }

  isClickUpRunning = true;
  console.log('== Disparando sincronização ClickUp agendada... ==');

  try {
    await runSync();
    console.log('== Execução ClickUp concluída. ==');
  } catch (error) {
    console.error('== Erro durante execução ClickUp ==', error);
  } finally {
    isClickUpRunning = false;
  }
};

const executeTeamsSync = async () => {
  if (isTeamsRunning) {
    console.warn('Sync Teams anterior ainda em andamento. Ignorando disparo.');
    return;
  }

  if (!process.env.TEAMS_WEBHOOK_URL) {
    console.warn('TEAMS_WEBHOOK_URL não definida. Ignorando execução do Teams.');
    return;
  }

  isTeamsRunning = true;
  console.log('== Disparando sincronização Teams agendada... ==');

  try {
    await runTeamsSync();
    console.log('== Execução Teams concluída. ==');
  } catch (error) {
    console.error('== Erro durante execução Teams ==', error);
  } finally {
    isTeamsRunning = false;
  }
};

cron.schedule(CLICKUP_CRON_EXPRESSION, executeClickUpSync, {
  timezone: CLICKUP_TIMEZONE,
});

if (TEAMS_ENABLED) {
  cron.schedule(TEAMS_CRON_EXPRESSION, executeTeamsSync, {
    timezone: TEAMS_TIMEZONE,
  });
}

if (CLICKUP_RUN_ON_BOOT) {
  void executeClickUpSync();
}

if (TEAMS_ENABLED && TEAMS_RUN_ON_BOOT) {
  void executeTeamsSync();
}

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Recebido sinal ${signal}. Encerrando agendador...`);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
