'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminCheck({ children }) {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        console.log('Sprawdzanie uprawnień administratora...');
        // Pobierz informacje z API
        const response = await fetch('/api/check-admin');
        const data = await response.json();
        
        console.log('Wynik sprawdzania uprawnień admina:', data);
        
        if (!data.isAdmin) {
          console.log('Brak uprawnień admina, przekierowuję...');
          router.push('/');
        } else {
          console.log('Użytkownik ma uprawnienia administratora');
          setIsVerified(true);
        }
      } catch (error) {
        console.error('Błąd sprawdzania uprawnień administratora:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  // Pokaż zawartość dopiero po zweryfikowaniu uprawnień
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-gray-600">Weryfikacja uprawnień...</div>
      </div>
    );
  }

  if (!isVerified) {
    return null;
  }

  return children;
}