import { NextResponse } from 'next/server';
import db from '@/database/db';
import knex from 'knex';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const result = {
    timestamp: new Date().toISOString(),
    environment: {
      has_DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_HOST: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1] || 'invalid-format' : 'missing',
      has_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL,
      has_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !!process.env.SUPABASE_ANON_KEY,
    },
    cookies: {
      eltron_auth_token: !!request.cookies.get('eltron_auth_token')?.value,
      authToken: !!request.cookies.get('authToken')?.value,
      all_cookie_names: request.cookies.getAll().map(c => c.name)
    },
    knex_main_db: null,
    knex_direct_supabase: null,
    supabase_rest: null
  };

  // 1. Test Knex Main DB
  try {
    const knexRes = await db.raw('SELECT 1 as connected, count(*) as transports_count FROM transports');
    result.knex_main_db = {
      success: true,
      rows: knexRes.rows
    };
  } catch (err) {
    result.knex_main_db = {
      success: false,
      error: err.message,
      code: err.code
    };
  }

  // 2. Test Direct Supabase Knex
  try {
    const directDb = knex({
      client: 'pg',
      connection: {
        connectionString: 'postgresql://postgres:narzedziaeltron@db.vwnjmcxwqrfykeexocqi.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
      },
      pool: { min: 0, max: 2 },
      acquireConnectionTimeout: 10000
    });
    const directRes = await directDb.raw('SELECT 1 as direct_ok, count(*) as total_transports FROM transports');
    result.knex_direct_supabase = {
      success: true,
      rows: directRes.rows
    };
    await directDb.destroy().catch(() => {});
  } catch (err) {
    result.knex_direct_supabase = {
      success: false,
      error: err.message
    };
  }

  // 3. Test Supabase Client REST
  try {
    const { count, error } = await supabase.from('transports').select('*', { count: 'exact', head: true });
    result.supabase_rest = {
      success: !error,
      count: count,
      error: error?.message || null
    };
  } catch (err) {
    result.supabase_rest = {
      success: false,
      error: err.message
    };
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}
