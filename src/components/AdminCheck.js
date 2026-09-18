// src/components/AdminCheck.js
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminCheck({ children, moduleType, requiredPermission }) {
  const router = useRouter()
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const mod = moduleType || requiredPermission

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        console.log(`Sprawdzanie uprawnień administratora dla modułu: ${mod || 'wszystkie'}`);
        
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
        // Sprawdź uprawnienia do konkretnego modułu, jeśli określono mod
        else if (mod && data.permissions?.admin?.[mod]) {
          console.log(`Użytkownik ma uprawnienia do modułu ${mod}`);
          hasAccess = true;
        }
        // Jeśli nie określono modułu (główna strona admina) 
        // ale ma jakiekolwiek uprawnienia admin
        else if (!mod && data.permissions?.admin && 
                (data.permissions.admin.users ||
                 data.permissions.admin.valuation ||
                 data.permissions.admin.packagings || 
                 data.permissions.admin.constructions ||
                 data.permissions.admin.cable_advices)) {
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
  }, [router, mod]);

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
