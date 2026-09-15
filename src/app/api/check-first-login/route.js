// src/app/api/check-first-login/route.js
import { NextResponse } from 'next/server';
import db from '@/database/db';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const sessionResult = await getSessionUser(request);
    
    if (!sessionResult?.isAuthenticated || !sessionResult?.user) {
      return NextResponse.json({ 
        shouldChangePassword: false
      });
    }

    const email = sessionResult.user.email;
    const user = await db('users')
      .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
      .select('first_login')
      .first()
      .catch(() => null);

    return NextResponse.json({ 
      shouldChangePassword: user?.first_login === true || user?.first_login === 1
    });

  } catch (error) {
    console.error('Check first login error:', error);
    return NextResponse.json({ 
      shouldChangePassword: false 
    });
  }
}