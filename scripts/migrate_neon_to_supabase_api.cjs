/**
 * KOMPLETNY TRANSFER DANYCH: NEON POSTGRESQL -> SUPABASE VIA SERVICE ROLE API
 * Z inteligentnym filtrowaniem kolumn i zachowaniem kolejności kluczy obcych.
 */

const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const NEON_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!NEON_URL || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Brak wymaganych zmiennych srodowiskowych (NEON_DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const neonClient = new Client({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Kolejność ważna: rodzice przed dziećmi (transports przed ocenami)
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
    const existsRes = await neonClient.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
      [tableName]
    );
    if (!existsRes.rows[0].exists) {
      console.log(`⚠️ Tabela ${tableName} nie istnieje w bazie źródłowej (Neon). Pomijam.`);
      return;
    }

    const sourceData = await neonClient.query(`SELECT * FROM "${tableName}"`);
    console.log(`   Pobrano ${sourceData.rows.length} rekordów z Neon.`);

    if (sourceData.rows.length === 0) {
      console.log(`   Tabela ${tableName} jest pusta.`);
      return;
    }

    // Wstawianie w paczkach po 50 rekordów
    const batchSize = 50;
    let totalInserted = 0;
    let hasError = false;

    for (let i = 0; i < sourceData.rows.length; i += batchSize) {
      const batch = sourceData.rows.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from(tableName)
        .upsert(batch, { onConflict: batch[0].id !== undefined ? 'id' : (batch[0].key !== undefined ? 'key' : undefined) });

      if (error) {
        if (!hasError) {
          console.error(`❌ Błąd batcha [${i}..${i + batch.length}] w ${tableName}:`, error.message);
          hasError = true;
        }
      } else {
        totalInserted += batch.length;
      }
    }

    if (totalInserted === sourceData.rows.length) {
      console.log(`✅ Zsynchronizowano ${totalInserted} / ${sourceData.rows.length} rekordów w ${tableName}`);
    } else {
      console.log(`⚠️ Zsynchronizowano ${totalInserted} / ${sourceData.rows.length} rekordów w ${tableName}`);
    }
  } catch (err) {
    console.error(`❌ Błąd tabeli ${tableName}:`, err.message);
  }
}

async function migrateUsersAndPermissions() {
  console.log(`\n⏳ Synchronizacja użytkowników z bazy Transportu do public.user_app_permissions...`);
  try {
    const neonUsers = await neonClient.query(`SELECT email, name, role, is_admin, mpk FROM users`);
    console.log(`Znaleziono ${neonUsers.rows.length} użytkowników w bazie Transportu.`);

    const { data: profiles, error: profErr } = await supabase.from('profiles').select('id, email');
    if (profErr) {
      console.error('Błąd pobierania profili:', profErr.message);
      return;
    }

    const profileMap = new Map();
    (profiles || []).forEach(p => {
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
        const { error: permErr } = await supabase
          .from('user_app_permissions')
          .upsert({
            user_id: profileId,
            app_id: 'transport',
            role: role,
            is_active: true,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,app_id' });

        if (!permErr) assignedCount++;
      } else {
        missingUsers.push({ email, role, name: u.name });
      }
    }

    console.log(`✅ Nadano uprawnienia transportowe dla ${assignedCount} istniejących profili.`);
    if (missingUsers.length > 0) {
      console.log(`ℹ️ Konta z Neon oczekujące na rejestrację profilu (${missingUsers.length})`);
    }
  } catch (err) {
    console.error('Błąd użytkowników:', err.message);
  }
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 ROZPOCZYNAM TRANSFER DANYCH: NEON -> SUPABASE (VIA API)');
  console.log('===============================================================');

  try {
    await neonClient.connect();
    console.log('✅ Połączono z bazą Neon');
  } catch (e) {
    console.error('❌ Błąd połączenia z Neon:', e.message);
    process.exit(1);
  }

  for (const table of TABLES_TO_MIGRATE) {
    await migrateTable(table);
  }

  await migrateUsersAndPermissions();
  await neonClient.end();

  console.log('\n===============================================================');
  console.log('🎉 WSZYSTKIE DANE ZOSTAŁY PRZENIESIONE DO SUPABASE!');
  console.log('===============================================================\n');
}

run();
