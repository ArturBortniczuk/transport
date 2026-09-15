import { NextResponse } from 'next/server'
 
export function middleware(request) {
  // Sprawdź, czy użytkownik posiada ciasteczko SSO lub token sesji
  const allCookies = request.cookies.getAll();
  const hasAuth = allCookies.some(c => 
    c.name.includes('eltron_auth_token') || 
    c.name.includes('auth-token') || 
    c.name === 'authToken' ||
    c.name.startsWith('sb-')
  );
  
  const pathname = request.nextUrl.pathname;

  // Jeśli użytkownik jest już zalogowany i wchodzi na stronę główną lub logowania, przekieruj do kalendarza
  if (hasAuth && (pathname === '/' || pathname === '/login')) {
    return NextResponse.redirect(new URL('/kalendarz', request.url));
  }

  // Publiczne ścieżki, dostępne bez logowania
  const publicPaths = ['/login', '/'];
  
  // Jeśli to publiczna ścieżka, pozwól na dostęp
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Jeśli użytkownik nie jest zalogowany, przekieruj do strony logowania
  if (!hasAuth) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Pozwól na dostęp do pozostałych stron
  return NextResponse.next();
}
 
// Określ, które ścieżki mają być chronione przez middleware
export const config = {
  matcher: [
    '/',
    '/login',
    '/kalendarz/:path*', 
    '/mapa/:path*', 
    '/admin/:path*',
    '/spedycja/:path*',
    '/kurier/:path*',
    '/archiwum/:path*',
    '/archiwum-spedycji/:path*',
    '/change-password/:path*'
  ]
}

