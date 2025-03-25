'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoutCleanup() {
  const router = useRouter()
  
  // Obsługa zdarzenia wylogowania
  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
      })
      
      // Przekieruj do strony logowania
      router.push('/login')
    } catch (error) {
      console.error('Błąd wylogowania:', error)
    }
  }
  
  useEffect(() => {
    // Dodaj nasłuchiwanie na zdarzenie wylogowania
    window.addEventListener('app-logout', handleLogout)
    
    return () => {
      window.removeEventListener('app-logout', handleLogout)
    }
  }, [router])
  
  return null
}