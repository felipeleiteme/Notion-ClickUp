import 'dotenv/config';
import { runSync } from '../../core/syncService';

(async () => {
  console.log('== Iniciando sincronização... ==');

  try {
    await runSync();
    console.log('== Sincronização concluída com sucesso. ==');
    process.exit(0);
  } catch (error) {
    console.error('== Erro fatal na sincronização: ==', error);
    process.exit(1);
  }
})();
