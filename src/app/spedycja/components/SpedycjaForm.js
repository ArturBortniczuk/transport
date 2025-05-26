'use client'
import { useState, useEffect, useRef } from 'react'
import { Calendar, Search, X, Info, Truck, PlusCircle } from 'lucide-react'

export default function SpedycjaForm({ onSubmit, onCancel, initialData, isResponse, isEditing }) {
  const [selectedLocation, setSelectedLocation] = useState(initialData?.location || '')
  const [users, setUsers] = useState([])
  const [constructions, setConstructions] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedConstructions, setSelectedConstructions] = useState([])
  const [deliveryPrice, setDeliveryPrice] = useState(initialData?.response?.deliveryPrice || 0)
  const [currentUser, setCurrentUser] = useState({
    email: '',
    name: ''
  })
  const [distance, setDistance] = useState(initialData?.distanceKm || 0)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)
  
  // Nowe stany dla autokompletacji
  const [searchTerm, setSearchTerm] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  // Nowe stany dla daty dostawy
  const [originalDeliveryDate, setOriginalDeliveryDate] = useState('')
  const [newDeliveryDate, setNewDeliveryDate] = useState('')
  const [changeDeliveryDate, setChangeDeliveryDate] = useState(false)
  
  // Nowe stany dla opisu towaru
  const [showGoodsDescription, setShowGoodsDescription] = useState(false)
  const [goodsDescription, setGoodsDescription] = useState({
    description: initialData?.goodsDescription?.description || '',
    weight: initialData?.goodsDescription?.weight || ''
  })
  
  // Stan dla obsługi wielu transportów
  const [connectedTransports, setConnectedTransports] = useState([])
  const [availableTransports, setAvailableTransports] = useState([])
  const [showTransportsSection, setShowTransportsSection] = useState(false)
  
  // Stałe dla magazynów
  const MAGAZYNY = {
    bialystok: { 
      lat: 53.1325, 
      lng: 23.1688, 
      nazwa: 'Magazyn Białystok',
      adres: {
        firma: 'Grupa Eltron Sp. z o.o.',
        ulica: 'ul. Wysockiego 69B',
        kod: '15-169',
        miasto: 'Białystok'
      },
      kolor: '#0000FF'
    },
    zielonka: { 
      lat: 52.3125, 
      lng: 21.1390, 
      nazwa: 'Magazyn Zielonka',
      adres: {
        firma: 'Grupa Eltron Sp. z o.o.',
        ulica: 'ul. Krótka 2',
        kod: '05-220',
        miasto: 'Zielonka'
      },
      kolor: '#FF0000'
    }
  };

  // Pobierz listę użytkowników, budów i dane bieżącego użytkownika
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
          
          // Pre-select the current user
          if (!isEditing && !initialData) {
            setSelectedUser({
              email: data.user.email,
              name: data.user.name,
              mpk: data.user.mpk || ''
            });
          }
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
        
        // Map the data to a consistent format
        const formattedUsers = data.map(user => ({
          email: user.email,
          name: user.name,
          mpk: user.mpk || '',
          type: 'user'
        }));
        
        setUsers(formattedUsers);
      } catch (error) {
        console.error('Błąd pobierania listy użytkowników:', error);
      }
    };
    
    // Pobierz listę budów
    const fetchConstructions = async () => {
      try {
        const response = await fetch('/api/constructions');
        const data = await response.json();
        
        if (data.constructions) {
          const formattedConstructions = data.constructions.map(construction => ({
            id: construction.id,
            name: construction.name,
            mpk: construction.mpk || '',
            type: 'construction'
          }));
          
          setConstructions(formattedConstructions);
        }
      } catch (error) {
        console.error('Błąd pobierania listy budów:', error);
      }
    };
    
    // Pobierz dostępne transporty (dla isResponse)
    const fetchAvailableTransports = async () => {
      if (!isResponse) return;
      
      try {
        const response = await fetch('/api/spedycje?status=new');
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.spedycje) {
            // Filtruj, żeby nie pokazywać bieżącego transportu
            const filteredTransports = data.spedycje.filter(t => 
              t.id !== (initialData?.id || 0) && t.status === 'new'
            );
            setAvailableTransports(filteredTransports);
          }
        }
      } catch (error) {
        console.error('Błąd pobierania dostępnych transportów:', error);
      }
    };

    fetchCurrentUser();
    fetchUsers();
    fetchConstructions();
    fetchAvailableTransports();
  }, [isEditing, initialData, isResponse]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Ustawianie początkowych danych formularza
  useEffect(() => {
    if (initialData) {
      setSelectedLocation(initialData.location || '');
      setDistance(initialData.distanceKm || 0);
      
      // Ustaw opis towaru, jeśli istnieje
      if (initialData.goodsDescription) {
        setGoodsDescription({
          description: initialData.goodsDescription.description || '',
          weight: initialData.goodsDescription.weight || ''
        });
        setShowGoodsDescription(true);
      }
      
      // Ustaw połączone transporty, jeśli istnieją
      if (initialData.connectedTransports && initialData.connectedTransports.length > 0) {
        setConnectedTransports(initialData.connectedTransports);
        setShowTransportsSection(true);
      }
      
      if (isResponse) {
        // Dla formularza odpowiedzi
        if (initialData.deliveryDate) {
          setOriginalDeliveryDate(initialData.deliveryDate);
          setNewDeliveryDate(initialData.deliveryDate);
        }
      } else if (isEditing) {
        // Dla trybu edycji
        if (initialData.responsibleEmail) {
          const responsibleUser = users.find(u => u.email === initialData.responsibleEmail);
          if (responsibleUser) {
            setSelectedUser(responsibleUser);
            setSearchTerm(responsibleUser.name);
          }
        }
        
        // Ustaw budowy, jeśli są powiązane
        if (initialData.responsibleConstructions && initialData.responsibleConstructions.length > 0) {
          setSelectedConstructions(initialData.responsibleConstructions);
        }
      }
    }
  }, [initialData, isResponse, isEditing, users, constructions]);

  // Klasy dla przycisków
  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2",
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
      if (fromLocation === 'Odbiory własne') {
        const producerCity = document.querySelector('input[name="producerCity"]').value;
        const producerPostalCode = document.querySelector('input[name="producerPostalCode"]').value;
        const producerStreet = document.querySelector('input[name="producerStreet"]').value;
        
        if (!producerCity || !producerPostalCode) {
          alert('Wprowadź dane adresowe punktu odbioru');
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
  
  // Handle user search
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
  };
  
  // Funkcja obsługująca zmianę w opisie towaru
  const handleGoodsDescriptionChange = (e) => {
    const { name, value } = e.target;
    setGoodsDescription(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Funkcja do dodawania połączonego transportu
  const handleAddConnectedTransport = (transport) => {
    if (!transport) return;
    
    // Sprawdź czy transport nie jest już dodany
    if (connectedTransports.some(t => t.id === transport.id)) {
      return;
    }
    
    setConnectedTransports(prev => [
      ...prev, 
      {
        id: transport.id,
        orderNumber: transport.orderNumber,
        route: `${transport.location === 'Odbiory własne' ? 
          (transport.producerAddress?.city || 'Odbiory własne') : 
          transport.location.replace('Magazyn ', '')} → ${transport.delivery?.city || 'Brak danych'}`,
        responsiblePerson: transport.responsiblePerson,
        mpk: transport.mpk,
        order: connectedTransports.length + 1,
        type: 'loading' // domyślnie jako załadunek
      }
    ]);
  };
  
  // Funkcja do usuwania połączonego transportu
  const handleRemoveConnectedTransport = (id) => {
    setConnectedTransports(prev => prev.filter(t => t.id !== id));
  };
  
  // Funkcja do zmiany kolejności transportu
  const handleChangeTransportOrder = (id, newOrder) => {
    setConnectedTransports(prev => {
      const updated = prev.map(t => {
        if (t.id === id) {
          return { ...t, order: newOrder };
        }
        return t;
      });
      return updated.sort((a, b) => a.order - b.order);
    });
  };
  
  // Funkcja do zmiany typu transportu (załadunek/rozładunek)
  const handleChangeTransportType = (id, newType) => {
    setConnectedTransports(prev => 
      prev.map(t => t.id === id ? { ...t, type: newType } : t)
    );
  };
  
  // Obliczanie podziału kosztów między transporty
  const calculateCostDistribution = (totalPrice) => {
    if (!connectedTransports.length) return totalPrice;
    
    // Podziel koszt na wszystkie transporty + bieżący transport
    const transportsCount = connectedTransports.length + 1;
    const costPerTransport = Math.round((totalPrice / transportsCount) * 100) / 100; // zaokrąglenie do 2 miejsc po przecinku
    
    return costPerTransport;
  };
  
  // Filter users and constructions based on search term
  const filteredItems = [...users, ...constructions].filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.email && item.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (item.mpk && item.mpk.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Handle user or construction selection from dropdown
  const handleSelectItem = (item) => {
    if (item.type === 'user') {
      setSelectedUser(item);
      setSelectedConstructions([]);
    } else if (item.type === 'construction') {
      setSelectedConstructions([item]);
      setSelectedUser(null);
    }
    setSearchTerm(item.name);
    setIsDropdownOpen(false);
  };
  
  // Add a construction to selection
  const handleAddConstruction = (construction) => {
    // Sprawdź czy budowa nie jest już wybrana
    if (selectedConstructions.some(c => c.id === construction.id)) {
      return;
    }
    
    setSelectedConstructions(prev => [...prev, construction]);
    setSelectedUser(null);
  };
  
  // Remove a construction from selection
  const handleRemoveConstruction = (constructionId) => {
    setSelectedConstructions(prev => prev.filter(c => c.id !== constructionId));
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
      
      // Dodaj połączone transporty, jeśli są
      if (connectedTransports.length > 0) {
        responseData.connectedTransports = connectedTransports;
        
        // Oblicz podział kosztów
        const costPerTransport = calculateCostDistribution(deliveryPrice);
        responseData.costPerTransport = costPerTransport;
      }
      
      onSubmit(initialData.id, responseData);
    } else if (isEditing) {
      // Formularz edycji
      if (!selectedUser && selectedConstructions.length === 0) {
        alert('Wybierz osobę lub budowę odpowiedzialną za zlecenie');
        return;
      }
      
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
        clientName: formData.get('clientName') || '',  // Dodane pole nazwy klienta
        producerAddress: selectedLocation === 'Odbiory własne' ? {
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
        // Aktualizacja informacji o osobie odpowiedzialnej
        responsiblePerson: selectedUser ? selectedUser.name : null,
        responsibleEmail: selectedUser ? selectedUser.email : null,
        mpk: selectedUser ? selectedUser.mpk || '' : '',
        // Jeśli wybrane budowy, dodaj je
        responsibleConstructions: selectedConstructions.length > 0 ? selectedConstructions : null,
        // Jeśli jest opis towaru, dodaj go
        goodsDescription: showGoodsDescription ? goodsDescription : null,
        // Zachowaj informacje o osobie tworzącej
        createdBy: initialData.createdBy,
        createdByEmail: initialData.createdByEmail
      };
      
      console.log('Dane edycji do zapisania:', editedData);
      onSubmit(initialData.id, editedData);
    } else {
      // Nowe zamówienie
      if (!selectedUser && selectedConstructions.length === 0) {
        alert('Wybierz osobę lub budowę odpowiedzialną za zlecenie');
        return;
      }
      
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
        clientName: formData.get('clientName') || '',  // Dodane pole nazwy klienta
        producerAddress: selectedLocation === 'Odbiory własne' ? {
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
        notes: formData.get('notes'),
        // Dodajemy informacje o użytkowniku dodającym i odpowiedzialnym
        createdBy: currentUser.name,
        createdByEmail: currentUser.email,
        // Informacje o osobie odpowiedzialnej
        responsiblePerson: selectedUser ? selectedUser.name : null,
        responsibleEmail: selectedUser ? selectedUser.email : null,
        mpk: selectedUser ? selectedUser.mpk || '' : '',
        // Jeśli wybrane budowy, dodaj je
        responsibleConstructions: selectedConstructions.length > 0 ? selectedConstructions : null,
        // Jeśli jest opis towaru, dodaj go
        goodsDescription: showGoodsDescription ? goodsDescription : null
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
              <input
                name="deliveryPrice"
                type="number"
                className="w-full p-2 border rounded-md"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(Number(e.target.value))}
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
          
          {/* Dodawanie powiązanych transportów */}
          <div className="mt-3">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium mb-1">Powiązane transporty</label>
              <button
                type="button"
                className={showTransportsSection ? buttonClasses.toggleActive : buttonClasses.toggle}
                onClick={() => setShowTransportsSection(!showTransportsSection)}
              >
                {showTransportsSection ? 'Ukryj transporty' : 'Dodaj powiązane transporty'}
              </button>
            </div>
            
            {showTransportsSection && (
              <div className="mt-3 border border-gray-200 rounded-md p-4 bg-gray-50">
                {/* Wybór transportów do połączenia */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Wybierz transporty do połączenia</label>
                  <select 
                    className="w-full p-2 border rounded-md"
                    onChange={(e) => {
                      const selectedTransport = availableTransports.find(t => t.id === parseInt(e.target.value));
                      if (selectedTransport) {
                        handleAddConnectedTransport(selectedTransport);
                      }
                    }}
                    value=""
                  >
                    <option value="">Wybierz transport...</option>
                    {availableTransports.map(transport => (
                      <option key={transport.id} value={transport.id}>
                        {transport.orderNumber || transport.id} - {transport.delivery?.city || 'Brak danych'} 
                        ({transport.responsiblePerson || 'Brak'})
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Lista wybranych transportów */}
                {connectedTransports.length > 0 ? (
                  <div className="space-y-3">
                    {connectedTransports.map((transport, index) => (
                      <div key={transport.id} className="flex flex-col border rounded-md p-3 bg-white">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold">{transport.orderNumber || transport.id}</div>
                            <div className="text-sm text-gray-600">{transport.route}</div>
                            <div className="text-sm">MPK: {transport.mpk}</div>
                            <div className="text-sm">Osoba: {transport.responsiblePerson}</div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveConnectedTransport(transport.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            Usuń
                          </button>
                        </div>
                        
                        <div className="flex items-center mt-3 space-x-4">
                          <div>
                            <label className="block text-sm mb-1">Kolejność</label>
                            <input 
                              type="number" 
                              min="1"
                              value={transport.order || index + 1}
                              onChange={(e) => handleChangeTransportOrder(transport.id, parseInt(e.target.value))}
                              className="w-16 p-2 border rounded-md"
                            />
                          </div>
                          
                          <div className="flex-1">
                            <label className="block text-sm mb-1">Typ</label>
                            <div className="flex space-x-2">
                              <button
                                type="button"
                                className={`flex-1 py-1 px-3 text-sm rounded-md ${transport.type === 'loading' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => handleChangeTransportType(transport.id, 'loading')}
                              >
                                Załadunek
                              </button>
                              <button
                                type="button"
                                className={`flex-1 py-1 px-3 text-sm rounded-md ${transport.type === 'unloading' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
                                onClick={() => handleChangeTransportType(transport.id, 'unloading')}
                              >
                                Rozładunek
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {connectedTransports.length > 0 && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                        <p className="text-sm font-medium text-yellow-800">
                          Koszt transportu zostanie podzielony między {connectedTransports.length + 1} transporty:
                        </p>
                        <p className="text-sm mt-1">
                          Koszt na transport: ~{calculateCostDistribution(deliveryPrice || 0)} PLN/transport
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Brak wybranych transportów. Wybierz transporty z listy powyżej.</p>
                )}
              </div>
            )}
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
                className={selectedLocation === 'Odbiory własne' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Odbiory własne')}
              >
                Odbiory własne
              </button>
            </div>
          </div>

          {selectedLocation === 'Odbiory własne' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Adres punktu odbioru</h3>
              
              {/* Nazwa firmy w punkcie odbioru - nowe pole */}
              <div>
                <label className="block text-sm font-medium mb-1">Nazwa firmy (punkt odbioru)</label>
                <input
                  name="sourceClientName"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  defaultValue={initialData?.sourceClientName || ''}
                  placeholder="Nazwa firmy lub osoby w punkcie odbioru"
                />
              </div>
              
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
          
          {/* Towar - zmodyfikowany wygląd przycisku */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium">Towar</label>
              <button
                type="button"
                className={showGoodsDescription ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setShowGoodsDescription(!showGoodsDescription)}
              >
                {showGoodsDescription ? 'Ukryj opis towaru' : 'Opisz towar'}
              </button>
            </div>
            
            {showGoodsDescription && (
              <div className="p-4 border border-blue-100 rounded-md bg-blue-50 mt-2 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Opis towaru</label>
                  <textarea
                    name="description"
                    value={goodsDescription.description}
                    onChange={handleGoodsDescriptionChange}
                    className="w-full p-2 border rounded-md"
                    rows={2}
                    placeholder="Opis przewożonego towaru..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Waga towaru</label>
                  <input
                    name="weight"
                    type="text"
                    value={goodsDescription.weight}
                    onChange={handleGoodsDescriptionChange}
                    className="w-full p-2 border rounded-md"
                    placeholder="np. 1500 kg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Adres dostawy z dodanym polem nazwy klienta na początku */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Adres dostawy</h3>
            
            {/* Nazwa klienta przeniesiona do sekcji adresu dostawy */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Nazwa firmy/klienta
              </label>
              <input
                name="clientName"
                type="text"
                className="w-full p-2 border rounded-md"
                defaultValue={initialData?.clientName || ''}
                placeholder="Nazwa firmy lub odbiorcy"
              />
            </div>
            
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

          {/* Nowy komponent wyboru użytkownika lub budowy z autouzupełnianiem */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Osoba odpowiedzialna / budowa / numer MPK
            </label>
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center relative">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onClick={() => setIsDropdownOpen(true)}
                    placeholder="Wyszukaj osobę odpowiedzialną lub budowę..."
                    className="w-full p-2 pl-10 border rounded-md"
                    required
                  />
                  <div className="absolute left-3 top-2.5 text-gray-400">
                    <Search size={18} />
                  </div>
                </div>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedUser(null);
                      setSelectedConstructions([]);
                    }}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredItems.length > 0 ? (
                    <>
                      {/* Osoby */}
                      {filteredItems.filter(item => item.type === 'user').length > 0 && (
                        <div className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold">
                          Osoby
                        </div>
                      )}
                      {filteredItems
                        .filter(item => item.type === 'user')
                        .map((user) => (
                          <div
                            key={user.email}
                            onClick={() => handleSelectItem(user)}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                          >
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-600 flex justify-between">
                              <span>{user.email}</span>
                              {user.mpk && <span className="text-blue-600">MPK: {user.mpk}</span>}
                            </div>
                          </div>
                        ))
                      }
                      
                      {/* Budowy */}
                      {filteredItems.filter(item => item.type === 'construction').length > 0 && (
                        <div className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold">
                          Budowy
                        </div>
                      )}
                      {filteredItems
                        .filter(item => item.type === 'construction')
                        .map((construction) => (
                          <div
                            key={construction.id}
                            onClick={() => handleSelectItem(construction)}
                            className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{construction.name}</div>
                            <div className="text-sm text-gray-600">
                              MPK: <span className="text-blue-600">{construction.mpk}</span>
                            </div>
                          </div>
                        ))
                      }
                    </>
                  ) : (
                    <div className="p-2 text-gray-500">Brak wyników</div>
                  )}
                </div>
              )}
            </div>
            
            {/* Wyświetlanie wybranej osoby/budowy */}
            {selectedUser && (
              <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100">
                <div className="flex justify-between">
                  <div>
                    <span className="font-medium">Wybrana osoba:</span> {selectedUser.name}
                  </div>
                  {selectedUser.mpk && (
                    <div>
                      <span className="font-medium">MPK:</span> {selectedUser.mpk}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Wyświetlanie wybranych budów */}
            {selectedConstructions.length > 0 && (
              <div className="mt-2 p-2 bg-green-50 rounded-md border border-green-100">
                <h4 className="font-medium text-sm mb-2">Wybrane budowy:</h4>
                <div className="space-y-2">
                  {selectedConstructions.map(construction => (
                    <div key={construction.id} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="font-medium">{construction.name}</span>
                        <span className="ml-2 text-gray-600">MPK: {construction.mpk}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConstruction(construction.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
