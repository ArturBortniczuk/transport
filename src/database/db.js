// src/database/db.js
import knex from 'knex';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Sprawdź, czy jesteśmy w fazie budowania
const isBuildPhase = process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.NEXT_RUNTIME;

console.log('Database initialization:', {
  NODE_ENV: process.env.NODE_ENV,
  isBuildPhase,
  hasDbUrl: !!process.env.DATABASE_URL
});

// Funkcja do tworzenia połączenia z bazą danych
const createDbConnection = () => {
  // Jeśli jesteśmy w fazie budowania, zwróć mock zamiast prawdziwego połączenia
  if (isBuildPhase) {
    console.log('Using mock database for build phase');
    return {
      schema: {
        hasTable: () => Promise.resolve(false),
        createTable: () => Promise.resolve(),
        table: () => ({ timestamp: () => {} }),
        hasColumn: () => Promise.resolve(false)
      },
      raw: () => Promise.resolve([[], []]),
      select: () => ({ where: () => ({ first: () => Promise.resolve({}), orderBy: () => ({ select: () => Promise.resolve([]) }) }) }),
      where: () => ({ update: () => Promise.resolve(1), first: () => Promise.resolve({}) }),
      insert: () => Promise.resolve([1]),
      count: () => ({ first: () => Promise.resolve({ count: 0 }) }),
      fn: { now: () => 'NOW()' },
      transaction: (callback) => Promise.resolve(callback(this))
    };
  }

  // W przeciwnym razie utwórz prawdziwe połączenie
  try {
    const connection = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL,
      pool: {
        min: 0,
        max: 1 // Redukcja dla środowiska serverless
      },
      acquireConnectionTimeout: 30000,
      // Dodaj debugging dla development
      debug: process.env.NODE_ENV === 'development'
    });

    console.log('Database connection created successfully');
    return connection;
  } catch (error) {
    console.error('Error creating database connection:', error);
    throw error;
  }
};

// Inicjalizacja połączenia
let db;
try {
  db = createDbConnection();
} catch (error) {
  console.error('Failed to initialize database:', error);
  // Fallback do mock database w przypadku błędu
  db = {
    schema: {
      hasTable: () => Promise.resolve(false),
      createTable: () => Promise.resolve(),
      table: () => ({ timestamp: () => {} }),
      hasColumn: () => Promise.resolve(false)
    },
    raw: () => Promise.resolve([[], []]),
    select: () => ({ where: () => ({ first: () => Promise.resolve({}), orderBy: () => ({ select: () => Promise.resolve([]) }) }) }),
    where: () => ({ update: () => Promise.resolve(1), first: () => Promise.resolve({}) }),
    insert: () => Promise.resolve([1]),
    count: () => ({ first: () => Promise.resolve({ count: 0 }) }),
    fn: { now: () => 'NOW()' },
    transaction: (callback) => Promise.resolve(callback(this))
  };
}

// Inicjalizacja wszystkich tabel
const initializeDatabase = async () => {
  if (isBuildPhase) {
    console.log('Skipping database initialization during build phase');
    return true;
  }
  
  try {
    console.log('Starting database initialization...');
    
    // Tabela użytkowników
    const usersExists = await db.schema.hasTable('users');
    if (!usersExists) {
      console.log('Creating users table...');
      await db.schema.createTable('users', table => {
        table.string('email').primary();
        table.string('name').notNullable();
        table.string('position').notNullable();
        table.string('phone');
        table.string('password').notNullable();
        table.string('role').notNullable();
        table.boolean('first_login').defaultTo(true);
        table.boolean('is_admin').defaultTo(false);
        table.text('permissions');
        table.string('mpk');
      });
      console.log('Users table created');
    }

    // Tabela sesji
    const sessionsExists = await db.schema.hasTable('sessions');
    if (!sessionsExists) {
      console.log('Creating sessions table...');
      await db.schema.createTable('sessions', table => {
        table.string('token').primary();
        table.string('user_id').notNullable();
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.foreign('user_id').references('email').inTable('users');
      });
      console.log('Sessions table created');
    }

    // Tabela transportów
    const transportsExists = await db.schema.hasTable('transports');
    if (!transportsExists) {
      console.log('Creating transports table...');
      await db.schema.createTable('transports', table => {
        table.increments('id').primary();
        table.string('source_warehouse').notNullable();
        table.string('destination_city').notNullable();
        table.string('postal_code');
        table.string('street');
        table.float('latitude');
        table.float('longitude');
        table.float('distance');
        table.integer('driver_id');
        table.integer('vehicle_id'); 
        table.string('status').defaultTo('active');
        table.string('wz_number');
        table.string('client_name');  
        table.string('market');
        table.string('loading_level');
        table.text('notes');
        table.boolean('is_cyclical').defaultTo(false);
        table.timestamp('delivery_date');
        table.timestamp('completed_at');
        table.string('requester_name');
        table.string('requester_email');
        table.string('mpk');
        table.text('goods_description');  
        table.text('responsible_constructions');  
      });
      console.log('Transports table created');
    }

    const packagingsExists = await db.schema.hasTable('packagings');
    if (!packagingsExists) {
      console.log('Creating packagings table...');
      await db.schema.createTable('packagings', table => {
        table.increments('id').primary();
        table.string('external_id'); 
        table.string('description').notNullable();
        table.string('client_name');
        table.string('city').notNullable();
        table.string('postal_code');
        table.string('street');
        table.float('latitude');
        table.float('longitude');
        table.string('status').defaultTo('pending'); 
        table.integer('transport_id').references('id').inTable('transports');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Packagings table created');
    }

    const appSettingsExists = await db.schema.hasTable('app_settings');
    if (!appSettingsExists) {
      console.log('Creating app_settings table...');
      await db.schema.createTable('app_settings', table => {
        table.string('key').primary();
        table.text('value');
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('App_settings table created');
    }

    // Tabela ocen transportów
    const transportRatingsExists = await db.schema.hasTable('transport_ratings');
    if (!transportRatingsExists) {
      console.log('Creating transport_ratings table...');
      await db.schema.createTable('transport_ratings', table => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable().references('id').inTable('transports');
        table.boolean('is_positive').notNullable(); 
        table.integer('rating'); // Zachowujemy dla kompatybilności
        table.text('comment');
        table.string('rater_email').notNullable();
        table.string('rater_name');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('Transport_ratings table created');
    } else {
      // Sprawdź, czy kolumna is_positive istnieje
      const hasIsPositive = await db.schema.hasColumn('transport_ratings', 'is_positive');
      const hasRating = await db.schema.hasColumn('transport_ratings', 'rating');
      
      if (!hasIsPositive) {
        console.log('Adding is_positive column to transport_ratings...');
        // Dodaj nową kolumnę
        await db.schema.table('transport_ratings', table => {
          table.boolean('is_positive').defaultTo(true);
        });
        
        // Migracja danych tylko jeśli stara kolumna istnieje
        if (hasRating) {
          console.log('Migrating rating data to is_positive...');
          const ratings = await db('transport_ratings').select('id', 'rating');
          for (const rating of ratings) {
            await db('transport_ratings')
              .where('id', rating.id)
              .update({ is_positive: rating.rating >= 3 });
          }
        }
        console.log('Rating migration completed');
      }
    }
    
    // Tabela budów
    const constructionsExists = await db.schema.hasTable('constructions');
    if (!constructionsExists) {
      console.log('Creating constructions table...');
      await db.schema.createTable('constructions', table => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('mpk').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      console.log('Constructions table created');
    }
    
    // Tabela spedycji
    const spedycjeExists = await db.schema.hasTable('spedycje');
    if (!spedycjeExists) {
      console.log('Creating spedycje table...');
      await db.schema.createTable('spedycje', table => {
        table.increments('id').primary();
        table.string('status').defaultTo('new');
        table.string('order_number');
        table.string('created_by');
        table.string('created_by_email');
        table.string('responsible_person');
        table.string('responsible_email');
        table.string('mpk');
        table.string('location');
        table.text('location_data');
        table.text('delivery_data');
        table.string('loading_contact');
        table.string('unloading_contact');
        table.date('delivery_date');
        table.string('documents');
        table.text('notes');
        table.text('response_data');
        table.string('completed_by');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('completed_at');
        table.integer('distance_km');
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
        table.string('client_name');  
        table.text('goods_description');  
        table.text('responsible_constructions');  
      });
      console.log('Spedycje table created');
    }

    // Tabela szczegółowych ocen transportów (jeśli nie istnieje)
    const detailedRatingsExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!detailedRatingsExists) {
      console.log('Creating transport_detailed_ratings table...');
      await db.schema.createTable('transport_detailed_ratings', table => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable().references('id').inTable('transports');
        table.string('rater_email').notNullable();
        table.string('rater_name');
        table.boolean('driver_professional');
        table.boolean('driver_tasks_completed');
        table.boolean('cargo_complete');
        table.boolean('cargo_correct');
        table.boolean('delivery_notified');
        table.boolean('delivery_on_time');
        table.text('comment');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
      console.log('Transport_detailed_ratings table created');
    }

    console.log('Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Błąd inicjalizacji bazy:', error);
    return false;
  }
};

// Inicjalizacja użytkowników z pliku Excel
const initializeUsersFromExcel = async () => {
  if (isBuildPhase) {
    console.log('Skipping user initialization during build phase');
    return;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'public', 'users.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.log('Users.xlsx file not found, skipping user initialization');
      return;
    }

    // Sprawdź, czy już mamy użytkowników w bazie
    const userCount = await db('users').count('email as count').first();

    if (userCount && userCount.count > 0) {
      console.log('Users already exist in database, skipping initialization');
      return;
    }

    console.log('Initializing users from Excel file...');
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, {
      range: 1,
      header: ['name', 'position', 'email', 'phone', 'password', 'mpk']
    });

    // Przygotuj domyślne uprawnienia
    const getDefaultPermissions = (role, isAdmin) => {
      const isMagazyn = role === 'magazyn_bialystok' || role === 'magazyn_zielonka' || role === 'magazyn';
      
      const permissions = {
        calendar: {
          view: true,
          edit: isMagazyn || isAdmin
        },
        map: {
          view: true
        },
        transport: {
          markAsCompleted: isMagazyn || isAdmin
        }
      };
      return JSON.stringify(permissions);
    };

    // Dodaj użytkowników do bazy - batch insert
    const usersToInsert = data.map(row => {
      const isAdmin = row.email === 'a.bortniczuk@grupaeltron.pl';
      const role = isAdmin ? 'admin' : 
                row.position.toLowerCase().includes('handlowy') ? 'handlowiec' : 
                row.position.toLowerCase().includes('zielonka') ? 'magazyn_zielonka' : 'magazyn_bialystok';
      
      return {
        email: row.email,
        name: row.name,
        position: row.position,
        phone: row.phone,
        password: row.password,
        role: role,
        first_login: true,
        is_admin: isAdmin,
        permissions: getDefaultPermissions(role, isAdmin),
        mpk: row.mpk || ''
      };
    });

    // Wstawianie wsadowe użytkowników
    await db('users').insert(usersToInsert);
    console.log(`Initialized ${usersToInsert.length} users from Excel file`);
  } catch (error) {
    console.error('Błąd inicjalizacji użytkowników:', error);
  }
};

// Funkcja do wyświetlania użytkowników
const showAllUsers = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    const users = await db('users').select('email', 'name', 'position', 'role');
    console.log(`Database contains ${users.length} users`);
  } catch (error) {
    console.error('Błąd wyświetlania użytkowników:', error);
  }
};

// Funkcja sprawdzająca strukturę tabeli transportów
const checkTransportsTable = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    // PostgreSQL używa information_schema zamiast SHOW COLUMNS
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transports'
    `);
    const columnNames = columns.rows.map(col => col.column_name);
    
    // Sprawdź czy kolumna vehicle_id istnieje
    if (!columnNames.includes('vehicle_id')) {
      console.log('Adding vehicle_id column to transports table...');
      await db.schema.table('transports', table => {
        table.integer('vehicle_id');
      });
      console.log('Added vehicle_id column to transports table');
    }

    // Sprawdź czy kolumna connected_transport_id istnieje
    if (!columnNames.includes('connected_transport_id')) {
      console.log('Adding connected_transport_id column to transports table...');
      await db.schema.table('transports', table => {
        table.integer('connected_transport_id').references('id').inTable('transports');
      });
      console.log('Added connected_transport_id column to transports table');
    }

    // Sprawdź czy kolumna packaging_id istnieje
    if (!columnNames.includes('packaging_id')) {
      console.log('Adding packaging_id column to transports table...');
      await db.schema.table('transports', table => {
        table.integer('packaging_id').references('id').inTable('packagings');
      });
      console.log('Added packaging_id column to transports table');
    }
    
    // Sprawdź czy nowe kolumny istnieją
    if (!columnNames.includes('client_name')) {
      console.log('Adding client_name column to transports table...');
      await db.schema.table('transports', table => {
        table.string('client_name');
      });
      console.log('Added client_name column to transports table');
    }
    
    if (!columnNames.includes('goods_description')) {
      console.log('Adding goods_description column to transports table...');
      await db.schema.table('transports', table => {
        table.text('goods_description');
      });
      console.log('Added goods_description column to transports table');
    }
    
    if (!columnNames.includes('responsible_constructions')) {
      console.log('Adding responsible_constructions column to transports table...');
      await db.schema.table('transports', table => {
        table.text('responsible_constructions');
      });
      console.log('Added responsible_constructions column to transports table');
    }
  } catch (error) {
    console.error('Błąd sprawdzania tabeli transportów:', error);
  }
};

// Funkcja sprawdzająca strukturę tabeli spedycji
const checkSpedycjeTable = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    // Sprawdź czy tabela spedycje istnieje
    const spedycjeExists = await db.schema.hasTable('spedycje');
    if (!spedycjeExists) {
      // Tabela zostanie utworzona w initializeDatabase
      return;
    }
    
    // PostgreSQL używa information_schema zamiast SHOW COLUMNS
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'spedycje'
    `);
    const columnNames = columns.rows.map(col => col.column_name);
    
    // Sprawdź czy kolumna distance_km istnieje
    if (!columnNames.includes('distance_km')) {
      console.log('Adding distance_km column to spedycje table...');
      await db.schema.table('spedycje', table => {
        table.integer('distance_km');
      });
      console.log('Added distance_km column to spedycje table');
    }
    
    // Sprawdź czy kolumny związane z zamówieniem istnieją
    if (!columnNames.includes('order_sent')) {
      console.log('Adding order columns to spedycje table...');
      await db.schema.table('spedycje', table => {
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
      });
      console.log('Added order columns to spedycje table');
    }
    
    // Sprawdź czy nowe kolumny istnieją
    if (!columnNames.includes('client_name')) {
      console.log('Adding client_name column to spedycje table...');
      await db.schema.table('spedycje', table => {
        table.string('client_name');
      });
      console.log('Added client_name column to spedycje table');
    }
    
    if (!columnNames.includes('goods_description')) {
      console.log('Adding goods_description column to spedycje table...');
      await db.schema.table('spedycje', table => {
        table.text('goods_description');
      });
      console.log('Added goods_description column to spedycje table');
    }
    
    if (!columnNames.includes('responsible_constructions')) {
      console.log('Adding responsible_constructions column to spedycje table...');
      await db.schema.table('spedycje', table => {
        table.text('responsible_constructions');
      });
      console.log('Added responsible_constructions column to spedycje table');
    }
  } catch (error) {
    console.error('Błąd sprawdzania tabeli spedycje:', error);
  }
};

// Wykonaj inicjalizację asynchronicznie tylko jeśli nie jesteśmy w fazie budowania
if (!isBuildPhase) {
  console.log('Starting database initialization process...');
  (async () => {
    try {
      await initializeDatabase();
      await initializeUsersFromExcel();
      await showAllUsers();
      await checkTransportsTable();
      await checkSpedycjeTable();
      console.log('All database initialization completed');
    } catch (error) {
      console.error('Błąd inicjalizacji:', error);
    }
  })();
} else {
  console.log('Build phase detected, skipping database initialization');
}

export default db;
