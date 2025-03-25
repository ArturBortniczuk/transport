// src/database/db.js
import knex from 'knex';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Sprawdź, czy jesteśmy w fazie budowania
const isBuildPhase = process.env.NODE_ENV === 'production' && typeof window === 'undefined' && !process.env.NEXT_RUNTIME;

// Funkcja do tworzenia połączenia z bazą danych
const createDbConnection = () => {
  // Jeśli jesteśmy w fazie budowania, zwróć mock zamiast prawdziwego połączenia
  if (isBuildPhase) {
    return {
      schema: {
        hasTable: () => Promise.resolve(false),
        createTable: () => Promise.resolve(),
        table: () => ({ datetime: () => {} })
      },
      raw: () => Promise.resolve([[], []]),
      select: () => ({ where: () => ({ first: () => Promise.resolve({}) }) }),
      where: () => ({ update: () => Promise.resolve(1), first: () => Promise.resolve({}) }),
      insert: () => Promise.resolve([1]),
      count: () => ({ first: () => Promise.resolve({ count: 0 }) }),
      fn: { now: () => 'NOW()' }
    };
  }

  // W przeciwnym razie utwórz prawdziwe połączenie
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    pool: {
      min: 0,  // Zmniejszone z 2 na 0
      max: 3   // Zmniejszone z 10 na 3
    },
    acquireConnectionTimeout: 10000,
    idleTimeoutMillis: 30000
  });
};

// Inicjalizacja połączenia
const db = createDbConnection();

// Inicjalizacja wszystkich tabel
const initializeDatabase = async () => {
  if (isBuildPhase) {
    return true;
  }
  
  try {
    // Tabela użytkowników
    const usersExists = await db.schema.hasTable('users');
    if (!usersExists) {
      await db.schema.createTable('users', table => {
        table.string('email').primary();
        table.string('name').notNullable();
        table.string('position').notNullable();
        table.string('phone');
        table.string('password').notNullable();
        table.string('role').notNullable();
        table.boolean('first_login').defaultTo(1);
        table.boolean('is_admin').defaultTo(0);
        table.text('permissions');
        table.string('mpk');
      });
    }

    // Tabela sesji
    const sessionsExists = await db.schema.hasTable('sessions');
    if (!sessionsExists) {
      await db.schema.createTable('sessions', table => {
        table.string('token').primary();
        table.string('user_id').notNullable();
        table.datetime('expires_at').notNullable();
        table.datetime('created_at').defaultTo(db.fn.now());
        table.foreign('user_id').references('email').inTable('users');
      });
    }

    // Tabela transportów
    const transportsExists = await db.schema.hasTable('transports');
    if (!transportsExists) {
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
        table.string('status').defaultTo('active');
        table.string('wz_number');
        table.string('client_name');
        table.string('market');
        table.string('loading_level');
        table.text('notes');
        table.boolean('is_cyclical').defaultTo(0);
        table.datetime('delivery_date');
        table.datetime('completed_at');
        table.string('requester_name');
        table.string('requester_email');
        table.string('mpk');
      });
    }

    return true;
  } catch (error) {
    return false;
  }
};

// Inicjalizacja użytkowników z pliku Excel
const initializeUsersFromExcel = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'public', 'users.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return;
    }

    // Sprawdź, czy już mamy użytkowników w bazie
    const userCount = await db('users').count('email as count').first();

    if (userCount.count > 0) {
      return;
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, {
      range: 1,
      header: ['name', 'position', 'email', 'phone', 'password', 'mpk']
    });

    // Przygotuj domyślne uprawnienia
    const getDefaultPermissions = (role, isAdmin) => {
      const permissions = {
        calendar: {
          view: true,
          edit: role === 'magazyn'
        },
        map: {
          view: true
        },
        transport: {
          markAsCompleted: role === 'magazyn' || isAdmin
        }
      };
      return JSON.stringify(permissions);
    };

    // Dodaj użytkowników do bazy - batch insert
    const usersToInsert = data.map(row => {
      const isAdmin = row.email === 'a.bortniczuk@grupaeltron.pl';
      const role = isAdmin ? 'admin' : 
                row.position.toLowerCase().includes('handlowy') ? 'handlowiec' : 'magazyn';
      
      return {
        email: row.email,
        name: row.name,
        position: row.position,
        phone: row.phone,
        password: row.password,
        role: role,
        first_login: 1,
        is_admin: isAdmin ? 1 : 0,
        permissions: getDefaultPermissions(role, isAdmin),
        mpk: row.mpk || ''
      };
    });

    // Wstawianie wsadowe użytkowników
    await db('users').insert(usersToInsert);
  } catch (error) {
    // Pominięto obsługę błędu
  }
};

// Funkcja do wyświetlania użytkowników
const showAllUsers = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    await db('users').select('email', 'name', 'position', 'role');
  } catch (error) {
    // Pominięto obsługę błędu
  }
};

// Funkcja sprawdzająca strukturę tabeli transportów
const checkTransportsTable = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    // MySQL nie używa PRAGMA, więc musimy sprawdzić to inaczej
    const columns = await db.raw('SHOW COLUMNS FROM transports');
    const columnNames = columns[0].map(col => col.Field);
    
    // Sprawdź czy kolumna completed_at istnieje
    if (!columnNames.includes('completed_at')) {
      await db.schema.table('transports', table => {
        table.datetime('completed_at');
      });
    }
  } catch (error) {
    // Pominięto obsługę błędu
  }
};

// Wykonaj inicjalizację asynchronicznie tylko jeśli nie jesteśmy w fazie budowania
if (!isBuildPhase) {
  (async () => {
    try {
      await initializeDatabase();
      await initializeUsersFromExcel();
      await showAllUsers();
      await checkTransportsTable();
    } catch (error) {
      // Pominięto obsługę błędu
    }
  })();
}

export default db;