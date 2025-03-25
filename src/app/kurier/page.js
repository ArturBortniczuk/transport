'use client'
import { useState, useEffect } from 'react'
import KurierForm from './components/KurierForm'
import ZamowieniaList from './components/ZamowieniaList'

export default function KurierPage() {
  const [zamowienia, setZamowienia] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const role = localStorage.getItem('userRole')
    setUserRole(role)
    
    const savedZamowienia = localStorage.getItem('zamowieniaKurier')
    if (savedZamowienia) {
      setZamowienia(JSON.parse(savedZamowienia))
    }
  }, [])

  const handleDodajZamowienie = (noweZamowienie) => {
    const zamowienieWithDetails = {
      ...noweZamowienie,
      id: Date.now(),
      status: 'oczekujące',
      dataDodania: new Date().toISOString(),
      magazynZamawiajacy: userRole
    }

    const updatedZamowienia = [...zamowienia, zamowienieWithDetails]
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
    setShowForm(false) // Chowamy formularz po dodaniu zamówienia
  }

  const handleZatwierdzZamowienie = async (zamowienieId) => {
    // Tutaj później dodamy integrację z API DHL
    const updatedZamowienia = zamowienia.map(zam =>
      zam.id === zamowienieId ? { ...zam, status: 'zatwierdzone' } : zam
    )
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
  }

  const handleUsunZamowienie = (zamowienieId) => {
    const updatedZamowienia = zamowienia.filter(zam => zam.id !== zamowienieId)
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
  }

const canAddOrder = userRole === 'handlowiec' || userRole === 'magazyn'
  const canRespond = userRole === 'magazyn'
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Zamówienia kuriera
        </h1>
        {canAddOrder && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 flex items-center space-x-2 transition-all"
          >
            <span>{showForm ? 'Anuluj' : 'Nowe zamówienie'}</span>
          </button>
        )}
      </div>

      {/* Lista zamówień jest zawsze widoczna */}
      <div className={`transition-all duration-500 ${showForm ? 'opacity-50' : 'opacity-100'}`}>
        <ZamowieniaList
          zamowienia={zamowienia}
          onZatwierdz={handleZatwierdzZamowienie}
          onUsun={handleUsunZamowienie}
          userRole={userRole}
        />
      </div>

      {/* Formularz jest wyświetlany jako modal po kliknięciu przycisku */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <KurierForm 
              onSubmit={handleDodajZamowienie} 
              magazynNadawcy={userRole}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}