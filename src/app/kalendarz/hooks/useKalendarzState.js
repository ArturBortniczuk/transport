// src/app/kalendarz/hooks/useKalendarzState.js
'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'

export default function useKalendarzState() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  const [transporty, setTransporty] = useState({})
  const [userRole, setUserRole] = useState(null)
  const [edytowanyTransport, setEdytowanyTransport] = useState(null)
  const [przenoszonyTransport, setPrzenoszonyTransport] = useState(null)
  const [nowaData, setNowaData] = useState('')
  const [userPermissions, setUserPermissions] = useState({})
  const [userMpk, setUserMpk] = useState('')
  const [nowyTransport, setNowyTransport] = useState({
    miasto: '',
    kodPocztowy: '',
    ulica: '',
    informacje: '',
    status: 'aktywny',
    kierowcaId: '',
    numerWZ: '',
    nazwaKlienta: '',
    osobaZlecajaca: '',
    emailZlecajacego: '',
    mpk: '',
    rynek: '',
    poziomZaladunku: '',
    dokumenty: '',
    trasaCykliczna: false,
    magazyn: 'bialystok',
    packagingId: null
  })
  const [filtryAktywne, setFiltryAktywne] = useState({
    magazyn: '',
    kierowca: '',
    rynek: '',
    pokazZrealizowane: true
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userId, setUserId] = useState(null)
  const [zamowienia, setZamowienia] = useState([])
  
  // Stan dla modalnego potwierdzenia
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    transport: null,
    newDate: null
  });

  // Inicjalizacja stanu przy montowaniu komponentu
  useEffect(() => {
    const role = localStorage.getItem('userRole')
    const id = localStorage.getItem('userId')
    const mpk = localStorage.getItem('userMpk')
    console.log('Ustawiam rolę, ID i MPK:', { role, id, mpk })
    setUserRole(role)
    setUserId(id)
    setUserMpk(mpk)
    
    // Ładowanie uprawnień
    try {
      const permissionsStr = localStorage.getItem('userPermissions')
      if (permissionsStr) {
        const permissions = JSON.parse(permissionsStr)
        console.log('Załadowane uprawnienia:', permissions)
        setUserPermissions(permissions)
      } else {
        console.log('Brak uprawnień w localStorage')
        // Ustaw domyślne uprawnienia
        setUserPermissions({
          calendar: { edit: role === 'magazyn' },
          transport: { markAsCompleted: role === 'magazyn' }
        })
      }
    } catch (e) {
      console.error('Błąd parsowania uprawnień:', e)
      // Ustaw domyślne uprawnienia w przypadku błędu
      setUserPermissions({
        calendar: { edit: role === 'magazyn' },
        transport: { markAsCompleted: role === 'magazyn' }
      })
    }
    
    const savedZamowienia = localStorage.getItem('zamowieniaSpedycja')
    if (savedZamowienia) {
      setZamowienia(JSON.parse(savedZamowienia))
    }
  }, [])

  // Funkcja do pobierania uprawnień z API
  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();
      
      if (data.isAuthenticated && data.user) {
        setUserPermissions(data.user.permissions || {});
      }
    } catch (error) {
      console.error('Błąd pobierania uprawnień użytkownika:', error);
    }
  };

  return {
    currentMonth, setCurrentMonth,
    selectedDate, setSelectedDate,
    transporty, setTransporty,
    userRole, setUserRole,
    edytowanyTransport, setEdytowanyTransport,
    przenoszonyTransport, setPrzenoszonyTransport,
    nowaData, setNowaData,
    userPermissions, setUserPermissions,
    userMpk, setUserMpk,
    nowyTransport, setNowyTransport,
    filtryAktywne, setFiltryAktywne,
    isLoading, setIsLoading,
    error, setError,
    userId, setUserId,
    zamowienia, setZamowienia,
    confirmModal, setConfirmModal,
    fetchUserPermissions
  }
}