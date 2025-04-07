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
        // Przetwórz dane do formatu używanego przez komponenty
        const processedData = data.spedycje.map(item => ({
          id: item.id,
          status: item.status,
          createdBy: item.created_by,
          createdByEmail: item.created_by_email,
          responsiblePerson: item.responsible_person,
          responsibleEmail: item.responsible_email,
          mpk: item.mpk,
          location: item.location,
          producerAddress: item.location_data,
          delivery: item.delivery_data,
          loadingContact: item.loading_contact,
          unloadingContact: item.unloading_contact,
          deliveryDate: item.delivery_date,
          documents: item.documents,
          notes: item.notes,
          response: item.response_data,
          completedAt: item.completed_at,
          createdAt: item.created_at
        }))
        
        setZamowienia(processedData)
      } else {
        throw new Error(data.error || 'Błąd pobierania danych')
      }
    } catch (error) {
      console.error('Błąd pobierania danych spedycji:', error)
      setError('Wystąpił problem podczas pobierania danych. Spróbuj ponownie później.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDodajZamowienie = async (noweZamowienie) => {
    try {
      // Wysyłamy dane do API
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
      } else {
        alert(`Błąd: ${data.error || 'Nie udało się dodać zlecenia'}`)
      }
    } catch (error) {
      console.error('Błąd dodawania zlecenia:', error)
      alert('Wystąpił błąd podczas dodawania zlecenia')
    }
  }

  const handleResponse = async (zamowienieId, response) => {
    try {
      // Wysyłamy odpowiedź do API
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
        // Odświeżamy listę po odpowiedzi
        setShowForm(false)
        fetchSpedycje()
      } else {
        alert(`Błąd: ${data.error || 'Nie udało się zapisać odpowiedzi'}`)
      }
    } catch (error) {
      console.error('Błąd odpowiedzi na zlecenie:', error)
      alert('Wystąpił błąd podczas zapisywania odpowiedzi')
    }
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
          <button 
            className={showArchive ? buttonClasses.primary : buttonClasses.outline}
            onClick={() => setShowArchive(true)}
          >
            <Archive size={18} />
            Archiwum
          </button>
          
          {isAdmin && (
            <Link href="/archiwum-spedycji" className={buttonClasses.outline}>
              Pełne archiwum
            </Link>
          )}
          
          {canAddOrder && (
            <button 
              className={buttonClasses.primary}
              onClick={() => setShowForm(true)}
            >
              Nowe zamówienie
            </button>
          )}
        </div>
      </div>

      {/* Lista zamówień */}
      {!showForm && (
        <div className="bg-white rounded-lg shadow">
          {zamowienia.length > 0 ? (
            <SpedycjaList
              zamowienia={zamowienia}
              showArchive={showArchive}
              isAdmin={canRespond}
              onResponse={(zamowienie) => {
                setSelectedZamowienie(zamowienie)
                setShowForm(true)
              }}
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
