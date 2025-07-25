// src/database/db.js
import knex from 'knex';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';
import { migrateKuriersTable } from './kuriers-migration.js';


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
    }

    const packagingsExists = await db.schema.hasTable('packagings');
    if (!packagingsExists) {
      await db.schema.createTable('packagings', table => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.float('weight');
        table.string('unit').defaultTo('kg');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
    }

    // Tabela ocen transportów
    const ratingsExists = await db.schema.hasTable('transport_ratings');
    if (!ratingsExists) {
      await db.schema.createTable('transport_ratings', table => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable();
        table.string('rater_email').notNullable();
        table.string('rater_name');
        table.integer('rating').notNullable();
        table.text('comment');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.foreign('transport_id').references('id').inTable('transports');
        table.unique(['transport_id', 'rater_email']);
      });
      console.log('Tabela transport_ratings została utworzona');
    } else {
      console.log('Tabela transport_ratings już istnieje');
      
      // Sprawdź czy kolumna is_positive istnieje
      const columns = await db.raw(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transport_ratings' 
        AND table_schema = 'public'
      `);
      
      const columnNames = columns.rows.map(row => row.column_name);
      const hasIsPositive = columnNames.includes('is_positive');
      const hasRating = columnNames.includes('rating');
      
      if (!hasIsPositive) {
        await db.schema.table('transport_ratings', table => {
          table.boolean('is_positive').defaultTo(true);
        });
        
        // Migracja danych tylko jeśli stara kolumna istnieje
        if (hasRating) {
          const ratings = await db('transport_ratings').select('id', 'rating');
          for (const rating of ratings) {
            await db('transport_ratings')
              .where('id', rating.id)
              .update({ is_positive: rating.rating >= 3 });
          }
        }
      }
    }
    
    // Tabela budów
    const constructionsExists = await db.schema.hasTable('constructions');
    if (!constructionsExists) {
      await db.schema.createTable('constructions', table => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('mpk').notNullable();
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
    }
    
    // Tabela spedycji
    const spedycjeExists = await db.schema.hasTable('spedycje');
    if (!spedycjeExists) {
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
        table.text('merged_transports');
      });
    }

    // Tabela kurierów - TYLKO ZAMÓWIENIA (bez zapytań)
    const kuriersExists = await db.schema.hasTable('kuriers');
    if (!kuriersExists) {
      await db.schema.createTable('kuriers', table => {
        table.increments('id').primary();
        table.string('status').defaultTo('new');
        table.string('created_by_email');
        table.string('magazine_source');
        table.string('magazine_destination');
        table.string('recipient_name');
        table.string('recipient_address');
        table.string('recipient_phone');
        table.string('package_description');
        table.text('notes');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('completed_at');
        table.string('completed_by');
      });
      console.log('Tabela kuriers została utworzona');
    } else {
      console.log('Tabela kuriers już istnieje');
    }

    return true;
  } catch (error) {
    console.error('Błąd inicjalizacji bazy danych:', error);
    return false;
  }
}

// Funkcja do inicjalizacji użytkowników z pliku Excel
const initializeUsersFromExcel = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    // Sprawdź, czy w bazie już są użytkownicy
    const existingUsers = await db('users').count('* as count').first();
    if (existingUsers.count > 0) {
      console.log('Użytkownicy już istnieją w bazie danych');
      return;
    }

    const excelPath = path.join(process.cwd(), 'src', 'data', 'users.xlsx');
    
    if (!fs.existsSync(excelPath)) {
      console.log('Plik users.xlsx nie istnieje - pomijam inicjalizację użytkowników');
      return;
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    for (const row of data) {
      try {
        await db('users').insert({
          email: row.email?.toLowerCase(),
          name: row.name,
          position: row.position,
          phone: row.phone,
          password: row.password,
          role: row.role,
          first_login: true,
          is_admin: row.is_admin === 'TRUE' || row.is_admin === true,
          permissions: row.permissions ? JSON.stringify(JSON.parse(row.permissions)) : null,
          mpk: row.mpk
        });
        console.log(`Dodano użytkownika: ${row.email}`);
      } catch (insertError) {
        console.error(`Błąd dodawania użytkownika ${row.email}:`, insertError.message);
      }
    }

    console.log('Inicjalizacja użytkowników z Excel zakończona');
  } catch (error) {
    console.error('Błąd inicjalizacji użytkowników z Excel:', error);
  }
};

// Funkcja do wyświetlania wszystkich użytkowników
const showAllUsers = async () => {
  if (isBuildPhase) {
    return;
  }
  
  try {
    const users = await db('users').select('*');
    console.log('Lista wszystkich użytkowników w bazie:', users.length);
    users.forEach(user => {
      console.log(`- ${user.email} (${user.name}) - Rola: ${user.role}, Admin: ${user.is_admin}`);
    });
  } catch (error) {
    console.error('Błąd pobierania użytkowników:', error);
  }
};

// Funkcja sprawdzająca tabelę transportów
const checkTransportsTable = async () => {
  try {
    const tableExists = await db.schema.hasTable('transports');
    if (!tableExists) {
      console.log('Tabela transports nie istnieje');
      return;
    }

    // Sprawdź kolumny
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transports' 
      AND table_schema = 'public'
    `);
    
    const columnNames = columns.rows.map(row => row.column_name);
    console.log('Kolumny w tabeli transports:', columnNames);

    // Dodaj brakujące kolumny dla wniosków transportowych
    if (!columnNames.includes('wz_number')) {
      await db.schema.table('transports', table => {
        table.string('wz_number');
      });
      console.log('Dodano kolumnę wz_number do tabeli transports');
    }

    if (!columnNames.includes('market')) {
      await db.schema.table('transports', table => {
        table.string('market');
      });
      console.log('Dodano kolumnę market do tabeli transports');
    }

    if (!columnNames.includes('real_client_name')) {
      await db.schema.table('transports', table => {
        table.string('real_client_name');
      });
      console.log('Dodano kolumnę real_client_name do tabeli transports');
    }

    if (!columnNames.includes('goods_description')) {
      await db.schema.table('transports', table => {
        table.text('goods_description');
      });
      console.log('Dodano kolumnę goods_description do tabeli transports');
    }

    if (!columnNames.includes('responsible_constructions')) {
      await db.schema.table('transports', table => {
        table.text('responsible_constructions');
      });
      console.log('Dodano kolumnę responsible_constructions do tabeli transports');
    }

    if (!columnNames.includes('client_name')) {
      await db.schema.table('transports', table => {
        table.string('client_name');
      });
      console.log('Dodano kolumnę client_name do tabeli transports');
    }

  } catch (error) {
    console.error('Błąd sprawdzania tabeli transports:', error);
  }
};

// Funkcja sprawdzająca tabelę spedycji
const checkSpedycjeTable = async () => {
  try {
    const tableExists = await db.schema.hasTable('spedycje');
    if (!tableExists) {
      console.log('Tabela spedycje nie istnieje');
      return;
    }

    // Sprawdź kolumny
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'spedycje' 
      AND table_schema = 'public'
    `);
    
    const columnNames = columns.rows.map(row => row.column_name);
    console.log('Kolumny w tabeli spedycje:', columnNames);

    // Sprawdź czy kolumna distance_km istnieje
    if (!columnNames.includes('distance_km')) {
      await db.schema.table('spedycje', table => {
        table.integer('distance_km');
      });
      console.log('Dodano kolumnę distance_km do tabeli spedycje');
    }
    
    // Sprawdź czy kolumny związane z zamówieniem istnieją
    if (!columnNames.includes('order_sent')) {
      await db.schema.table('spedycje', table => {
        table.boolean('order_sent').defaultTo(false);
        table.timestamp('order_sent_at');
        table.string('order_sent_by');
        table.string('order_recipient');
        table.text('order_data');
      });
      console.log('Dodano kolumny zamówienia do tabeli spedycje');
    }
    
    // Sprawdź czy nowe kolumny istnieją
    if (!columnNames.includes('client_name')) {
      await db.schema.table('spedycje', table => {
        table.string('client_name');
      });
      console.log('Dodano kolumnę client_name do tabeli spedycje');
    }
    
    if (!columnNames.includes('goods_description')) {
      await db.schema.table('spedycje', table => {
        table.text('goods_description');
      });
      console.log('Dodano kolumnę goods_description do tabeli spedycje');
    }
    
    if (!columnNames.includes('responsible_constructions')) {
      await db.schema.table('spedycje', table => {
        table.text('responsible_constructions');
      });
      console.log('Dodano kolumnę responsible_constructions do tabeli spedycje');
    }
  } catch (error) {
    console.error('Błąd sprawdzania tabeli spedycje:', error);
  }
};

// Funkcja sprawdzająca czy tabela transportów ma odpowiednie referencje dla ocen
const checkTransportsTableForRatings = async () => {
  try {
    // Sprawdź czy tabela transportów ma kolumnę ID
    const transportsExists = await db.schema.hasTable('transports');
    if (!transportsExists) {
      console.log('Tabela transportów nie istnieje - podstawowa wersja zostanie utworzona w initializeDatabase');
      return;
    }
    
    // Sprawdź czy mamy kolumnę status
    const columns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transports' 
      AND table_schema = 'public'
    `);
    
    const columnNames = columns.rows.map(row => row.column_name);
    
    if (!columnNames.includes('status')) {
      await db.schema.table('transports', table => {
        table.string('status').defaultTo('active');
      });
      console.log('Dodano kolumnę status do tabeli transports');
    }
    
    if (!columnNames.includes('completed_at')) {
      await db.schema.table('transports', table => {
        table.timestamp('completed_at');
      });
      console.log('Dodano kolumnę completed_at do tabeli transports');
    }
    
  } catch (error) {
    console.error('Błąd sprawdzania tabeli transportów dla ocen:', error);
  }
};

// Funkcja sprawdzająca i tworząca tabele szczegółowych ocen
const checkDetailedRatingsTable = async () => {
  try {
    console.log('Sprawdzanie tabeli transport_detailed_ratings...');
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('transport_detailed_ratings');
    if (!tableExists) {
      console.log('Tworzenie tabeli transport_detailed_ratings...');
      
      await db.schema.createTable('transport_detailed_ratings', table => {
        table.increments('id').primary();
        table.integer('transport_id').notNullable();
        table.string('rater_email').notNullable();
        table.timestamp('rated_at').defaultTo(db.fn.now());
        
        // Kategoria: Kierowca
        table.boolean('driver_professional');
        table.boolean('driver_tasks_completed');
        
        // Kategoria: Towar
        table.boolean('cargo_complete');
        table.boolean('cargo_correct');
        
        // Kategoria: Organizacja dostawy
        table.boolean('delivery_notified');
        table.boolean('delivery_on_time');
        
        // Dodatkowy komentarz
        table.text('comment');
        
        // Upewnij się, że jeden użytkownik może ocenić transport tylko raz
        table.unique(['transport_id', 'rater_email']);
        
        // Indeksy
        table.index('transport_id');
        table.index('rater_email');
        
        // Klucz obcy do tabeli transportów
        table.foreign('transport_id').references('id').inTable('transports').onDelete('CASCADE');
      });
      
      console.log('Tabela transport_detailed_ratings została utworzona');
    } else {
      console.log('Tabela transport_detailed_ratings już istnieje');
    }
    
    // Utwórz widok dla statystyk
    await createRatingSummaryView();
    
  } catch (error) {
    console.error('Błąd sprawdzania/tworzenia tabeli transport_detailed_ratings:', error);
  }
};

// Funkcja tworząca widok dla statystyk ocen
const createRatingSummaryView = async () => {
  try {
    console.log('Tworzenie widoku transport_rating_summary...');
    
    // Usuń widok jeśli istnieje (żeby móc go zaktualizować)
    await db.raw('DROP VIEW IF EXISTS transport_rating_summary');
    
    // Utwórz nowy widok
    await db.raw(`
      CREATE VIEW transport_rating_summary AS
      SELECT 
        transport_id,
        COUNT(*) as total_ratings,
        
        -- Statystyki dla kategorii Kierowca
        COUNT(CASE WHEN driver_professional = true THEN 1 END) as driver_professional_positive,
        COUNT(CASE WHEN driver_professional = false THEN 1 END) as driver_professional_negative,
        COUNT(CASE WHEN driver_tasks_completed = true THEN 1 END) as driver_tasks_positive,
        COUNT(CASE WHEN driver_tasks_completed = false THEN 1 END) as driver_tasks_negative,
        
        -- Statystyki dla kategorii Towar
        COUNT(CASE WHEN cargo_complete = true THEN 1 END) as cargo_complete_positive,
        COUNT(CASE WHEN cargo_complete = false THEN 1 END) as cargo_complete_negative,
        COUNT(CASE WHEN cargo_correct = true THEN 1 END) as cargo_correct_positive,
        COUNT(CASE WHEN cargo_correct = false THEN 1 END) as cargo_correct_negative,
        
        -- Statystyki dla kategorii Organizacja dostawy
        COUNT(CASE WHEN delivery_notified = true THEN 1 END) as delivery_notified_positive,
        COUNT(CASE WHEN delivery_notified = false THEN 1 END) as delivery_notified_negative,
        COUNT(CASE WHEN delivery_on_time = true THEN 1 END) as delivery_on_time_positive,
        COUNT(CASE WHEN delivery_on_time = false THEN 1 END) as delivery_on_time_negative,
        
        -- Ogólny wynik (średnia wszystkich pozytywnych ocen)
        ROUND(
          (
            COUNT(CASE WHEN driver_professional = true THEN 1 END) +
            COUNT(CASE WHEN driver_tasks_completed = true THEN 1 END) +
            COUNT(CASE WHEN cargo_complete = true THEN 1 END) +
            COUNT(CASE WHEN cargo_correct = true THEN 1 END) +
            COUNT(CASE WHEN delivery_notified = true THEN 1 END) +
            COUNT(CASE WHEN delivery_on_time = true THEN 1 END)
          )::decimal / 
          NULLIF(
            COUNT(CASE WHEN driver_professional IS NOT NULL THEN 1 END) +
            COUNT(CASE WHEN driver_tasks_completed IS NOT NULL THEN 1 END) +
            COUNT(CASE WHEN cargo_complete IS NOT NULL THEN 1 END) +
            COUNT(CASE WHEN cargo_correct IS NOT NULL THEN 1 END) +
            COUNT(CASE WHEN delivery_notified IS NOT NULL THEN 1 END) +
            COUNT(CASE WHEN delivery_on_time IS NOT NULL THEN 1 END), 0
          ) * 100, 1
        ) as overall_rating_percentage
        
      FROM transport_detailed_ratings
      GROUP BY transport_id
    `);
    
    console.log('Widok transport_rating_summary został utworzony');
    
  } catch (error) {
    console.error('Błąd tworzenia widoku transport_rating_summary:', error);
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
      await checkSpedycjeTable();
      
      // Wywołania dla szczegółowych ocen:
      await checkTransportsTableForRatings();
      await checkDetailedRatingsTable();
      
      // NOWA MIGRACJA TABELI KURIERS
      console.log('🚀 Uruchamiam migrację tabeli kuriers...');
      await migrateKuriersTable();
      
      console.log('Wszystkie tabele zostały sprawdzone i utworzone (łącznie z migracją kuriers)');
    } catch (error) {
      console.error('Błąd inicjalizacji:', error);
    }
  })();
}

export default db;
