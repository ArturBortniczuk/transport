'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthCheck({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const publicPaths = ['/', '/login'];
        
        // Jeśli to publiczna ścieżka, nie sprawdzaj uwierzytelnienia
        if (publicPaths.includes(pathname)) {
          setIsChecking(false);
          return;
        }
        
        // Pobierz informacje o zalogowanym użytkowniku
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (!data.isAuthenticated) {
          router.push('/login');
        }
      } catch (error) {
        console.error('Błąd sprawdzania autoryzacji:', error);
        router.push('/login');
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isChecking) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-gray-600">Sprawdzanie uprawnień...</div>
      </div>
    );
  }

  return children;
}