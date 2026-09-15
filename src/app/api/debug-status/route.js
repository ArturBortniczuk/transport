import { NextResponse } from 'next/server';
import db from '@/database/db';
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
    knex_test: null,
    supabase_test: null
  };

  // Test Knex
  try {
    const knexRes = await db.raw('SELECT 1 as connected, NOW() as time');
    result.knex_test = {
      success: true,
      rows: knexRes.rows
    };
  } catch (err) {
    result.knex_test = {
      success: false,
      error: err.message,
      code: err.code
    };
  }

  // Test Supabase Client REST
  try {
    const { count, error } = await supabase.from('transports').select('*', { count: 'exact', head: true });
    result.supabase_test = {
      success: !error,
      count: count,
      error: error?.message || null
    };
  } catch (err) {
    result.supabase_test = {
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
