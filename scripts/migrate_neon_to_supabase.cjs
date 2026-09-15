/**
 * SKRYPT MIGRACYJNY: NEON POSTGRESQL -> SUPABASE POSTGRESQL (MODUŁ TRANSPORT)
 * 
 * Użycie:
 * node scripts/migrate_neon_to_supabase.cjs
 * 
 * Wymagane zmienne środowiskowe (lub w pliku .env):
 * NEON_DATABASE_URL="postgres://user:pass@ep-....neon.tech/neondb?sslmode=require"
 * SUPABASE_DATABASE_URL="postgres://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres"
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL || process.env.TARGET_DATABASE_URL;

if (!NEON_URL || !SUPABASE_URL) {
  console.error('\n❌ BŁĄD: Brak wymaganych zmiennych połączeniowych:');
  console.error('  NEON_DATABASE_URL: ' + (NEON_URL ? 'OK' : 'BRAK'));
  console.error('  SUPABASE_DATABASE_URL: ' + (SUPABASE_URL ? 'OK' : 'BRAK'));
  console.error('\nPrzykład uruchomienia:');
  console.error('NEON_DATABASE_URL="postgres://..." SUPABASE_DATABASE_URL="postgres://..." node scripts/migrate_neon_to_supabase.cjs\n');
  process.exit(1);
}

const neonClient = new Client({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

const supabaseClient = new Client({
  connectionString: SUPABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TABLES_TO_MIGRATE = [
  'constructions',
  'packagings',
  'valuation_settings',
  'cable_dictionaries',
  'cables_catalog',
  'transports',
  'spedycje',
  'kuriers',
  'transport_ratings',
  'transport_detailed_ratings',
  'cable_advices'
];

async function migrateTable(tableName) {
  console.log(`\n⏳ Kopiowanie tabeli: ${tableName}...`);
  try {
    // 1. Sprawdź czy tabela istnieje w źródle
    const existsRes = await neonClient.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
      [tableName]
    );
    if (!existsRes.rows[0].exists) {
      console.log(`⚠️ Tabela ${tableName} nie istnieje w bazie źródłowej (Neon). Pomijam.`);
      return;
    }

    // 2. Pobierz dane z Neon
    const sourceData = await neonClient.query(`SELECT * FROM "${tableName}"`);
    console.log(`   Pobrano ${sourceData.rows.length} rekordów z Neon.`);

    if (sourceData.rows.length === 0) {
      console.log(`   Tabela ${tableName} jest pusta, pomijam transfer.`);
      return;
    }

    // 3. Pobierz kolumny tabeli docelowej w Supabase
    const targetColsRes = await supabaseClient.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
    `, [tableName]);
    
    const targetCols = targetColsRes.rows.map(r => r.column_name);

    let insertedCount = 0;
    for (const row of sourceData.rows) {
      // Filtruj tylko kolumny, które istnieją w Supabase
      const validCols = Object.keys(row).filter(c => targetCols.includes(c));
      const values = validCols.map(c => row[c]);
      const placeholders = validCols.map((_, i) => `$${i + 1}`).join(', ');
      const colNames = validCols.map(c => `"${c}"`).join(', ');

      const conflictTarget = validCols.includes('id') ? '(id)' : (validCols.includes('key') ? '(key)' : '');
      let insertQuery = `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`;
      
      if (conflictTarget) {
        const updateSet = validCols
          .filter(c => c !== 'id' && c !== 'key')
          .map(c => `"${c}" = EXCLUDED."${c}"`)
          .join(', ');
        if (updateSet) {
          insertQuery += ` ON CONFLICT ${conflictTarget} DO UPDATE SET ${updateSet}`;
        } else {
          insertQuery += ` ON CONFLICT ${conflictTarget} DO NOTHING`;
        }
      } else {
        insertQuery += ` ON CONFLICT DO NOTHING`;
      }

      await supabaseClient.query(insertQuery, values);
      insertedCount++;
    }

    console.log(`✅ Zsynchronizowano ${insertedCount} rekordów w tabeli ${tableName}`);

    // 4. Zresetuj sekwencję autonumeracji jeśli tabela ma id
    if (targetCols.includes('id')) {
      await supabaseClient.query(`
        SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM "${tableName}"), 1));
      `);
      console.log(`   Zaktualizowano sekwencję ID dla ${tableName}`);
    }

  } catch (err) {
    console.error(`❌ Błąd podczas migracji tabeli ${tableName}:`, err.message);
  }
}

async function migrateUsersAndPermissions() {
  console.log(`\n⏳ Migracja użytkowników i ról (RBAC) do public.user_app_permissions...`);
  try {
    const hasUsers = await neonClient.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')`
    );
    if (!hasUsers.rows[0].exists) {
      console.log('Brak tabeli users w bazie źródłowej.');
      return;
    }

    const neonUsers = await neonClient.query(`SELECT email, name, role, is_admin, mpk FROM users`);
    console.log(`Znaleziono ${neonUsers.rows.length} użytkowników w bazie Transportu.`);

    // Pobierz profile z Supabase
    const supabaseProfiles = await supabaseClient.query(`SELECT id, email FROM public.profiles`);
    const profileMap = new Map();
    supabaseProfiles.rows.forEach(p => {
      if (p.email) profileMap.set(p.email.toLowerCase().trim(), p.id);
    });

    let assignedCount = 0;
    let missingUsers = [];

    for (const u of neonUsers.rows) {
      const email = (u.email || '').toLowerCase().trim();
      if (!email) continue;

      const profileId = profileMap.get(email);
      let role = u.role || 'pracownik';
      if (u.is_admin) role = 'admin';

      if (profileId) {
        // Wstaw lub zaktualizuj uprawnienie w user_app_permissions
        await supabaseClient.query(`
          INSERT INTO public.user_app_permissions (user_id, app_id, role, is_active)
          VALUES ($1, 'transport', $2, true)
          ON CONFLICT (user_id, app_id) DO UPDATE
          SET role = EXCLUDED.role, is_active = true, updated_at = now();
        `, [profileId, role]);
        assignedCount++;
      } else {
        missingUsers.push({ email, role, name: u.name });
      }
    }

    console.log(`✅ Przypisano uprawnienia transportowe dla ${assignedCount} istniejących użytkowników Supabase.`);
    
    if (missingUsers.length > 0) {
      console.log(`\nℹ️ Poniżsi użytkownicy z bazy Neon nie posiadają jeszcze konta w Supabase profiles (${missingUsers.length}):`);
      missingUsers.forEach(m => console.log(`   - ${m.email} (${m.name || 'Brak imienia'}) -> rola: ${m.role}`));
      console.log('   (Zostaną dodani automatycznie podczas rejestracji lub przez Portal Narzędzi)');
    }

  } catch (err) {
    console.error('❌ Błąd podczas synchronizacji użytkowników:', err.message);
  }
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 ROZPOCZYNAM MIGRACJĘ BAZY TRANSPORTU: NEON -> SUPABASE');
  console.log('===============================================================');

  try {
    await neonClient.connect();
    console.log('✅ Połączono ze źródłową bazą Neon');
  } catch (e) {
    console.error('❌ Nie udało się połączyć z bazą Neon:', e.message);
    process.exit(1);
  }

  try {
    await supabaseClient.connect();
    console.log('✅ Połączono z docelową bazą Supabase');
  } catch (e) {
    console.error('❌ Nie udało się połączyć z bazą Supabase:', e.message);
    process.exit(1);
  }

  // Wykonaj migrację tabel
  for (const table of TABLES_TO_MIGRATE) {
    await migrateTable(table);
  }

  // Migruj uprawnienia użytkowników
  await migrateUsersAndPermissions();

  await neonClient.end();
  await supabaseClient.end();

  console.log('\n===============================================================');
  console.log('🎉 MIGRACJA ZAKOŃCZONA SUKCESEM!');
  console.log('===============================================================\n');
}

run();
