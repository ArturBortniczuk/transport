// src/components/AdminCheck.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminCheck({ children, moduleType }) {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        console.log(`Sprawdzanie uprawnień administratora dla modułu: ${moduleType || 'wszystkie'}`);
        
        // Pobierz informacje z API
        const response = await fetch('/api/check-admin');
        const data = await response.json();
        
        console.log('Wynik sprawdzania uprawnień admina:', data);
        
        // Sprawdź czy użytkownik ma dostęp
        let hasAccess = false;
        
        // Pełne uprawnienia administratora
        if (data.isAdmin) {
          console.log('Użytkownik ma pełne uprawnienia administratora');
          hasAccess = true;
        } 
        // Sprawdź uprawnienia do konkretnego modułu, jeśli określono moduleType
        else if (moduleType && data.permissions?.admin?.[moduleType]) {
          console.log(`Użytkownik ma uprawnienia do modułu ${moduleType}`);
          hasAccess = true;
        }
        // Jeśli nie określono moduleType (główna strona admina) 
        // ale ma jakiekolwiek uprawnienia admin
        else if (!moduleType && data.permissions?.admin && 
                (data.permissions.admin.packagings || 
                 data.permissions.admin.constructions)) {
          console.log('Użytkownik ma częściowe uprawnienia administratora');
          hasAccess = true;
        }
        
        if (hasAccess) {
          setIsVerified(true);
        } else {
          console.log('Brak uprawnień, przekierowuję...');
          router.push('/');
        }
      } catch (error) {
        console.error('Błąd sprawdzania uprawnień administratora:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [router, moduleType]);

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
