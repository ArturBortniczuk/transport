import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const host = request.headers.get('host') || '';
    const domainStr = host.includes('grupaeltron.pl') ? '; Domain=.grupaeltron.pl' : '';
    const secureStr = process.env.NODE_ENV === 'production' ? '; Secure' : '';

    const response = NextResponse.json({ success: true });

    // Wyczyść wszystkie ciasteczka sesji
    response.headers.append('Set-Cookie', `authToken=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${domainStr}${secureStr}`);
    response.headers.append('Set-Cookie', `userRole=; Path=/; Max-Age=0; SameSite=Lax${domainStr}${secureStr}`);
    response.headers.append('Set-Cookie', `eltron_auth_token=; Path=/; Max-Age=0; SameSite=Lax${domainStr}${secureStr}`);

    return response;
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