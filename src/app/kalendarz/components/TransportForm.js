import { useState, useEffect } from 'react'
import { KIEROWCY, RYNKI, POZIOMY_ZALADUNKU } from '../constants'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import LocationSelector from './LocationSelector' // Nowy import

export default function TransportForm({
  selectedDate,
  nowyTransport,
  handleInputChange,
  handleSubmit,
  edytowanyTransport,
  handleUpdateTransport,
  setEdytowanyTransport,
  setNowyTransport,
  userPermissions // Dodajemy props z uprawnieniami
}) {
  const [users, setUsers] = useState([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredUsers, setFilteredUsers] = useState([])
  const [showUsersList, setShowUsersList] = useState(false)
  const [showLocationSelector, setShowLocationSelector] = useState(false) // Nowy stan

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch('/api/users/list')
        if (response.ok) {
          const data = await response.json()
          setUsers(data)
          setFilteredUsers(data)
        }
      } catch (error) {
        console.error('Błąd pobierania użytkowników:', error)
      } finally {
        setIsLoadingUsers(false)
      }
    }

    fetchUsers()
  }, [])

  // Filtrowanie użytkowników na podstawie wpisanego tekstu
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users)
    } else {
      const filtered = users.filter(user => 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.mpk && user.mpk.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredUsers(filtered)
    }
  }, [searchTerm, users])

  const handleUserSelect = (user) => {
    console.log('Wybrany użytkownik:', user); // Dodaj log
    
    setNowyTransport(prev => {
      const updated = {
        ...prev,
        osobaZlecajaca: user.name,
        emailZlecajacego: user.email,
        mpk: user.mpk || ''
      };
      console.log('Aktualizacja transportu z MPK:', updated); // Dodaj log
      return updated;
    });
    
    setSearchTerm(user.name);
    setShowUsersList(false);
  }

  const handleMagazynSelect = (magazyn) => {
    setNowyTransport(prev => ({
      ...prev,
      magazyn: magazyn
    }))
  }

  // Funkcja do zapisywania lokalizacji
  const saveCurrentLocation = () => {
    if (!nowyTransport.miasto || !nowyTransport.kodPocztowy) {
      alert('Uzupełnij przynajmniej miasto i kod pocztowy, aby zapisać lokalizację');
      return;
    }
    
    try {
      // Pobierz aktualną listę zapisanych lokalizacji
      const savedLocations = localStorage.getItem('savedLocations');
      let locations = [];
      
      if (savedLocations) {
        locations = JSON.parse(savedLocations);
      }
      
      // Przygotuj lokalizację do zapisania
      const locationToSave = {
        miasto: nowyTransport.miasto,
        kodPocztowy: nowyTransport.kodPocztowy,
        ulica: nowyTransport.ulica || '',
        nazwaKlienta: nowyTransport.nazwaKlienta || ''
      };
      
      // Sprawdź czy lokalizacja już istnieje
      const exists = locations.some(loc => 
        loc.miasto === locationToSave.miasto && 
        loc.kodPocztowy === locationToSave.kodPocztowy && 
        loc.ulica === locationToSave.ulica
      );
      
      if (!exists) {
        // Dodaj nową lokalizację i zapisz
        locations.push(locationToSave);
        localStorage.setItem('savedLocations', JSON.stringify(locations));
        alert('Lokalizacja została zapisana');
      } else {
        alert('Ta lokalizacja już istnieje w zapisanych lokalizacjach');
      }
    } catch (error) {
      console.error('Błąd podczas zapisywania lokalizacji:', error);
      alert('Wystąpił błąd podczas zapisywania lokalizacji');
    }
  };
  
  // Funkcja obsługująca wybór lokalizacji z selektora
  const handleLocationSelect = (location) => {
    setNowyTransport(prev => ({
      ...prev,
      miasto: location.miasto,
      kodPocztowy: location.kodPocztowy,
      ulica: location.ulica || '',
      nazwaKlienta: location.nazwaKlienta || ''
    }));
  };

  const canEditCalendar = userPermissions?.calendar?.edit === true;
  
  // Jeśli użytkownik nie ma uprawnień, nie wyświetlaj formularza
  if (!canEditCalendar) {
    return (
      <div className="mt-8 bg-white rounded-xl shadow-lg p-6 text-center">
        <p className="text-gray-500">
          Nie masz uprawnień do dodawania lub edycji transportów.
        </p>
      </div>
    );
  }

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
            {edytowanyTransport ? 'Edytuj transport' : `Dodaj transport na ${format(selectedDate, 'd MMMM yyyy', { locale: pl })}`}
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
            className={`flex-1 py-4 rounded-lg text-lg font-medium transition-colors ${
              nowyTransport.magazyn === 'bialystok' 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            MAGAZYN BIAŁYSTOK
          </button>
          <button
            type="button"
            onClick={() => handleMagazynSelect('zielonka')}
            className={`flex-1 py-4 rounded-lg text-lg font-medium transition-colors ${
              nowyTransport.magazyn === 'zielonka' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
          >
            MAGAZYN ZIELONKA
          </button>
        </div>

        {/* Formularz */}
        <form onSubmit={edytowanyTransport ? handleUpdateTransport : handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Sekcja: Lokalizacja */}
            <div className={sectionBaseClass}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Lokalizacja dostawy
                </h3>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowLocationSelector(true)}
                    className="px-3 py-1 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50"
                  >
                    Wczytaj z listy
                  </button>
                  <button
                    type="button"
                    onClick={saveCurrentLocation}
                    className="px-3 py-1 text-sm border border-green-300 text-green-600 rounded hover:bg-green-50"
                  >
                    Zapisz lokalizację
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="md:col-span-2">
                  <label className={labelBaseClass}>
                    Ulica i numer
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
                  >
                    <option value="">Wybierz kierowcę</option>
                    {KIEROWCY.map(kierowca => (
                      <option key={kierowca.id} value={kierowca.id}>
                        {kierowca.imie} - {kierowca.tabliceRej}
                      </option>
                    ))}
                  </select>
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

                <div>
                  <label className={labelBaseClass}>
                    Numer WZ
                  </label>
                  <input
                    type="text"
                    name="numerWZ"
                    value={nowyTransport.numerWZ}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    placeholder="WZ/XXXXX/YY/XXX/25"
                    required
                  />
                </div>

                <div>
                  <label className={labelBaseClass}>
                    Poziom napełnienia
                  </label>
                  <select
                    name="poziomZaladunku"
                    value={nowyTransport.poziomZaladunku}
                    onChange={handleInputChange}
                    className={inputBaseClass}
                    required
                  >
                    <option value="">0%</option>
                    {POZIOMY_ZALADUNKU.map(poziom => (
                      <option key={poziom} value={poziom}>{poziom}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sekcja: Informacje dodatkowe */}
            <div className={sectionBaseClass}>
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Informacje dodatkowe
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelBaseClass}>
                    Nazwa klienta
                  </label>
                  <input
                    type="text"
                    name="nazwaKlienta"
                    value={nowyTransport.nazwaKlienta}
                    onChange={handleInputChange}
                    placeholder="Firma"
                    className={inputBaseClass}
                    required
                  />
                </div>

                {/* Pole wyszukiwania użytkowników */}
                <div>
                  <label className={labelBaseClass}>
                    Osoba odpowiedzialna
                  </label>
                  {isLoadingUsers ? (
                    <div className="animate-pulse h-10 bg-gray-200 rounded"></div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setShowUsersList(true)
                        }}
                        onFocus={() => setShowUsersList(true)}
                        placeholder="Wpisz, aby wyszukać osobę"
                        className={inputBaseClass}
                        required
                      />
                      {showUsersList && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map(user => (
                              <div
                                key={user.email}
                                onClick={() => handleUserSelect(user)}
                                className="p-2 hover:bg-gray-100 cursor-pointer"
                              >
                                <div className="font-medium">{user.name}</div>
                                {user.mpk && (
                                  <div className="text-sm text-gray-500">MPK: {user.mpk}</div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="p-2 text-gray-500">Brak wyników</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Pole wyświetlające numer MPK */}
                <div>
                  <label className={labelBaseClass}>
                    MPK
                  </label>
                  <input
                    type="text"
                    name="mpk"
                    value={nowyTransport.mpk || ''}
                    className={inputBaseClass}
                    readOnly
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
                    numerWZ: '',
                    nazwaKlienta: '',
                    osobaZlecajaca: '',
                    emailZlecajacego: '',
                    mpk: '',
                    rynek: '',
                    poziomZaladunku: '',
                    dokumenty: '',
                    trasaCykliczna: false,
                    magazyn: 'bialystok'
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
