import { NextResponse } from 'next/server'
 
export function middleware(request) {
  // Sprawdź, czy użytkownik jest zalogowany przez ciasteczko HTTP-only
  const authToken = request.cookies.get('authToken')?.value
  
  // Publiczne ścieżki, dostępne bez logowania
  const publicPaths = ['/login', '/']
  
  // Jeśli to publiczna ścieżka, pozwól na dostęp
  if (publicPaths.includes(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  // Jeśli użytkownik nie jest zalogowany, przekieruj do strony logowania
  if (!authToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Pozwól na dostęp do pozostałych stron
  return NextResponse.next()
}
 
// Określ, które ścieżki mają być chronione przez middleware
export const config = {
  matcher: [
    '/kalendarz/:path*', 
    '/mapa/:path*', 
    '/admin/:path*',
    '/spedycja/:path*',
    '/kurier/:path*',
    '/archiwum/:path*',
    '/change-password/:path*'
  ]
}