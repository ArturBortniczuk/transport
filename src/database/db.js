// src/database/db.js
import knex from 'knex';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

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
        table: () => ({ timestamp: () => {} })
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
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: {
      min: 0,
      max: 1 // Redukcja dla środowiska serverless
    },
    acquireConnectionTimeout: 30000
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
        table.boolean('first_login').defaultTo(true);
        table.boolean('is_admin').defaultTo(false);
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
        table.timestamp('expires_at').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
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
        table.boolean('is_cyclical').defaultTo(false);
        table.timestamp('delivery_date');
        table.timestamp('completed_at');
        table.string('requester_name');
        table.string('requester_email');
        table.string('mpk');
      });
    }

    return true;
  } catch (error) {
    console.error('Błąd inicjalizacji bazy:', error);
    return false;
  }
};

// Inicjalizacja użytkowników z pliku Excel - bez zmian
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
        first_login: true,
        is_admin: isAdmin,
        permissions: getDefaultPermissions(role, isAdmin),
        mpk: row.mpk || ''
      };
    });

    // Wstawianie wsadowe użytkowników
    await db('users').insert(usersToInsert);
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
    await db('users').select('email', 'name', 'position', 'role');
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
    
    // Sprawdź czy kolumna completed_at istnieje
    if (!columnNames.includes('completed_at')) {
      await db.schema.table('transports', table => {
        table.timestamp('completed_at');
      });
    }
  } catch (error) {
    console.error('Błąd sprawdzania tabeli transportów:', error);
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
      console.error('Błąd inicjalizacji:', error);
    }
  })();
}

export default db;
