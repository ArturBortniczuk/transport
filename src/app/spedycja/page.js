// src/app/spedycja/page.js
'use client'
import { useState, useEffect } from 'react'
import SpedycjaForm from './components/SpedycjaForm'
import SpedycjaList from './components/SpedycjaList'
import Link from 'next/link'
import { Clipboard, Archive } from 'lucide-react'

export default function SpedycjaPage() {
  const [zamowienia, setZamowienia] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedZamowienie, setSelectedZamowienie] = useState(null)
  const [showArchive, setShowArchive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2"
  }

  useEffect(() => {
    const role = localStorage.getItem('userRole')
    setUserRole(role)
    
    // Sprawdź czy użytkownik jest administratorem
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/check-admin')
        const data = await response.json()
        setIsAdmin(data.isAdmin)
      } catch (error) {
        console.error('Błąd sprawdzania uprawnień administratora:', error)
        setIsAdmin(false)
      }
    }
    
    checkAdmin()
    fetchSpedycje()
  }, [showArchive])

  const fetchSpedycje = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Pobierz dane z API z filtrem statusu
      const status = showArchive ? 'completed' : 'new'
      const response = await fetch(`/api/spedycje?status=${status}`)
      
      if (!response.ok) {
        throw new Error(`Problem z API: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log('Pobrane dane z API:', data.spedycje)
        setZamowienia(data.spedycje)
      } else {
        // Próbujemy pobrać dane z localStorage dla kompatybilności
        const savedData = localStorage.getItem('zamowieniaSpedycja')
        if (savedData) {
          const parsedData = JSON.parse(savedData)
          const filteredData = showArchive 
            ? parsedData.filter(item => item.status === 'completed')
            : parsedData.filter(item => item.status === 'new')
          setZamowienia(filteredData)
          return
        }
        
        throw new Error(data.error || 'Błąd pobierania danych')
      }
    } catch (error) {
      console.error('Błąd pobierania danych spedycji:', error)
      
      // Próbujemy pobrać dane z localStorage dla kompatybilności
      const savedData = localStorage.getItem('zamowieniaSpedycja')
      if (savedData) {
        const parsedData = JSON.parse(savedData)
        const filteredData = showArchive 
          ? parsedData.filter(item => item.status === 'completed')
          : parsedData.filter(item => item.status === 'new')
        setZamowienia(filteredData)
      } else {
        setError('Wystąpił problem podczas pobierania danych. Spróbuj ponownie później.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDodajZamowienie = async (noweZamowienie) => {
    try {
      console.log('Dodawanie nowego zamówienia:', noweZamowienie)
      
      // Najpierw spróbuj zapisać do API
      try {
        const response = await fetch('/api/spedycje', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(noweZamowienie)
        })
        
        const data = await response.json()
        
        if (data.success) {
          // Odświeżamy listę po dodaniu
          fetchSpedycje()
          setShowForm(false)
          return
        }
      } catch (apiError) {
        console.error('Błąd API, używam localStorage:', apiError)
      }
      
      // Zapisz do localStorage jeśli API zawiedzie
      const zamowienieWithDetails = {
        ...noweZamowienie,
        id: Date.now(),
        status: 'new',
        createdAt: new Date().toISOString()
      }

      const savedData = localStorage.getItem('zamowieniaSpedycja')
      const currentZamowienia = savedData ? JSON.parse(savedData) : []
      const updatedZamowienia = [...currentZamowienia, zamowienieWithDetails]
      localStorage.setItem('zamowieniaSpedycja', JSON.stringify(updatedZamowienia))
      
      fetchSpedycje()
      setShowForm(false)
    } catch (error) {
      console.error('Błąd dodawania zlecenia:', error)
      alert('Wystąpił błąd podczas dodawania zlecenia')
    }
  }

  const handleResponse = async (zamowienieId, response) => {
    try {
      console.log('Odpowiedź na zamówienie ID:', zamowienieId, 'Dane odpowiedzi:', response)
      
      // Najpierw spróbuj użyć API
      try {
        const responseApi = await fetch('/api/spedycje', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: zamowienieId,
            ...response
          })
        })
        
        const data = await responseApi.json()
        
        if (data.success) {
          setShowForm(false)
          fetchSpedycje()
          return
        }
      } catch (apiError) {
        console.error('Błąd API, używam localStorage:', apiError)
      }
      
      // Aktualizuj w localStorage jeśli API zawiedzie
      const savedData = localStorage.getItem('zamowieniaSpedycja')
      if (savedData) {
        const zamowienia = JSON.parse(savedData)
        const updatedZamowienia = zamowienia.map(zam => {
          if (zam.id === zamowienieId) {
            return { 
              ...zam, 
              status: 'completed', 
              response,
              completedAt: new Date().toISOString()
            }
          }
          return zam
        })
        
        localStorage.setItem('zamowieniaSpedycja', JSON.stringify(updatedZamowienia))
        fetchSpedycje()
      }
      
      setShowForm(false)
    } catch (error) {
      console.error('Błąd odpowiedzi na zlecenie:', error)
      alert('Wystąpił błąd podczas zapisywania odpowiedzi')
    }
  }

  // Funkcja do pobierania szczegółowych danych zamówienia przed odpowiedzią
  const handlePrepareResponse = async (zamowienie) => {
    console.log('Przygotowanie odpowiedzi dla zamówienia:', zamowienie)
    
    // Sprawdź, czy zamówienie ma już wszystkie niezbędne dane
    if (zamowienie.distanceKm || (zamowienie.distance_km !== undefined && zamowienie.distance_km !== null)) {
      console.log('Zamówienie już ma dane o odległości:', zamowienie.distanceKm || zamowienie.distance_km)
      setSelectedZamowienie(zamowienie)
      setShowForm(true)
      return
    }
    
    // Próbujemy pobrać pełne dane zamówienia z API
    try {
      const response = await fetch(`/api/spedycje/${zamowienie.id}`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.spedycja) {
          console.log('Pobrane szczegółowe dane zamówienia:', data.spedycja)
          setSelectedZamowienie(data.spedycja)
        } else {
          console.log('Używam dostępnych danych zamówienia:', zamowienie)
          setSelectedZamowienie(zamowienie)
        }
      } else {
        console.log('Błąd pobierania szczegółów, używam dostępnych danych:', zamowienie)
        setSelectedZamowienie(zamowienie)
      }
    } catch (error) {
      console.error('Błąd pobierania szczegółów zamówienia:', error)
      setSelectedZamowienie(zamowienie)
    }
    
    setShowForm(true)
  }

  // Sprawdzanie, czy użytkownik może dodawać zamówienia
  const canAddOrder = isAdmin || userRole === 'handlowiec'
  // Odpowiadać mogą magazynierzy i admini
  const canRespond = isAdmin || userRole === 'magazyn'

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Zamówienia spedycji
        </h1>
          <div className="flex gap-2">
            <button 
              className={!showArchive ? buttonClasses.primary : buttonClasses.outline}
              onClick={() => setShowArchive(false)}
            >
              <Clipboard size={18} />
              Aktywne
            </button>
            <Link 
              href="/archiwum-spedycji"
              className={buttonClasses.outline}
            >
              <Archive size={18} />
              Archiwum
            </Link>
            
            {canAddOrder && (
              <button 
                className={buttonClasses.primary}
                onClick={() => {
                  setSelectedZamowienie(null)
                  setShowForm(true)
                }}
              >
                Nowe zamówienie
              </button>
            )}
          </div>

      {/* Lista zamówień */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow">
          {zamowienia.length > 0 ? (
            <SpedycjaList
              zamowienia={zamowienia}
              showArchive={showArchive}
              isAdmin={canRespond}
              onResponse={handlePrepareResponse}
            />
          ) : (
            <div className="p-12 text-center text-gray-500">
              {showArchive ? 'Brak zarchiwizowanych zleceń spedycji' : 'Brak aktywnych zleceń spedycji'}
            </div>
          )}
        </div>
      )}

      {/* Formularz */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <SpedycjaForm 
              onSubmit={selectedZamowienie ? handleResponse : handleDodajZamowienie}
              onCancel={() => {
                setShowForm(false)
                setSelectedZamowienie(null)
              }}
              initialData={selectedZamowienie}
              isResponse={!!selectedZamowienie}
            />
          </div>
        </div>
      )}
    </div>
  )
}
