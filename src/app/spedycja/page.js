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
    
    const savedZamowienia = localStorage.getItem('zamowieniaSpedycja')
    if (savedZamowienia) {
      setZamowienia(JSON.parse(savedZamowienia))
    }
  }, [])

  const handleDodajZamowienie = (noweZamowienie) => {
    const zamowienieWithDetails = {
      ...noweZamowienie,
      id: Date.now(),
      status: 'new',
      requestedBy: userRole,
      createdAt: new Date().toISOString()
    }

    const updatedZamowienia = [...zamowienia, zamowienieWithDetails]
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaSpedycja', JSON.stringify(updatedZamowienia))
    setShowForm(false)
  }

  const handleResponse = (zamowienieId, response) => {
    const updatedZamowienia = zamowienia.map(zam =>
      zam.id === zamowienieId ? { 
        ...zam, 
        status: 'completed',
        response,
        completedAt: new Date().toISOString()
      } : zam
    )
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaSpedycja', JSON.stringify(updatedZamowienia))
  }

  // Tworzenie funkcji do sprawdzania, czy użytkownik może dodawać zamówienia
  const canAddOrder = isAdmin || userRole === 'handlowiec'
  // Odpowiadać mogą magazynierzy i admini
  const canRespond = isAdmin || userRole === 'magazyn'

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
          <SpedycjaList
            zamowienia={zamowienia}
            showArchive={showArchive}
            isAdmin={canRespond}
            onResponse={(zamowienie) => {
              setSelectedZamowienie(zamowienie)
              setShowForm(true)
            }}
          />
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
