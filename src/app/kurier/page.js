'use client'
import { useState, useEffect } from 'react'
import KurierForm from './components/KurierForm'
import ZamowieniaList from './components/ZamowieniaList'

export default function KurierPage() {
  const [zamowienia, setZamowienia] = useState([])
  const [userRole, setUserRole] = useState(null)
  const [userInfo, setUserInfo] = useState(null)
  const [canView, setCanView] = useState(true)
  const [canAddOrder, setCanAddOrder] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchUserInfo = async () => {
    try {
      const res = await fetch('/api/user')
      const data = await res.json()
      if (data.isAuthenticated && data.user) {
        setUserInfo(data.user)
        setUserRole(data.user.role)
        const isAdmin = Boolean(data.user.isAdmin);
        const permissions = data.user.permissions || {};
        setCanView(isAdmin || permissions.courier?.view !== false);
        setCanAddOrder(isAdmin || Boolean(permissions.courier?.add));
      } else {
        const localRole = localStorage.getItem('userRole')
        setUserRole(localRole)
      }
    } catch {
      const localRole = localStorage.getItem('userRole')
      setUserRole(localRole)
    }
  }

  const fetchZamowienia = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/kuriers')
      const data = await res.json()
      if (data.success && Array.isArray(data.orders)) {
        setZamowienia(data.orders)
        localStorage.setItem('zamowieniaKurier', JSON.stringify(data.orders))
        return
      }
      throw new Error(data.error || 'Błąd pobierania')
    } catch (err) {
      console.error('Błąd API kurierów, używam localStorage:', err)
      const savedZamowienia = localStorage.getItem('zamowieniaKurier')
      if (savedZamowienia) {
        try {
          setZamowienia(JSON.parse(savedZamowienia))
        } catch (e) {
          console.error('Błąd parsowania localStorage:', e)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserInfo()
    fetchZamowienia()
  }, [])

  const handleDodajZamowienie = async (noweZamowienie) => {
    try {
      const payload = {
        ...noweZamowienie,
        status: 'oczekujące',
        magazynZamawiajacy: userRole
      }

      const res = await fetch('/api/kuriers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      let createdOrder
      if (data.success && data.order) {
        createdOrder = data.order
      } else {
        createdOrder = {
          ...payload,
          id: Date.now(),
          dataDodania: new Date().toISOString()
        }
      }

      const updatedZamowienia = [createdOrder, ...zamowienia]
      setZamowienia(updatedZamowienia)
      localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
      setShowForm(false)
    } catch (error) {
      console.error('Błąd dodawania zamówienia kuriera:', error)
      const fallbackOrder = {
        ...noweZamowienie,
        id: Date.now(),
        status: 'oczekujące',
        dataDodania: new Date().toISOString(),
        magazynZamawiajacy: userRole
      }
      const updatedZamowienia = [fallbackOrder, ...zamowienia]
      setZamowienia(updatedZamowienia)
      localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
      setShowForm(false)
    }
  }

  const handleZatwierdzZamowienie = async (zamowienieId) => {
    try {
      await fetch('/api/kuriers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: zamowienieId, status: 'zatwierdzone' })
      })
    } catch (error) {
      console.error('Błąd zatwierdzania w API:', error)
    }

    const updatedZamowienia = zamowienia.map(zam =>
      zam.id === zamowienieId ? { ...zam, status: 'zatwierdzone' } : zam
    )
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
  }

  const handleUsunZamowienie = async (zamowienieId) => {
    try {
      await fetch(`/api/kuriers?id=${zamowienieId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Błąd usuwania w API:', error)
    }

    const updatedZamowienia = zamowienia.filter(zam => zam.id !== zamowienieId)
    setZamowienia(updatedZamowienia)
    localStorage.setItem('zamowieniaKurier', JSON.stringify(updatedZamowienia))
  }

  if (!canView) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-red-600 bg-white rounded-xl shadow-lg">
        Brak uprawnień do przeglądania przesyłek kurierskich
      </div>
    )
  }

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
        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-500">
            Ładowanie zamówień kuriera...
          </div>
        ) : (
          <ZamowieniaList
            zamowienia={zamowienia}
            onZatwierdz={handleZatwierdzZamowienie}
            onUsun={handleUsunZamowienie}
            userRole={userRole}
          />
        )}
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