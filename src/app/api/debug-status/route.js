import { NextResponse } from 'next/server';
import db from '@/database/db';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const result = {
    timestamp: new Date().toISOString(),
    cookies: {
      eltron_auth_token: !!request.cookies.get('eltron_auth_token')?.value,
      authToken: !!request.cookies.get('authToken')?.value,
      all_cookie_names: request.cookies.getAll().map(c => c.name)
    },
    database: null,
    supabase_auth: null
  };

  // 1. Test Knex Database (Transports count)
  try {
    const dbRes = await db.raw('SELECT 1 as connected, count(*) as transports_count FROM transports');
    result.database = {
      success: true,
      transports_count: dbRes.rows[0]?.transports_count
    };
  } catch (err) {
    result.database = {
      success: false,
      error: err.message
    };
  }

  // 2. Test Supabase Client REST
  try {
    const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    result.supabase_auth = {
      success: !error,
      profiles_count: count,
      error: error?.message || null
    };
  } catch (err) {
    result.supabase_auth = {
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
