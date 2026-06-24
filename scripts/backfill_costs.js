// scripts/backfill_costs.js
import pkg from '@next/env';
const { loadEnvConfig } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectDir = path.resolve(__dirname, '../');
loadEnvConfig(projectDir);

import db from '../src/database/db.js';

async function main() {
  console.log('Rozpoczynam migrację kolumny "cost" w tabeli transports...');

  try {
    // 1. Dodaj kolumnę jeśli nie ma (w ramach upewnienia się przed działaniem)
    const hasColumn = await db.schema.hasColumn('transports', 'cost');
    if (!hasColumn) {
      console.log('Kolumna "cost" nie istnieje - dodaję ją...');
      await db.schema.table('transports', table => {
        table.decimal('cost', 10, 2);
      });
      console.log('Kolumna "cost" została utworzona.');
    } else {
      console.log('Kolumna "cost" już istnieje. Przystępuję do aktualizacji wartości.');
    }

    // 2. Pobierz wszystkie transporty
    const transports = await db('transports').select('id', 'distance', 'connected_transport_id');
    console.log(`Pobrano ${transports.length} transportów.`);

    let updatedCount = 0;
    
    // Używamy wsadowych zapytań (batching) dla wydajności
    const batchSize = 100;
    for (let i = 0; i < transports.length; i += batchSize) {
      const batch = transports.slice(i, i + batchSize);
      
      const updatePromises = batch.map(t => {
        const dist = t.distance || 0;
        // Obliczenie stawki zgodnie z głównym warunkiem aplikacji
        const rate = t.connected_transport_id ? 3.5 : 4.5;
        const calculatedCost = dist * rate;
        
        return db('transports')
          .where('id', t.id)
          .update({ cost: calculatedCost });
      });

      await Promise.all(updatePromises);
      updatedCount += batch.length;
      console.log(`Zaktualizowano ${updatedCount} / ${transports.length} transportów...`);
    }

    console.log('==============================================');
    console.log('ZAKOŃCZONO: Zaktualizowano wszystkie historyczne koszty w tabeli transports.');
  } catch (err) {
    console.error('Wystąpił błąd podczas aktualizacji kosztów:', err);
  } finally {
    await db.destroy();
  }
}

main();
