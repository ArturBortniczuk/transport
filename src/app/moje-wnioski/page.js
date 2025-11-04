// src/app/moje-wnioski/page.js
'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import {
  Plus,
  Calendar,
  MapPin,
  User,
  Phone,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Building,
  Mail
} from 'lucide-react'

// ===== FUNKCJE POMOCNICZE DLA OBJAZDÓWEK =====

const CENTRA_MPK = {
  lapy: '522-03-003',
  wysokie: '522-03-006', 
  bielsk: '522-03-007',
  bialystok: '522-03-004'
};

const CENTRA_NAZWY = {
  lapy: 'Łapy',
  wysokie: 'Wysokie Mazowieckie',
  bielsk: 'Bielsk Podlaski',
  bialystok: 'Białystok (centrum elektryczne)'
};

function calculateRouteDistance(routePoints) {
  if (!routePoints || routePoints.length < 2) return 0;
  
  const routes = {
    'lapy-wysokie': 63,
    'lapy-bielsk': 73,
    'lapy-wysokie-bielsk': 120,
    'lapy-bialystok': 0,
    'lapy-wysokie-bialystok': 63,
    'lapy-bielsk-bialystok': 73,
    'lapy-wysokie-bielsk-bialystok': 120,
    'bielsk-wysokie': 103,
    'bielsk-lapy': 88,
    'bielsk-wysokie-lapy': 137,
    'bielsk-bialystok': 0,
    'bielsk-wysokie-bialystok': 103,
    'bielsk-lapy-bialystok': 88,
    'bielsk-wysokie-lapy-bialystok': 137
  };
  
  const routeKey = routePoints.join('-');
  return routes[routeKey] || 0;
}

function collectRouteMpks(routePoints) {
  if (!routePoints || routePoints.length === 0) return '';
  
  return routePoints
    .map(point => CENTRA_MPK[point])
    .filter(Boolean)
    .join(', ');
}

// ===== KOMPONENT WYBORU PUNKTÓW OBJAZDÓWKI =====

function RoutePointSelector({ selectedPoints, onChange, className = '' }) {
  const [availablePoints, setAvailablePoints] = useState([]);
  
  useEffect(() => {
    if (selectedPoints.length === 0) {
      setAvailablePoints(['lapy', 'bielsk']);
    } else {
      const allPoints = ['lapy', 'wysokie', 'bielsk', 'bialystok'];
      const available = allPoints.filter(p => !selectedPoints.includes(p));
      setAvailablePoints(available);
    }
  }, [selectedPoints]);
  
  const addPoint = (point) => {
    const newPoints = [...selectedPoints, point];
    onChange(newPoints);
  };
  
  const removePoint = (index) => {
    const newPoints = selectedPoints.filter((_, i) => i !== index);
    onChange(newPoints);
  };
  
  const canRemovePoint = (index) => {
    return index === selectedPoints.length - 1 && selectedPoints.length > 2;
  };
  
  return (
    <div className={className}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wybrane punkty trasy (kolejność ma znaczenie) *
        </label>
        
        <div className="space-y-2 mb-4">
          {selectedPoints.length === 0 ? (
            <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-md border border-gray-200">
              Wybierz pierwszy punkt: <strong>Łapy</strong> lub <strong>Bielsk Podlaski</strong>
            </div>
          ) : (
            selectedPoints.map((point, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between bg-blue-50 p-3 rounded-md border-2 border-blue-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                    {index + 1}
                  </span>
                  <div>
                    <span className="font-medium text-gray-900">{CENTRA_NAZWY[point]}</span>
                    <div className="text-xs text-gray-500 mt-0.5">MPK: {CENTRA_MPK[point]}</div>
                  </div>
                </div>
                {canRemovePoint(index) && (
                  <button
                    type="button"
                    onClick={() => removePoint(index)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                  >
                    Usuń
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        
        {selectedPoints.length < 4 && availablePoints.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dodaj kolejny punkt:
            </label>
            <div className="flex flex-wrap gap-2">
              {availablePoints.map(point => (
                <button
                  key={point}
                  type="button"
                  onClick={() => addPoint(point)}
                  className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-500 text-sm font-medium transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{CENTRA_NAZWY[point]}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        {selectedPoints.length >= 2 && (
          <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-600 mb-1">Dystans trasy:</div>
                <div className="text-2xl font-bold text-green-700">
                  {calculateRouteDistance(selectedPoints)} km
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">MPK centrów:</div>
                <div className="text-sm font-medium text-gray-900 break-words">
                  {collectRouteMpks(selectedPoints)}
                </div>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="text-xs text-gray-600 mb-2">Trasa:</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded font-medium">
                  Magazyn Białystok
                </span>
                {selectedPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-blue-600">→</span>
                    <span className="px-2 py-1 bg-white border border-blue-300 text-xs rounded font-medium">
                      {CENTRA_NAZWY[point]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {selectedPoints.length === 1 && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex items-start">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <p className="text-sm text-yellow-800">
                Dodaj jeszcze przynajmniej jeden punkt, aby utworzyć objazdówkę.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== KOMPONENT DO WYBORU BUDOWY =====

function ConstructionSelector({ value, onChange, className = '' }) {
  const [constructions, setConstructions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchConstructions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/constructions', { credentials: 'include' });

        if (!response.ok) {
          throw new Error('Problem z pobraniem danych budów');
        }

        const data = await response.json();
        setConstructions(data.constructions || []);
      } catch (err) {
        setError('Nie udało się pobrać listy budów');
        console.error('Error fetching constructions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConstructions();
  }, []);

  const filteredConstructions = search.trim() === ''
    ? constructions
    : constructions.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.mpk.toLowerCase().includes(search.toLowerCase())
      );

  const handleSelect = (construction) => {
    onChange(construction);
    setShowDropdown(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value ? `${value.name} (MPK: ${value.mpk})` : search}
        onChange={(e) => setSearch(e.target.value)}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder="Wyszukaj budowę po nazwie lub MPK..."
        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
      />
      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {isLoading && <div className="p-2">Ładowanie...</div>}
          {error && <div className="p-2 text-red-500">{error}</div>}
          {filteredConstructions.map(construction => (
            <div 
              key={construction.id} 
              onClick={() => handleSelect(construction)} 
              className="p-2 hover:bg-gray-100 cursor-pointer"
            >
              <div className="font-medium">{construction.name}</div>
              <div className="text-sm text-gray-500">MPK: {construction.mpk}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== KOMPONENT DO WYBORU HANDLOWCA =====

function UserSelector({ value, onChange, className = '' }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/users');

        if (!response.ok) {
          throw new Error('Problem z pobraniem danych handlowców');
        }

        const data = await response.json();
        // Sprawdź czy data jest tablicą czy obiektem
        const usersArray = Array.isArray(data) ? data : (data.users || []);
        
        // Formatuj użytkowników z typem 'user'
        const formattedUsers = usersArray
          .filter(u => u.role === 'handlowiec')
          .map(user => ({
            ...user,
            type: 'user'
          }));
        
        setUsers(formattedUsers);
      } catch (err) {
        setError('Nie udało się pobrać listy handlowców');
        console.error('Error fetching users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

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

  // Filtrowanie użytkowników
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.mpk && user.mpk.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Obsługa zmiany w polu wyszukiwania
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Obsługa wyboru handlowca
  const handleSelectUser = (user) => {
    onChange(user);
    setSearchTerm(user.name);
    setIsDropdownOpen(false);
  };

  return (
    <div className={className}>
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center relative">
          <div className="relative flex-grow">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={() => setIsDropdownOpen(true)}
              placeholder="Wyszukaj handlowca..."
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                onChange(null);
              }}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        
        {isDropdownOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-2 text-center text-gray-500">Ładowanie...</div>
            ) : error ? (
              <div className="p-2 text-red-500">{error}</div>
            ) : filteredUsers.length > 0 ? (
              <>
                <div className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold">
                  Handlowcy
                </div>
                {filteredUsers.map((user) => (
                  <div
                    key={user.email}
                    onClick={() => handleSelectUser(user)}
                    className="p-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                  >
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-600 flex justify-between">
                      <span>{user.email}</span>
                      {user.mpk && <span className="text-blue-600">MPK: {user.mpk}</span>}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="p-2 text-gray-500">Brak wyników</div>
            )}
          </div>
        )}
      </div>
      
      {/* Wyświetlanie wybranego handlowca */}
      {value && (
        <div className="mt-2 p-2 bg-blue-50 rounded-md border border-blue-100">
          <div className="flex justify-between">
            <div>
              <span className="font-medium">Wybrany handlowiec:</span> {value.name}
            </div>
            {value.mpk && (
              <div>
                <span className="font-medium">MPK:</span> {value.mpk}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== GŁÓWNY KOMPONENT =====

export default function MojeWnioskiPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [userInfo, setUserInfo] = useState(null)

  const [transportType, setTransportType] = useState('standard');
  const [recipientType, setRecipientType] = useState('construction');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [routePoints, setRoutePoints] = useState([]);

  const [formData, setFormData] = useState({
    destination_city: '',
    postal_code: '',
    street: '',
    delivery_date: '',
    justification: '',
    client_name: '',
    real_client_name: '',
    wz_numbers: '',
    market_id: '',
    mpk: '',
    contact_person: '',
    contact_phone: '',
    notes: '',
    transport_direction: '',
    goods_description: '',
    document_numbers: ''
  })

  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/user')
        const data = await response.json()

        if (data.isAuthenticated && data.user) {
          setUserInfo(data.user)
        } else {
          setError('Brak autoryzacji')
        }
      } catch (err) {
        setError('Błąd pobierania danych użytkownika')
      }
    }

    fetchUserInfo()
  }, [])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transport-requests')
      const data = await response.json()

      if (data.success) {
        setRequests(data.requests)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Wystąpił błąd podczas pobierania wniosków')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userInfo) {
      fetchRequests()
    }
  }, [userInfo])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const errors = {}
    
    if (transportType === 'delivery_route') {
      if (!routePoints || routePoints.length < 2) {
        errors.route_points = 'Musisz wybrać minimum 2 punkty'
      }
      if (!formData.delivery_date) {
        errors.delivery_date = 'Data transportu jest wymagana'
      }
    } else if (transportType === 'warehouse') {
      if (!formData.transport_direction) errors.transport_direction = 'Kierunek transportu jest wymagany'
      if (!formData.goods_description.trim()) errors.goods_description = 'Opis towarów jest wymagany'
      if (!formData.delivery_date) errors.delivery_date = 'Data transportu jest wymagana'
      if (!formData.justification.trim()) errors.justification = 'Uzasadnienie jest wymagane'
    } else {
      if (!formData.destination_city.trim()) errors.destination_city = 'Miasto docelowe jest wymagane'
      if (!formData.delivery_date) errors.delivery_date = 'Data dostawy jest wymagana'
      if (!formData.justification.trim()) errors.justification = 'Uzasadnienie jest wymagane'
      if (!formData.real_client_name.trim()) errors.real_client_name = 'Rzeczywisty klient jest wymagany'
      if (!selectedEntity) errors.entity = 'Wybór budowy lub handlowca jest wymagany'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    let isMounted = true;

    try {
      const url = '/api/transport-requests';
      const method = editingRequest ? 'PUT' : 'POST';

      const dataToSend = {
        transport_type: transportType,
        delivery_date: formData.delivery_date || '',
        notes: formData.notes || '',
      };

      if (transportType === 'delivery_route') {
        dataToSend.route_points = routePoints;
        dataToSend.route_distance = calculateRouteDistance(routePoints);
        dataToSend.route_mpks = collectRouteMpks(routePoints);
        dataToSend.document_numbers = formData.document_numbers || '';
      } else if (transportType === 'warehouse') {
        dataToSend.transport_direction = formData.transport_direction;
        dataToSend.goods_description = formData.goods_description;
        dataToSend.document_numbers = formData.document_numbers || '';
        dataToSend.justification = formData.justification || '';
      } else {
        dataToSend.destination_city = formData.destination_city || '';
        dataToSend.postal_code = formData.postal_code || '';
        dataToSend.street = formData.street || '';
        dataToSend.client_name = formData.client_name || '';
        dataToSend.mpk = formData.mpk || '';
        dataToSend.real_client_name = formData.real_client_name || '';
        dataToSend.wz_numbers = formData.wz_numbers || '';
        dataToSend.market_id = formData.market_id || '';
        dataToSend.contact_person = formData.contact_person || '';
        dataToSend.contact_phone = formData.contact_phone || '';
        dataToSend.construction_id = recipientType === 'construction' ? (selectedEntity?.id || null) : null;
        dataToSend.construction_name = recipientType === 'construction' ? (selectedEntity?.name || null) : null;
        dataToSend.user_id = recipientType === 'sales' ? (selectedEntity?.id || null) : null;
        dataToSend.justification = formData.justification || '';
      }

      const body = editingRequest
        ? { ...dataToSend, requestId: editingRequest.id, action: 'edit' }
        : dataToSend;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (isMounted) {
        if (data.success) {
          alert(editingRequest ? 'Wniosek został zaktualizowany' : 'Wniosek został złożony');
          cancelForm();
          fetchRequests();
        } else {
          alert('Błąd: ' + data.error);
        }
      }
    } catch (err) {
      console.error('Błąd wysyłania formularza:', err);
      if (isMounted) {
        alert('Wystąpił błąd podczas wysyłania wniosku');
      }
    } finally {
      if (isMounted) {
        setSubmitting(false);
      }
    }

    return () => {
      isMounted = false;
    };
  };

  const startEdit = (request) => {
    setTransportType(request.transport_type || 'standard');
    
    if (request.transport_type === 'delivery_route') {
      try {
        const points = JSON.parse(request.route_points || '[]');
        setRoutePoints(points);
      } catch (e) {
        console.error('Błąd parsowania route_points:', e);
        setRoutePoints([]);
      }
    }
    
    setFormData({
      destination_city: request.destination_city || '',
      postal_code: request.postal_code || '',
      street: request.street || '',
      delivery_date: request.delivery_date || '',
      justification: request.justification || '',
      client_name: request.client_name || '',
      real_client_name: request.real_client_name || '',
      wz_numbers: request.wz_numbers || '',
      market_id: request.market_id || '',
      mpk: request.mpk || '',
      contact_person: request.contact_person || '',
      contact_phone: request.contact_phone || '',
      notes: request.notes || '',
      transport_direction: request.transport_direction || '',
      goods_description: request.goods_description || '',
      document_numbers: request.document_numbers || ''
    })

    if (request.transport_type === 'delivery_route') {
      setSelectedEntity(null);
    } else if (request.transport_type === 'warehouse') {
      setSelectedEntity(null);
    } else {
      if(request.construction_id) {
        setRecipientType('construction');
        setSelectedEntity({ id: request.construction_id, name: request.construction_name || request.client_name, mpk: request.mpk });
      } else if (request.user_id) {
        setRecipientType('sales');
        setSelectedEntity({ id: request.user_id, name: request.requester_name || request.client_name, mpk: request.mpk });
      } else {
        setSelectedEntity(null);
      }
    }

    setEditingRequest(request)
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingRequest(null)
    setTransportType('standard')
    setRecipientType('construction')
    setRoutePoints([])
    setFormData({
      destination_city: '', postal_code: '', street: '',
      delivery_date: '', justification: '', client_name: '',
      real_client_name: '', wz_numbers: '', market_id: '',
      mpk: '', contact_person: '', contact_phone: '', notes: '',
      transport_direction: '', goods_description: '', document_numbers: ''
    })
    setSelectedEntity(null)
    setFormErrors({})
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Oczekuje
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Zaakceptowany
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Odrzucony
          </span>
        )
      default:
        return status
    }
  }

  if (loading && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Ładowanie...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-4 text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Moje wnioski transportowe</h1>
          <p className="mt-2 text-gray-600">Złóż wniosek o transport własny dla wybranej budowy lub handlowca</p>
        </div>

        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => {
                setShowForm(true)
                setTransportType('standard');
                setRecipientType('construction');
                setSelectedEntity(null);
                setRoutePoints([]);
                setFormData({
                  destination_city: '', postal_code: '', street: '',
                  delivery_date: '', justification: '', client_name: '',
                  real_client_name: '', wz_numbers: '', market_id: '',
                  mpk: '', contact_person: '', contact_phone: '', notes: '',
                  transport_direction: '', goods_description: '', document_numbers: ''
                });
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nowy wniosek transportowy
            </button>
          </div>
        )}

        {showForm && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                {editingRequest ? 'Edytuj wniosek' : 'Nowy wniosek transportowy'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-base font-medium text-gray-800 mb-3">Typ wniosku transportowego</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTransportType('standard');
                      setFormData(prev => ({
                        ...prev,
                        transport_direction: '',
                        goods_description: '',
                        document_numbers: ''
                      }));
                      setRoutePoints([]);
                    }}
                    className={`px-4 py-2 rounded-md transition-colors ${transportType === 'standard' ?
                      'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border hover:bg-gray-100'}`}
                  >
                    Transport do budowy/handlowca
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransportType('warehouse');
                      setSelectedEntity(null);
                      setRoutePoints([]);
                      setFormData(prev => ({
                        ...prev,
                        destination_city: '',
                        postal_code: '',
                        street: '',
                        client_name: '',
                        real_client_name: '',
                        wz_numbers: '',
                        market_id: '',
                        mpk: '',
                        contact_person: '',
                        contact_phone: ''
                      }));
                    }}
                    className={`px-4 py-2 rounded-md transition-colors ${transportType === 'warehouse' ?
                      'bg-green-600 text-white shadow-sm' : 'bg-white text-gray-700 border hover:bg-gray-100'}`}
                  >
                    Przesunięcie międzymagazynowe
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransportType('delivery_route');
                      setSelectedEntity(null);
                      setRoutePoints([]);
                      setFormData(prev => ({
                        ...prev,
                        destination_city: '',
                        postal_code: '',
                        street: '',
                        client_name: '',
                        real_client_name: '',
                        wz_numbers: '',
                        market_id: '',
                        mpk: '',
                        contact_person: '',
                        contact_phone: '',
                        justification: '',
                        transport_direction: '',
                        goods_description: ''
                      }));
                    }}
                    className={`px-4 py-2 rounded-md transition-colors ${transportType === 'delivery_route' ?
                      'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-700 border hover:bg-gray-100'}`}
                  >
                    Objazdówka (centra elektryczne)
                  </button>
                </div>
              </div>

              {transportType === 'delivery_route' && (
                <>
                  <RoutePointSelector
                    selectedPoints={routePoints}
                    onChange={setRoutePoints}
                  />
                  {formErrors.route_points && (
                    <p className="text-sm text-red-600">{formErrors.route_points}</p>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data transportu *
                    </label>
                    <input
                      type="date"
                      name="delivery_date"
                      value={formData.delivery_date}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.delivery_date ?
                        'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                        'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                      required
                    />
                    {formErrors.delivery_date && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.delivery_date}</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numery dokumentów (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      name="document_numbers"
                      value={formData.document_numbers}
                      onChange={handleInputChange}
                      placeholder="np. WZ001, DOK123"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Uwagi
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Dodatkowe uwagi do transportu..."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {transportType === 'warehouse' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Kierunek transportu *
                    </label>
                    <select
                      name="transport_direction"
                      value={formData.transport_direction}
                      onChange={handleInputChange}
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.transport_direction ?
                        'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                        'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                      required
                    >
                      <option value="">Wybierz kierunek</option>
                      <option value="zielonka_bialystok">Zielonka → Białystok</option>
                      <option value="bialystok_zielonka">Białystok → Zielonka</option>
                    </select>
                    {formErrors.transport_direction && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.transport_direction}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opis transportowanych towarów *
                    </label>
                    <textarea
                      name="goods_description"
                      value={formData.goods_description}
                      onChange={handleInputChange}
                      rows={4}
                      placeholder="Opisz jakie towary mają zostać przetransportowane..."
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.goods_description ?
                        'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                        'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                      required
                    />
                    {formErrors.goods_description && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.goods_description}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numery dokumentów (opcjonalnie)
                    </label>
                    <input
                      type="text"
                      name="document_numbers"
                      value={formData.document_numbers}
                      onChange={handleInputChange}
                      placeholder="np. WZ001, DOK123, etc."
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data transportu *
                    </label>
                    <input
                      type="date"
                      name="delivery_date"
                      value={formData.delivery_date}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.delivery_date ?
                        'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                        'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                    />
                    {formErrors.delivery_date && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.delivery_date}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Uzasadnienie wniosku *</label>
                    <textarea
                      name="justification"
                      value={formData.justification}
                      onChange={handleInputChange}
                      rows={4}
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.justification ?
                        'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                        'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
                    />
                    {formErrors.justification && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.justification}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dodatkowe uwagi</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {transportType === 'standard' && (
                <>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="text-base font-medium text-gray-800 mb-3">Wybierz typ odbiorcy</h4>
                    <div className="flex space-x-4">
                      <button
                        type="button"
                        onClick={() => { setRecipientType('construction'); setSelectedEntity(null); setFormData(prev => ({...prev, client_name: '', mpk: ''})) }}
                        className={`px-4 py-2 rounded-md transition-colors ${recipientType === 'construction' ?
                          'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border hover:bg-gray-100'}`}
                      >
                        Budowa
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRecipientType('sales'); setSelectedEntity(null); setFormData(prev => ({...prev, client_name: '', mpk: ''})) }}
                        className={`px-4 py-2 rounded-md transition-colors ${recipientType === 'sales' ?
                          'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-700 border hover:bg-gray-100'}`}
                      >
                        Handlowiec
                      </button>
                    </div>
                  </div>

                  {recipientType === 'construction' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Wybierz budowę/MPK *</label>
                      <ConstructionSelector
                        value={selectedEntity}
                        onChange={(selection) => {
                          setSelectedEntity(selection);
                          if (selection) setFormData(prev => ({ ...prev, client_name: selection.name, mpk: selection.mpk }));
                        }}
                        className={formErrors.entity ? 'border-red-300' : ''}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Wybierz handlowca *</label>
                      <UserSelector
                        value={selectedEntity}
                        onChange={(user) => {
                          setSelectedEntity(user);
                          if (user) setFormData(prev => ({ ...prev, client_name: user.name, mpk: user.mpk || '' }));
                        }}
                        className={formErrors.entity ? 'border-red-300' : ''}
                      />
                    </div>
                  )}
                  {formErrors.entity && (<p className="mt-1 text-sm text-red-600">{formErrors.entity}</p>)}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Handlowiec/budowa</label>
                      <input type="text" name="client_name" value={formData.client_name} className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100" readOnly />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">MPK</label>
                      <input type="text" name="mpk" value={formData.mpk} className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100" readOnly />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Miasto *</label>
                      <input type="text" name="destination_city" value={formData.destination_city} onChange={handleInputChange} 
                        className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.destination_city ?
                          'border-red-300' : 'border-gray-300'}`} 
                      />
                      {formErrors.destination_city && (<p className="mt-1 text-sm text-red-600">{formErrors.destination_city}</p>)}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Kod pocztowy</label>
                      <input type="text" name="postal_code" value={formData.postal_code} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Ulica i numer</label>
                      <input type="text" name="street" value={formData.street} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Osoba kontaktowa</label>
                      <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Telefon kontaktowy</label>
                      <input type="text" name="contact_phone" value={formData.contact_phone} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Klient *</label>
                      <input type="text" name="real_client_name" value={formData.real_client_name} onChange={handleInputChange} 
                        className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.real_client_name ?
                          'border-red-300' : 'border-gray-300'}`}
                      />
                      {formErrors.real_client_name && (<p className="mt-1 text-sm text-red-600">{formErrors.real_client_name}</p>)}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Numery WZ</label>
                      <input type="text" name="wz_numbers" value={formData.wz_numbers} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rynek</label>
                      <input type="text" name="market_id" value={formData.market_id} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300"/>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data dostawy *</label>
                    <input 
                      type="date" 
                      name="delivery_date" 
                      value={formData.delivery_date} 
                      onChange={handleInputChange} 
                      min={new Date().toISOString().split('T')[0]} 
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.delivery_date ?
                        'border-red-300' : 'border-gray-300'}`} 
                    />
                    {formErrors.delivery_date && (<p className="mt-1 text-sm text-red-600">{formErrors.delivery_date}</p>)}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Uzasadnienie wniosku *</label>
                    <textarea name="justification" value={formData.justification} onChange={handleInputChange} rows={4} 
                      className={`mt-1 block w-full rounded-md shadow-sm ${formErrors.justification ?
                        'border-red-300' : 'border-gray-300'}`} 
                    />
                    {formErrors.justification && (<p className="mt-1 text-sm text-red-600">{formErrors.justification}</p>)}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dodatkowe uwagi</label>
                    <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={3} className="mt-1 block w-full rounded-md border-gray-300"/>
                  </div>
                </>
              )}

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={cancelForm} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                  Anuluj
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Zapisywanie...' : (editingRequest ? 'Zaktualizuj' : 'Złóż wniosek')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Twoje wnioski transportowe</h2>
          </div>

          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Ładowanie wniosków...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="mt-2 text-gray-600">Nie masz jeszcze żadnych wniosków transportowych</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Złóż pierwszy wniosek
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {requests.map((request) => (
                <div key={request.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-medium text-gray-900">
                            Wniosek #{request.id}
                          </h3>
                          {request.transport_type === 'delivery_route' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Objazdówka (centra elektryczne)
                            </span>
                          ) : request.transport_type === 'warehouse' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Przesunięcie międzymagazynowe
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Transport standardowy
                            </span>
                          )}
                        </div>
                        {getStatusBadge(request.status)}
                      </div>

                      {request.transport_type === 'delivery_route' ? (
                        <div className="grid grid-cols-1 gap-4 text-sm text-gray-600 bg-purple-50 p-4 rounded-md">
                          <div className="flex items-start">
                            <MapPin className="w-4 h-4 mr-2 mt-0.5 text-purple-600" />
                            <div className="flex-1">
                              <strong>Trasa objazdówki:</strong>
                              <div className="mt-1">
                                {(() => {
                                  try {
                                    // route_points może być stringiem JSON lub array (z Postgres)
                                    let points;
                                    if (typeof request.route_points === 'string') {
                                      points = JSON.parse(request.route_points);
                                    } else if (Array.isArray(request.route_points)) {
                                      points = request.route_points;
                                    } else {
                                      return 'Błąd odczytu trasy';
                                    }
                                    return points.map((point, idx) => (
                                      <span key={idx}>
                                        {CENTRA_NAZWY[point]}
                                        {idx < points.length - 1 && ' → '}
                                      </span>
                                    ));
                                  } catch (e) {
                                    return 'Błąd odczytu trasy';
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-purple-600" />
                              <div>
                                <strong>Data transportu:</strong>
                                <div>{format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-purple-600" />
                              <div>
                                <strong>Dystans:</strong>
                                <div>{request.route_distance || 0} km</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-2 text-purple-600" />
                              <div>
                                <strong>MPK:</strong>
                                <div>{request.route_mpks || 'Brak'}</div>
                              </div>
                            </div>
                          </div>
                          
                          {request.document_numbers && (
                            <div className="flex items-center">
                              <FileText className="w-4 h-4 mr-2 text-purple-600" />
                              <strong>Dokumenty:</strong>
                              <span className="ml-2">{request.document_numbers}</span>
                            </div>
                          )}
                          
                          {request.notes && (
                            <div className="flex items-start">
                              <FileText className="w-4 h-4 mr-2 mt-0.5 text-purple-600" />
                              <div>
                                <strong>Uwagi:</strong>
                                <p className="mt-1">{request.notes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : request.transport_type === 'warehouse' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 bg-green-50 p-4 rounded-md">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            <strong>Kierunek:</strong>
                            <span className="ml-2">
                              {request.transport_direction === 'zielonka_bialystok' ? 'Zielonka → Białystok' : 
                               request.transport_direction === 'bialystok_zielonka' ? 'Białystok → Zielonka' : 
                               request.transport_direction}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            <strong>Data transportu:</strong>
                            <span className="ml-2">{format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}</span>
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-start">
                              <FileText className="w-4 h-4 mr-2 mt-0.5" />
                              <div>
                                <strong>Towary:</strong>
                                <p className="mt-1">{request.goods_description}</p>
                              </div>
                            </div>
                          </div>
                          {request.document_numbers && (
                            <div className="md:col-span-2 flex items-center">
                              <FileText className="w-4 h-4 mr-2" />
                              <strong>Dokumenty:</strong>
                              <span className="ml-2">{request.document_numbers}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-2" />
                            <strong>Lokalizacja:</strong>
                            <span className="ml-2">
                              {request.destination_city}
                              {request.postal_code && `, ${request.postal_code}`}
                              {request.street && `, ${request.street}`}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            <strong>Data dostawy:</strong>
                            <span className="ml-2">
                              {format(new Date(request.delivery_date), 'dd.MM.yyyy', { locale: pl })}
                            </span>
                          </div>
                          {(request.construction_name || request.client_name) && (
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-2" />
                              <strong>Odbiorca:</strong>
                              <span className="ml-2">
                                {request.construction_name || request.client_name}
                                {request.mpk && ` (MPK: ${request.mpk})`}
                              </span>
                            </div>
                          )}
                          {request.real_client_name && (
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-2" />
                              <strong>Klient:</strong>
                              <span className="ml-2">{request.real_client_name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {request.justification && (
                        <div className="mt-3">
                          <p className="text-sm text-gray-800">
                            <strong>Uzasadnienie:</strong> {request.justification}
                          </p>
                        </div>
                      )}

                      {request.notes && request.transport_type !== 'delivery_route' && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            <strong>Uwagi:</strong> {request.notes}
                          </p>
                        </div>
                      )}

                      {request.rejection_reason && (
                        <div className="mt-2 p-3 bg-red-50 rounded-md">
                          <p className="text-sm text-red-800">
                            <strong>Powód odrzucenia:</strong> {request.rejection_reason}
                          </p>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-gray-500">
                        Utworzony: {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                        {request.approved_at && (
                          <span className="ml-4">
                            {request.status === 'approved' ? 'Zaakceptowany' : 'Przetworzony'}: {format(new Date(request.approved_at), 'dd.MM.yyyy HH:mm', { locale: pl })}
                            {request.approved_by && ` przez ${request.approved_by}`}
                          </span>
                        )}
                        {request.transport_id && (
                          <span className="ml-4 text-blue-600">
                            (Transport #{request.transport_id} - dodany do kalendarza)
                          </span>
                        )}
                      </div>
                    </div>

                    {request.status === 'pending' && (
                      <div className="ml-4 flex space-x-2">
                        <button
                          onClick={() => startEdit(request)}
                          className="p-2 text-blue-600 hover:text-blue-800"
                          title="Edytuj wniosek"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}