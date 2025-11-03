import 'dotenv/config';
import cron from 'node-cron';
import { runSync } from '../../core/syncService';

const CRON_EXPRESSION =
  process.env.SYNC_CRON_EXPRESSION?.trim() || '*/10 * * * *';
const TIMEZONE = process.env.SYNC_TIMEZONE?.trim();
const RUN_ON_BOOT =
  process.env.SYNC_RUN_ON_BOOT?.toLowerCase() !== 'false';

if (!cron.validate(CRON_EXPRESSION)) {
  console.error(
    `Expressão CRON inválida: "${CRON_EXPRESSION}". Ajuste SYNC_CRON_EXPRESSION no .env.`,
  );
  process.exit(1);
}

console.log(
  `== Agendador iniciado (cron: "${CRON_EXPRESSION}"${
    TIMEZONE ? `, timezone: ${TIMEZONE}` : ''
  }) ==`,
);

let isRunning = false;

const executeSync = async () => {
  if (isRunning) {
    console.warn('Execução anterior ainda em andamento. Ignorando disparo.');
    return;
  }

  isRunning = true;
  console.log('== Disparando sincronização agendada... ==');

  try {
    await runSync();
    console.log('== Execução agendada concluída. ==');
  } catch (error) {
    console.error('== Erro durante execução agendada ==', error);
  } finally {
    isRunning = false;
  }
};

cron.schedule(CRON_EXPRESSION, executeSync, {
  timezone: TIMEZONE,
});

if (RUN_ON_BOOT) {
  void executeSync();
}

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`Recebido sinal ${signal}. Encerrando agendador...`);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
