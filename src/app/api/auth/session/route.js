import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const sessionData = await getSessionUser(request);
    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Błąd sprawdzania sesji:', error);
    return NextResponse.json({ 
      isAuthenticated: false, 
      user: null, 
      error: 'Błąd serwera' 
    }, { status: 500 });
  }
}
