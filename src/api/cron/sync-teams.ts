import 'dotenv/config';
import { runTeamsSync } from '../../core/teamsSyncJob.js';

(async () => {
  try {
    await runTeamsSync();
    process.exit(0);
  } catch (error) {
    console.error('== Erro fatal na sincronização do Teams: ==', error);
    process.exit(1);
  }
})();
