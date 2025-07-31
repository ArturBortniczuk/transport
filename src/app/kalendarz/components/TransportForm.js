// src/app/kalendarz/components/TransportForm.js
import { useState, useEffect } from 'react'
import { KIEROWCY, POJAZDY, RYNKI, POZIOMY_ZALADUNKU } from '../constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import LocationSelector from './LocationSelector'
import ConstructionSelector from './ConstructionSelector'
import { ChevronRight } from 'lucide-react'

export default function TransportForm({
  selectedDate,
  nowyTransport,
  handleInputChange,
  handleSubmit,
  edytowanyTransport,
  handleUpdateTransport,
  setEdytowanyTransport,
  setNowyTransport,
  userPermissions,
  currentUserEmail,
  userRole,
  transporty,
  userName
}) {
  // Istniejące stany
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [showUsersList, setShowUsersList] = useState(false)
  const [showLocationSelector, setShowLocationSelector] = useState(false)
  const [recipientType, setRecipientType] = useState(nowyTransport.mpk ? 'construction' : 'person')
  const [connectToExistingTransport, setConnectToExistingTransport] = useState(false)
  const [selectedSourceTransport, setSelectedSourceTransport] = useState(null)
  const [defaultMagazyn, setDefaultMagazyn] = useState('bialystok')

  // NOWE STANY dla skanowania kodów WZ
  const [wzBuffer, setWzBuffer] = useState('')
  const [isAddingWZ, setIsAddingWZ] = useState(false)
  const [wzValidation, setWzValidation] = useState([])
  const [lastScanTime, setLastScanTime] = useState(0)

  // Funkcja sprawdzająca uprawnienia
  const canEditTransport = (transport) => {
    if (userRole === 'admin') return true
    if (userRole === 'spedytor') return true
    if (!transport) return true
    
    return transport.osobaZlecajaca === userName || 
           transport.emailZlecajacego === currentUserEmail
  }

  // Pobieranie użytkowników
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users')
        const data = await response.json()
        if (data.success) {
          setUsers(data.users)
          setFilteredUsers(data.users)
        }
      } catch (error) {
        console.error('Błąd pobierania użytkowników:', error)
      } finally {
        setIsLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  // Obsługa wyboru magazynu
  const handleMagazynSelect = (magazyn) => {
    setNowyTransport(prev => ({
      ...prev,
      magazyn: magazyn
    }))
  }

  // Zapisywanie lokalizacji
  const handleSaveLocation = async () => {
    if (!nowyTransport.miasto || !nowyTransport.kodPocztowy) {
      alert('Podaj miasto i kod pocztowy przed zapisaniem lokalizacji')
      return
    }

    try {
      const locations = JSON.parse(localStorage.getItem('savedLocations') || '[]')
      const locationToSave = {
        miasto: nowyTransport.miasto || '',
        kodPocztowy: nowyTransport.kodPocztowy || '',
        ulica: nowyTransport.ulica || '',
        nazwaKlienta: nowyTransport.nazwaKlienta || ''
      }
      
      const exists = locations.some(loc => 
        loc.miasto === locationToSave.miasto && 
        loc.kodPocztowy === locationToSave.kodPocztowy && 
        loc.ulica === locationToSave.ulica
      )
      
      if (!exists) {
        locations.push(locationToSave)
        localStorage.setItem('savedLocations', JSON.stringify(locations))
        alert('Lokalizacja została zapisana')
      } else {
        alert('Ta lokalizacja już istnieje w zapisanych lokalizacjach')
      }
    } catch (error) {
      console.error('Błąd podczas zapisywania lokalizacji:', error)
      alert('Wystąpił błąd podczas zapisywania lokalizacji')
    }
  }

  // Obsługa wyboru lokalizacji z selektora
  const handleLocationSelect = (location) => {
    setNowyTransport(prev => ({
      ...prev,
      miasto: location.miasto,
      kodPocztowy: location.kodPocztowy,
      ulica: location.ulica || '',
      nazwaKlienta: location.nazwaKlienta || ''
    }))
  }

  // Pobieranie dostępnych transportów dla połączeń
  const getAvailableTransportsForConnection = () => {
    if (!selectedDate) return []
    
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    const availableTransports = transporty[dateKey] || []
    
    return availableTransports.filter(t => 
      (t.status === 'aktywny' || t.status === 'active') && 
      !t.connected_transport_id && 
      t.id !== (edytowanyTransport?.id || 0)
    )
  }

  // ========================
  // FUNKCJE SKANOWANIA WZ
  // ========================

  // Walidacja kodu WZ
  const validateWZCode = (code) => {
    const trimmed = code.trim()
    if (trimmed.length < 5) return { valid: false, message: 'Za krótki' }
    if (!trimmed.includes('/')) return { valid: false, message: 'Brak separatorów /' }
    if (trimmed.length > 50) return { valid: false, message: 'Za długi' }
    return { valid: true, message: 'OK' }
  }

  // Obsługa zmiany pola WZ w trybie skanowania
  const handleWZChange = (e) => {
    const value = e.target.value
    const currentTime = Date.now()
    
    // WAŻNE: Tylko aktualizuj lokalny bufor, NIE główny stan transportu
    setWzBuffer(value)
    
    // Walidacja kodów w czasie rzeczywistym
    const codes = value.split(',').map(code => code.trim()).filter(code => code.length > 0)
    const validation = codes.map(validateWZCode)
    setWzValidation(validation)
    
    // Auto-separator: jeśli minęło mniej niż 100ms od ostatniej zmiany,
    // to prawdopodobnie skaner wprowadza dane bardzo szybko
    if (currentTime - lastScanTime > 100) {
      const lastCode = codes[codes.length - 1]
      
      // Sprawdź czy ostatni kod wygląda na kompletny
      if (lastCode && lastCode.length >= 8 && lastCode.includes('/') && !value.endsWith(',')) {
        // Automatycznie dodaj przecinek po krótkim opóźnieniu
        setTimeout(() => {
          setWzBuffer(prev => {
            if (prev === value && !prev.endsWith(',')) {
              return prev + ', '
            }
            return prev
          })
        }, 200)
      }
    }
    
    setLastScanTime(currentTime)
  }

  // Czyszczenie i formatowanie kodów WZ
  const cleanAndFormatWZ = (rawValue) => {
    return rawValue
      .split(',')
      .map(code => code.trim().toUpperCase())
      .filter(code => code.length > 0)
      .filter((code, index, arr) => arr.indexOf(code) === index) // usuń duplikaty
      .join(', ')
  }

  // Rozpoczęcie trybu skanowania
  const startAddingWZ = () => {
    setIsAddingWZ(true)
    // Załaduj istniejące kody do bufora (jeśli istnieją)
    setWzBuffer(nowyTransport.numerWZ || '')
    setWzValidation([])
    
    // Jeśli są już jakieś kody, natychmiast je zwaliduj
    if (nowyTransport.numerWZ) {
      const codes = nowyTransport.numerWZ.split(',').map(code => code.trim()).filter(code => code.length > 0)
      const validation = codes.map(validateWZCode)
      setWzValidation(validation)
    }
  }

  // Zakończenie trybu skanowania i zapis kodów
  const finishAddingWZ = () => {
    const cleanedCodes = cleanAndFormatWZ(wzBuffer)
    const finalCodes = cleanedCodes.split(',').map(code => code.trim())
    const allValid = finalCodes.every(code => validateWZCode(code).valid)
    
    if (!allValid) {
      const invalidCodes = finalCodes.filter(code => !validateWZCode(code).valid)
      if (!confirm(`Niektóre kody mogą być nieprawidłowe: ${invalidCodes.join(', ')}. Czy kontynuować?`)) {
        return
      }
    }
    
    setIsAddingWZ(false)
    
    // Aktualizuj stan transportu
    if (edytowanyTransport) {
      // W trybie edycji
      setNowyTransport(prev => ({
        ...prev,
        numerWZ: cleanedCodes
      }))
    } else {
      // W trybie dodawania nowego transportu
      setNowyTransport(prev => ({
        ...prev,
        numerWZ: cleanedCodes
      }))
    }
    
    setWzBuffer('')
    setWzValidation([])
  }

  // Anulowanie trybu skanowania
  const cancelAddingWZ = () => {
    setIsAddingWZ(false)
    setWzBuffer(nowyTransport.numerWZ || '')
    setWzValidation([])
  }

  // Sprawdź uprawnienia
  if (!canEditTransport(edytowanyTransport || {})) {
    return (
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6 text-center">
        <p className="text-gray-500">
          Nie masz uprawnień do dodawania lub edycji tego transportu.
        </p>
      </div>
    )
  }

  // Klasy CSS
  const inputBaseClass = "w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
  const labelBaseClass = "block text-sm font-medium text-gray-700 mb-1"
  const sectionBaseClass = "bg-white p-5 rounded-lg border-2 border-gray-200 shadow-md mb-6"
  
  return (
    <div className="mt-8">
      {/* Główny kontener formularza */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200">
        {/* Nagłówek formularza */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-5">
          <h2 className="text-2xl font-bold text-white">
            {edytowanyTransport 
              ? 'Edytuj transport' 
              : `Dodaj transport na ${format(selectedDate, 'd MMMM yyyy', { locale: pl })}`}
          </h2>
          <p className="mt-1 text-blue-100 text-sm">
            {edytowanyTransport ? 'Zaktualizuj dane transportu' : 'Wypełnij poniższy formularz aby dodać nowy transport'}
          </p>
        </div>

        {/* Wybór magazynu */}
        <div className="flex space-x-4 p-6 border-b-2 border-gray-200">
          <button
            type="button"
            onClick={() => handleMagazynSelect('bialystok')}
            className={`
              ${nowyTransport.magazyn === 'bialystok' ? 'bg-red-600 text-white shadow-lg' : 'bg-red-100 text-red-800 hover:bg-red-200'}
              ${defaultMagazyn === 'bialystok' ? 'flex-grow py-4 rounded-lg text-lg font-medium transition-colors' : 'p-2 rounded-md text-sm'}
            `}
          >
            MAGAZYN BIAŁYSTOK
          </button>
          <button
            type="button"
            onClick={() => handleMagazynSelect('zielonka')}
            className={`
              ${nowyTransport.magazyn === 'zielonka' ? 'bg-blue-600 text-white shadow-lg' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}
              ${defaultMagazyn === 'zielonka' ? 'flex-grow py-4 rounded-lg text-lg font-medium transition-colors' : 'p-2 rounded-md text-sm'}
            `}
          >
            MAGAZYN ZIELONKA
          </button>
        </div>

        {/* Formularz */}
        <form onSubmit={edytowanyTransport ? handleUpdateTransport : handleSubmit} className="p-6">
          <div className="space-y-6">
            
            {/* Sekcja łączenia transportów - tylko przy dodawaniu nowego */}
            {!edytowanyTransport && (
              <div className={sectionBaseClass}>
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  Łączenie transportów
                </h3>
                
                <div className="mb-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="connectTransport"
                      checked={connectToExistingTransport}
                      onChange={(e) => setConnectToExistingTransport(e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="connectTransport" className="ml-2 text-sm text-gray-700">
                      Połącz ten transport z istniejącym (ta sama trasa)
                    </label>
                  </div>
                  
                  {connectToExistingTransport && (
                    <div className="mt-2">
                      <label className={labelBaseClass}>
                        Wybierz transport początkowy
                      </label>
                      <select
                        value={selectedSourceTransport?.id || ""}
                        onChange={(e) => {
                          const transportId = e.target.value
                          const transport = getAvailableTransportsForConnection().find(t => t.id === parseInt(transportId))
                          setSelectedSourceTransport(transport)
                        }}
                        className={inputBaseClass}
                        disabled={!connectToExistingTransport}
                        required={connectToExistingTransport}
                      >
                        <option value="">Wybierz transport do połączenia...</option>
                        {getAvailableTransportsForConnection().map(transport => (
                          <option key={transport.id} value={transport.id}>
                            {transport.miasto} - {transport.nazwaKlienta} - {transport.kierowcaNazwa}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sekcja: Miejsce dostawy */}
            <div className={sectionBaseClass}>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Miejsce dostawy
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelBaseClass}>
                    Miasto
                  </label>
                  <input
                    type="text"
                    name="miasto"
                    value={nowyTransport.miasto}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="Nazwa miasta"
                    required
                  />
                </div>
                
                <div>
                  <label className={labelBaseClass}>
                    Kod pocztowy
                  </label>
                  <input
                    type="text"
                    name="kodPocztowy"
                    value={nowyTransport.kodPocztowy}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="00-000"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className={labelBaseClass}>
                  Ulica i numer budynku
                </label>
                <input
                  type="text"
                  name="ulica"
                  value={nowyTransport.ulica}
                  onChange={handleInputChange}
                  className={inputBaseClass}
                  placeholder="Nazwa ulicy i numer budynku"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLocationSelector(true)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  📍 Wybierz z zapisanych
                </button>
                <button
                  type="button"
                  onClick={handleSaveLocation}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                >
                  💾 Zapisz lokalizację
                </button>
              </div>
            </div>

            {/* Sekcja: Szczegóły transportu */}
            <div className={sectionBaseClass}>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Szczegóły transportu
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelBaseClass}>
                    Kierowca
                  </label>
                  <select
                    name="kierowcaId"
                    value={nowyTransport.kierowcaId}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    required
                    disabled={connectToExistingTransport && selectedSourceTransport}
                  >
                    <option value="">Wybierz kierowcę</option>
                    {KIEROWCY.map(kierowca => (
                      <option key={kierowca.id} value={kierowca.id}>
                        {kierowca.imie} - {kierowca.telefon}
                      </option>
                    ))}
                  </select>
                  {connectToExistingTransport && selectedSourceTransport && (
                    <p className="mt-1 text-xs text-blue-600">
                      Kierowca jest ustawiony automatycznie dla połączonych transportów
                    </p>
                  )}
                </div>
                
                <div>
                  <label className={labelBaseClass}>
                    Rynek
                  </label>
                  <select
                    name="rynek"
                    value={nowyTransport.rynek}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    required
                  >
                    <option value="">Wybierz rynek</option>
                    {RYNKI.map(rynek => (
                      <option key={rynek} value={rynek}>
                        {rynek.charAt(0).toUpperCase() + rynek.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* POLE NUMERÓW WZ Z FUNKCJĄ SKANOWANIA */}
                <div className="md:col-span-2">
                  <label className={labelBaseClass}>
                    Numery WZ 
                    {isAddingWZ && (
                      <span className="text-blue-600 text-sm font-medium">
                        (🔄 Tryb buforowania - zmiany NIE są automatycznie zapisywane - {wzBuffer.split(',').filter(code => code.trim().length > 0).length} kodów)
                      </span>
                    )}
                  </label>
                  
                  {!isAddingWZ ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="numerWZ"
                          value={nowyTransport.numerWZ}
                          onChange={handleInputChange}
                          className={inputBaseClass}
                          placeholder="WZ/XXXXX/YY/XXX/25"
                          required
                        />
                        <button
                          type="button"
                          onClick={startAddingWZ}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          📱 Tryb skanowania
                        </button>
                      </div>
                      
                      {/* Podgląd zapisanych kodów */}
                      {nowyTransport.numerWZ && (
                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          Zapisane kody: {nowyTransport.numerWZ.split(',').length} • {nowyTransport.numerWZ}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 border border-blue-200 rounded-lg p-3 bg-blue-50">
                      <textarea
                        value={wzBuffer}
                        onChange={handleWZChange}
                        className="w-full h-32 p-3 border border-gray-300 rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Miejsce na zeskanowane kody WZ...&#10;System automatycznie rozdzieli je przecinkami."
                        autoFocus
                      />
                      
                      {/* Status walidacji */}
                      {wzValidation.length > 0 && (
                        <div className="max-h-24 overflow-y-auto">
                          {wzBuffer.split(',').map((code, index) => {
                            const trimmed = code.trim()
                            if (!trimmed) return null
                            const validation = wzValidation[index] || { valid: false, message: 'Sprawdzanie...' }
                            
                            return (
                              <div key={index} className={`text-xs flex items-center gap-2 py-1 px-2 rounded ${
                                validation.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                <span>{validation.valid ? '✅' : '❌'}</span>
                                <span className="font-mono">{trimmed}</span>
                                <span className="ml-auto">{validation.message}</span>
                              </div>
                            )
                          }).filter(Boolean)}
                        </div>
                      )}
                      
                      {/* Przyciski kontrolne */}
                      <div className="flex gap-2 text-sm flex-wrap">
                        <button
                          type="button"
                          onClick={() => setWzBuffer(prev => prev.trim() + (prev.trim() ? ', ' : ''))}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          ➕ Dodaj separator
                        </button>
                        <button
                          type="button"
                          onClick={() => setWzBuffer('')}
                          className="px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
                        >
                          🗑️ Wyczyść
                        </button>
                        <button
                          type="button"
                          onClick={finishAddingWZ}
                          className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                        >
                          ✅ Zapisz wszystkie kody
                        </button>
                        <button
                          type="button"
                          onClick={cancelAddingWZ}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          ❌ Anuluj
                        </button>
                      </div>
                      
                      {/* Instrukcje */}
                      <div className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                        <strong>💡 Jak korzystać:</strong>
                        <br />• Skanuj kody jeden po drugim - system automatycznie je rozdzieli
                        <br />• Możesz ręcznie wpisać kody rozdzielone przecinkami  
                        <br />• Nieprawidłowe kody zostaną podświetlone na czerwono
                        <br />• <strong>🔒 Zmiany NIE są automatycznie zapisywane podczas skanowania</strong>
                        <br />• Kliknij "Zapisz wszystkie kody" gdy skończysz skanowanie
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelBaseClass}>
                    Nazwa klienta
                  </label>
                  <input
                    type="text"
                    name="nazwaKlienta"
                    value={nowyTransport.nazwaKlienta}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="Nazwa klienta/odbiorcy"
                    required
                  />
                </div>

                <div>
                  <label className={labelBaseClass}>
                    MPK
                  </label>
                  <input
                    type="text"
                    name="mpk"
                    value={nowyTransport.mpk}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="Numer MPK"
                    required
                  />
                </div>

                <div>
                  <label className={labelBaseClass}>
                    Poziom załadunku
                  </label>
                  <select
                    name="poziomZaladunku"
                    value={nowyTransport.poziomZaladunku}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    required
                  >
                    <option value="">Wybierz poziom załadunku</option>
                    {POZIOMY_ZALADUNKU.map(poziom => (
                      <option key={poziom} value={poziom}>
                        {poziom}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelBaseClass}>
                    Dokumenty magazynowe
                  </label>
                  <textarea
                    name="dokumenty"
                    value={nowyTransport.dokumenty || ''}
                    onChange={handleInputChange}
                    className={`${inputBaseClass} h-20`}
                    placeholder="Lista dokumentów magazynowych..."
                  />
                </div>
              </div>
            </div>

            {/* Sekcja: Osoba zlecająca */}
            <div className={sectionBaseClass}>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Osoba zlecająca
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelBaseClass}>
                    Imię i nazwisko
                  </label>
                  <input
                    type="text"
                    name="osobaZlecajaca"
                    value={nowyTransport.osobaZlecajaca}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="Imię i nazwisko zlecającego"
                    required
                  />
                </div>
                
                <div>
                  <label className={labelBaseClass}>
                    Email zlecającego
                  </label>
                  <input
                    type="email"
                    name="emailZlecajacego"
                    value={nowyTransport.emailZlecajacego}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="email@example.com"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Sekcja: Uwagi */}
            <div className={sectionBaseClass}>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Informacje dodatkowe
              </h3>
              
              <div>
                <div>
                  <label className={labelBaseClass}>
                    Uwagi dodatkowe
                  </label>
                  <textarea
                    name="informacje"
                    value={nowyTransport.informacje || ''}
                    onChange={handleInputChange}
                    className={`${inputBaseClass} h-24`}
                    placeholder="Dodatkowe informacje o transporcie..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Przyciski formularza */}
          <div className="mt-6 flex gap-4">
            <button
              type="submit"
              className="flex-1 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
            >
              {edytowanyTransport ? 'Zapisz zmiany' : 'Dodaj transport'}
            </button>
            
            {edytowanyTransport && (
              <button
                type="button"
                onClick={() => {
                  setEdytowanyTransport(null)
                  setNowyTransport({
                    miasto: '',
                    kodPocztowy: '',
                    ulica: '',
                    informacje: '',
                    dataDostawy: '',
                    status: 'aktywny',
                    kierowcaId: '',
                    pojazdId: '',
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
                    connectedTransportId: null
                  })
                }}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                Anuluj edycję
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Selektor lokalizacji */}
      {showLocationSelector && (
        <LocationSelector 
          onSelect={handleLocationSelect} 
          onClose={() => setShowLocationSelector(false)}
        />
      )}
    </div>
  )
}
