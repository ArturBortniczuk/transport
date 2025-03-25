import { NextResponse } from 'next/server';
import { serialize } from 'cookie';
import db from '@/database/db';

export async function POST(request) {
  try {
    // Pobierz token sesji z ciasteczka
    const authToken = request.cookies.get('authToken')?.value;
    
    if (authToken) {
      // Usuń sesję z bazy danych - zaktualizowane do Knex
      await db('sessions')
        .where('token', authToken)
        .delete();
      
      // Przygotuj ciasteczka do usunięcia
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0, // Wygaśnij natychmiast
        path: '/'
      };
      
      const authCookie = serialize('authToken', '', cookieOptions);
      const roleCookie = serialize('userRole', '', { ...cookieOptions, httpOnly: false });
      
      const response = NextResponse.json({ 
        success: true 
      });
      
      // Dodaj ciasteczka do odpowiedzi
      response.headers.append('Set-Cookie', authCookie);
      response.headers.append('Set-Cookie', roleCookie);
      
      return response;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Błąd serwera: ' + error.message
    }, {
      status: 500
    });
  }
}