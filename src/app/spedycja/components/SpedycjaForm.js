'use client'
import { useState, useEffect } from 'react'
import { Calendar } from 'lucide-react'

export default function SpedycjaForm({ onSubmit, onCancel, initialData, isResponse, isEditing }) {
  const [selectedLocation, setSelectedLocation] = useState(initialData?.location || '')
  const [userMpk, setUserMpk] = useState('')
  const [users, setUsers] = useState([])
  const [isForOtherUser, setIsForOtherUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [currentUser, setCurrentUser] = useState({
    email: '',
    name: ''
  })
  const [distance, setDistance] = useState(initialData?.distanceKm || 0)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)
  
  // Nowe stany dla daty dostawy
  const [originalDeliveryDate, setOriginalDeliveryDate] = useState('')
  const [newDeliveryDate, setNewDeliveryDate] = useState('')
  const [changeDeliveryDate, setChangeDeliveryDate] = useState(false)
  
  // Stałe dla magazynów
  const MAGAZYNY = {
    bialystok: { 
      lat: 53.1325, 
      lng: 23.1688, 
      nazwa: 'Magazyn Białystok',
      kolor: '#0000FF'
    },
    zielonka: { 
      lat: 52.3125, 
      lng: 21.1390, 
      nazwa: 'Magazyn Zielonka',
      kolor: '#FF0000'
    }
  };

  // Pobierz listę użytkowników i dane bieżącego użytkownika na początku
  useEffect(() => {
    // Pobierz dane bieżącego użytkownika
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.isAuthenticated && data.user) {
          setCurrentUser({
            email: data.user.email || '',
            name: data.user.name || '',
            mpk: data.user.mpk || ''
          });
          setUserMpk(data.user.mpk || '');
        }
      } catch (error) {
        console.error('Błąd pobierania danych użytkownika:', error);
      }
    };

    // Pobierz listę wszystkich użytkowników
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users/list');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Błąd pobierania listy użytkowników:', error);
      }
    };

    fetchCurrentUser();
    fetchUsers();
  }, []);

  // Ustawianie początkowych danych formularza
  useEffect(() => {
    if (initialData) {
      setSelectedLocation(initialData.location || '');
      setDistance(initialData.distanceKm || 0);
      
      if (isResponse) {
        // Dla formularza odpowiedzi
        if (initialData.deliveryDate) {
          setOriginalDeliveryDate(initialData.deliveryDate);
          setNewDeliveryDate(initialData.deliveryDate);
        }
      } else if (isEditing) {
        // Dla trybu edycji
        if (initialData.responsibleEmail && initialData.responsibleEmail !== currentUser.email) {
          setIsForOtherUser(true);
          setSelectedUser(initialData.responsibleEmail);
        }
      }
    }
  }, [initialData, isResponse, isEditing, currentUser.email]);

  // Klasy dla przycisków
  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors",
    selected: "px-4 py-2 bg-blue-500 text-white rounded-md",
    unselected: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50",
    toggle: "px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors",
    toggleActive: "px-4 py-2 bg-blue-100 border border-blue-400 text-blue-700 rounded-md font-medium"
  }
  
  // Funkcja do geokodowania adresu
  async function getGoogleCoordinates(city, postalCode, street = '') {
    try {
      const address = `${street}, ${postalCode} ${city}, Poland`;
      const query = encodeURIComponent(address);
      
      // Użyj Google Maps Geocoding API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        return {
          lat: location.lat,
          lng: location.lng
        };
      }
      
      throw new Error('Nie znaleziono lokalizacji');
    } catch (error) {
      console.error('Błąd geokodowania Google:', error);
      throw error;
    }
  }
  
  // Funkcja do obliczania odległości
  async function calculateDistance(originLat, originLng, destinationLat, destinationLng) {
    try {
      // Używamy własnego endpointu proxy zamiast bezpośredniego wywołania API Google
      const url = `/api/distance?origins=${originLat},${originLng}&destinations=${destinationLat},${destinationLng}`;
      
      console.log('Wywołuję endpoint proxy:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Żądanie API nie powiodło się ze statusem: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Odpowiedź API:', data);
      
      if (data.status === 'OK' && 
          data.rows && 
          data.rows[0] && 
          data.rows[0].elements && 
          data.rows[0].elements[0] && 
          data.rows[0].elements[0].status === 'OK') {
        
        const distance = Math.round(data.rows[0].elements[0].distance.value / 1000);
        console.log(`Rzeczywista odległość drogowa: ${distance} km`);
        return distance;
      }
      
      throw new Error('Nieprawidłowa odpowiedź API');
    } catch (error) {
      console.error('Błąd obliczania odległości:', error);
      
      // Obliczanie dystansu w linii prostej z korektą
      const straightLineDistance = calculateStraightLineDistance(
        originLat, originLng, destinationLat, destinationLng
      );
      
      // Dodaj 30% do odległości w linii prostej aby przybliżyć odległość drogową
      return Math.round(straightLineDistance * 1.3);
    }
  }
  
  // Pomocnicza funkcja do obliczania odległości w linii prostej
  function calculateStraightLineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Promień Ziemi w km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Odległość w km
  }
  
  // Funkcja do obliczania odległości trasy
  const calculateRouteDistance = async (fromLocation, toLocation) => {
    try {
      setIsCalculatingDistance(true);
      let originLat, originLng, destLat, destLng;
      
      // Ustal współrzędne punktu początkowego
      if (fromLocation === 'Producent') {
        const producerCity = document.querySelector('input[name="producerCity"]').value;
        const producerPostalCode = document.querySelector('input[name="producerPostalCode"]').value;
        const producerStreet = document.querySelector('input[name="producerStreet"]').value;
        
        if (!producerCity || !producerPostalCode) {
          alert('Wprowadź dane adresowe producenta');
          setIsCalculatingDistance(false);
          return 0;
        }
        
        const originCoords = await getGoogleCoordinates(producerCity, producerPostalCode, producerStreet);
        originLat = originCoords.lat;
        originLng = originCoords.lng;
      } else {
        // Użyj współrzędnych magazynu
        const warehouseKey = fromLocation === 'Magazyn Białystok' ? 'bialystok' : 'zielonka';
        originLat = MAGAZYNY[warehouseKey].lat;
        originLng = MAGAZYNY[warehouseKey].lng;
      }
      
      // Ustal współrzędne punktu docelowego
      const destCity = document.querySelector('input[name="deliveryCity"]').value;
      const destPostalCode = document.querySelector('input[name="deliveryPostalCode"]').value;
      const destStreet = document.querySelector('input[name="deliveryStreet"]').value;
      
      if (!destCity || !destPostalCode) {
        alert('Wprowadź dane adresowe dostawy');
        setIsCalculatingDistance(false);
        return 0;
      }
      
      const destCoords = await getGoogleCoordinates(destCity, destPostalCode, destStreet);
      destLat = destCoords.lat;
      destLng = destCoords.lng;
      
      // Oblicz odległość między punktami
      const distanceKm = await calculateDistance(originLat, originLng, destLat, destLng);
      setDistance(distanceKm);
      setIsCalculatingDistance(false);
      return distanceKm;
    } catch (error) {
      console.error('Błąd obliczania odległości:', error);
      setIsCalculatingDistance(false);
      return 0;
    }
  };
  
  // Formatowanie daty do wyświetlania
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pl-PL');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (isResponse) {
      console.log('Odpowiedź na zamówienie, dane początkowe:', initialData);
      // Wykorzystaj odległość z oryginalnego zamówienia
      const distanceKm = initialData.distanceKm || 0;
      console.log('Odległość używana do obliczeń:', distanceKm);
                     
      const deliveryPrice = Number(formData.get('deliveryPrice'));
      const pricePerKm = distanceKm > 0 ? (deliveryPrice / distanceKm).toFixed(2) : 0;
      
      console.log('Obliczenia:', {
        deliveryPrice,
        distanceKm,
        pricePerKm
      });
      
      // Dodaj informację o zmianie daty dostawy
      const responseData = {
        driverName: formData.get('driverName'),
        driverSurname: formData.get('driverSurname'),
        driverPhone: formData.get('driverPhone'),
        vehicleNumber: formData.get('vehicleNumber'),
        deliveryPrice: deliveryPrice,
        distanceKm: Number(distanceKm),
        pricePerKm: Number(pricePerKm),
        adminNotes: formData.get('adminNotes')
      };
      
      // Jeśli data dostawy została zmieniona, dodaj ją do odpowiedzi
      if (changeDeliveryDate && newDeliveryDate !== originalDeliveryDate) {
        responseData.newDeliveryDate = newDeliveryDate;
        responseData.originalDeliveryDate = originalDeliveryDate;
        responseData.dateChanged = true;
      }
      
      onSubmit(initialData.id, responseData);
    } else if (isEditing) {
      // Formularz edycji
      console.log('Edycja zamówienia, dane początkowe:', initialData);
      
      // Oblicz odległość, jeśli jeszcze nie obliczona
      let routeDistance = distance;
      if (routeDistance === 0) {
        try {
          routeDistance = await calculateRouteDistance(selectedLocation, 'destination');
          console.log('Obliczona odległość:', routeDistance);
        } catch (error) {
          console.error('Błąd obliczania odległości:', error);
        }
      }
      
      const editedData = {
        location: selectedLocation,
        documents: formData.get('documents'),
        producerAddress: selectedLocation === 'Producent' ? {
          city: formData.get('producerCity'),
          postalCode: formData.get('producerPostalCode'),
          street: formData.get('producerStreet'),
          pinLocation: formData.get('producerPinLocation')
        } : null,
        delivery: {
          city: formData.get('deliveryCity'),
          postalCode: formData.get('deliveryPostalCode'),
          street: formData.get('deliveryStreet'),
          pinLocation: formData.get('deliveryPinLocation')
        },
        loadingContact: formData.get('loadingContact'),
        unloadingContact: formData.get('unloadingContact'),
        deliveryDate: formData.get('deliveryDate'),
        distanceKm: routeDistance,
        notes: formData.get('notes'),
        // Pola, które mają zostać niezmienione
        responsiblePerson: initialData.responsiblePerson,
        responsibleEmail: initialData.responsibleEmail,
        mpk: initialData.mpk,
        createdBy: initialData.createdBy,
        createdByEmail: initialData.createdByEmail
      };
      
      console.log('Dane edycji do zapisania:', editedData);
      onSubmit(initialData.id, editedData);
    } else {
      // Nowe zamówienie
      const mpk = isForOtherUser && selectedUser 
        ? (users.find(u => u.email === selectedUser)?.mpk || '')
        : userMpk;
        
      const personResponsible = isForOtherUser && selectedUser
        ? (users.find(u => u.email === selectedUser)?.name || '')
        : currentUser.name;
        
      const responsibleEmail = isForOtherUser && selectedUser
        ? selectedUser
        : currentUser.email;
      
      // Najpierw oblicz odległość, jeśli jeszcze nie obliczona
      let routeDistance = distance;
      if (routeDistance === 0) {
        try {
          routeDistance = await calculateRouteDistance(selectedLocation, 'destination');
          console.log('Obliczona odległość:', routeDistance);
        } catch (error) {
          console.error('Błąd obliczania odległości:', error);
        }
      }
      
      // Dodaj logs do debugowania
      console.log('Przygotowanie danych zamówienia do zapisania:');
      console.log('Odległość:', routeDistance);
      
      const data = {
        location: selectedLocation,
        documents: formData.get('documents'),
        producerAddress: selectedLocation === 'Producent' ? {
          city: formData.get('producerCity'),
          postalCode: formData.get('producerPostalCode'),
          street: formData.get('producerStreet'),
          pinLocation: formData.get('producerPinLocation')
        } : null,
        delivery: {
          city: formData.get('deliveryCity'),
          postalCode: formData.get('deliveryPostalCode'),
          street: formData.get('deliveryStreet'),
          pinLocation: formData.get('deliveryPinLocation')
        },
        loadingContact: formData.get('loadingContact'),
        unloadingContact: formData.get('unloadingContact'),
        deliveryDate: formData.get('deliveryDate'),
        distanceKm: routeDistance, // Upewnij się, że odległość jest zapisywana
        mpk: mpk,
        notes: formData.get('notes'),
        // Dodajemy informacje o użytkowniku dodającym i odpowiedzialnym
        createdBy: currentUser.name,
        createdByEmail: currentUser.email,
        responsiblePerson: personResponsible,
        responsibleEmail: responsibleEmail
      };
      
      console.log('Dane zamówienia do zapisania:', data);
      
      onSubmit(data);
    }
    
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">
          {isResponse ? 'Odpowiedź na zamówienie spedycji' : 
           isEditing ? 'Edycja zamówienia spedycji' : 
           'Nowe zamówienie spedycji'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses.outline}
        >
          Anuluj
        </button>
      </div>

      {isResponse ? (
        // Formularz odpowiedzi
        <>
          {/* Sekcja daty dostawy */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Calendar size={20} className="mr-2 text-blue-600" />
                <div>
                  <span className="font-medium">Podana data dostawy:</span>
                  <span className="ml-2">{formatDateForDisplay(originalDeliveryDate)}</span>
                </div>
              </div>
              <button
                type="button"
                className={changeDeliveryDate ? buttonClasses.toggleActive : buttonClasses.toggle}
                onClick={() => setChangeDeliveryDate(!changeDeliveryDate)}
              >
                {changeDeliveryDate ? 'Anuluj zmianę daty' : 'Zmienić datę dostawy?'}
              </button>
            </div>
            
            {changeDeliveryDate && (
              <div className="mt-3 pl-8">
                <label className="block text-sm font-medium mb-1">Nowa data dostawy</label>
                <input
                  type="date"
                  value={newDeliveryDate}
                  onChange={(e) => setNewDeliveryDate(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Imię kierowcy</label>
              <input
                name="driverName"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nazwisko kierowcy</label>
              <input
                name="driverSurname"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefon do kierowcy</label>
              <input
                name="driverPhone"
                type="tel"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Numery auta</label>
              <input
                name="vehicleNumber"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cena transportu</label>
              <input
                name="deliveryPrice"
                type="number"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Odległość</label>
              <input
                name="distanceKm"
                type="number"
                className="w-full p-2 border rounded-md bg-gray-100"
                value={initialData.distanceKm || 0}
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Uwagi do transportu</label>
            <textarea
              name="adminNotes"
              className="w-full p-2 border rounded-md"
              rows={3}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Miejsce załadunku</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={selectedLocation === 'Magazyn Białystok' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Magazyn Białystok')}
              >
                Magazyn Białystok
              </button>
              <button
                type="button"
                className={selectedLocation === 'Magazyn Zielonka' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Magazyn Zielonka')}
              >
                Magazyn Zielonka
              </button>
              <button
                type="button"
                className={selectedLocation === 'Producent' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Producent')}
              >
                Producent
              </button>
            </div>
          </div>

          {selectedLocation === 'Producent' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Adres producenta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Miasto</label>
                  <input
                    name="producerCity"
                    type="text"
                    className="w-full p-2 border rounded-md"
                    defaultValue={initialData?.producerAddress?.city || ''}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kod pocztowy</label>
                  <input
                    name="producerPostalCode"
                    type="text"
                    className="w-full p-2 border rounded-md"
                    defaultValue={initialData?.producerAddress?.postalCode || ''}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ulica i numer</label>
                <input
                  name="producerStreet"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  defaultValue={initialData?.producerAddress?.street || ''}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lokalizacja na mapie (opcjonalnie)
                </label>
                <input
                  name="producerPinLocation"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  defaultValue={initialData?.producerAddress?.pinLocation || ''}
                  placeholder="Link do pineski na mapie"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Numery dokumentów</label>
            <input
              name="documents"
              type="text"
              className="w-full p-2 border rounded-md"
              defaultValue={initialData?.documents || ''}
              required
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Adres dostawy</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Miasto</label>
                <input
                  name="deliveryCity"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  defaultValue={initialData?.delivery?.city || ''}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kod pocztowy</label>
                <input
                  name="deliveryPostalCode"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  defaultValue={initialData?.delivery?.postalCode || ''}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ulica i numer</label>
              <input
                name="deliveryStreet"
                type="text"
                className="w-full p-2 border rounded-md"
                defaultValue={initialData?.delivery?.street || ''}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Lokalizacja na mapie (opcjonalnie)
              </label>
              <input
                name="deliveryPinLocation"
                type="text"
                className="w-full p-2 border rounded-md"
                defaultValue={initialData?.delivery?.pinLocation || ''}
                placeholder="Link do pineski na mapie"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data dostawy</label>
            <input
              name="deliveryDate"
              type="date"
              className="w-full p-2 border rounded-md"
              defaultValue={initialData?.deliveryDate || ''}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefon na załadunek</label>
              <input
                name="loadingContact"
                type="tel"
                className="w-full p-2 border rounded-md"
                defaultValue={initialData?.loadingContact || ''}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon na rozładunek</label>
              <input
                name="unloadingContact"
                type="tel"
                className="w-full p-2 border rounded-md"
                defaultValue={initialData?.unloadingContact || ''}
                required
              />
            </div>
          </div>

          {!isEditing && (
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium mb-1">Numer MPK</label>
                <button
                  type="button"
                  onClick={() => setIsForOtherUser(!isForOtherUser)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {isForOtherUser ? 'Użyj mojego MPK' : 'To nie dla mnie'}
                </button>
              </div>
              
              {isForOtherUser ? (
                <div>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={selectedUser || ''}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                  >
                    <option value="">Wybierz osobę odpowiedzialną</option>
                    {users.map(user => (
                      <option key={user.email} value={user.email}>
                        {user.name} {user.mpk ? `(MPK: ${user.mpk})` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedUser && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                      <div className="text-sm">
                        <strong>Osoba odpowiedzialna:</strong> {users.find(u => u.email === selectedUser)?.name}
                      </div>
                      <div className="text-sm">
                        <strong>MPK:</strong> {users.find(u => u.email === selectedUser)?.mpk || 'Brak MPK'}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    name="mpk"
                    type="text"
                    value={userMpk}
                    onChange={(e) => setUserMpk(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    readOnly
                  />
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <div className="text-sm">
<strong>Osoba odpowiedzialna:</strong> {currentUser.name || 'Nie zalogowany'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isEditing && (
            <div>
              <label className="block text-sm font-medium mb-1">Numer MPK</label>
              <div className="p-2 bg-gray-50 rounded-md border border-gray-200">
                <div className="text-sm">
                  <strong>MPK:</strong> {initialData?.mpk || 'Brak MPK'}
                </div>
                <div className="text-sm">
                  <strong>Osoba odpowiedzialna:</strong> {initialData?.responsiblePerson || initialData?.createdBy || 'Nie określono'}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Uwagi</label>
            <textarea
              name="notes"
              className="w-full p-2 border rounded-md"
              rows={3}
              defaultValue={initialData?.notes || ''}
              placeholder="Dodatkowe informacje..."
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => calculateRouteDistance(selectedLocation, 'destination')}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 mb-2"
              disabled={isCalculatingDistance}
            >
              {isCalculatingDistance ? 'Obliczanie...' : 'Oblicz odległość trasy'}
            </button>
            
            {distance > 0 && (
              <div className="text-center text-green-700 bg-green-50 p-2 rounded-md">
                Odległość trasy: <strong>{distance} km</strong>
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          className={buttonClasses.primary}
        >
          {isResponse ? 'Zapisz odpowiedź' : 
           isEditing ? 'Zapisz zmiany' : 
           'Dodaj zamówienie'}
        </button>
      </div>
    </form>
  )
}
