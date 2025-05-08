import React, { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { generateCMR } from '@/lib/utils/generateCMR'
import { MapPin, Truck, FileText, Clipboard, ChevronDown, ChevronUp, PhoneCall, Calendar, Clock } from 'lucide-react'

export default function SpedycjaList({ 
  zamowienia, 
  showArchive, 
  isAdmin, 
  onResponse, 
  onMarkAsCompleted, 
  onCreateOrder, 
  canSendOrder  
}) {
  const [expandedId, setExpandedId] = useState(null)

  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors",
    success: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors",
    icon: "p-2 rounded-full hover:bg-gray-100 transition-colors"
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.city}, ${address.postalCode}, ${address.street || ''}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: pl })
  }
  
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: pl })
  }
  
  const getLoadingCity = (zamowienie) => {
    if (zamowienie.location === 'Producent' && zamowienie.producerAddress) {
      return zamowienie.producerAddress.city || '';
    } else if (zamowienie.location === 'Magazyn Białystok') {
      return 'Białystok';
    } else if (zamowienie.location === 'Magazyn Zielonka') {
      return 'Zielonka';
    }
    return '';
  }
  
  const getDeliveryCity = (zamowienie) => {
    return zamowienie.delivery?.city || '';
  }

  // Funkcja do generowania linku do Google Maps
  const generateGoogleMapsLink = (transport) => {
    // Pobierz dane źródłowe i docelowe
    let origin = '';
    let destination = '';
    
    // Ustal miejsce załadunku
    if (transport.location === 'Producent' && transport.producerAddress) {
      const addr = transport.producerAddress;
      origin = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    } else if (transport.location === 'Magazyn Białystok') {
      origin = 'Białystok';
    } else if (transport.location === 'Magazyn Zielonka') {
      origin = 'Zielonka';
    }
    
    // Ustal miejsce dostawy
    if (transport.delivery) {
      const addr = transport.delivery;
      destination = `${addr.city},${addr.postalCode},${addr.street || ''}`;
    }
    
    // Jeśli brakuje któregoś z punktów, zwróć pusty string
    if (!origin || !destination) return '';
    
    // Kodowanie URI komponentów
    origin = encodeURIComponent(origin);
    destination = encodeURIComponent(destination);
    
    // Zwróć link do Google Maps
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  };

  // Funkcja formatująca numer telefonu
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return '';
    
    // Usuń wszystkie nie-cyfry
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Formatuj nr telefonu w zależności od długości
    if (digits.length === 9) {
      // Format polski: xxx xxx xxx
      return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    } else {
      // Zachowaj oryginalny format dla innych przypadków
      return phoneNumber;
    }
  };

  // Funkcja do obliczania dni od utworzenia zamówienia
  const getDaysSinceCreated = (dateString) => {
    if (!dateString) return null;
    
    const created = new Date(dateString);
    const today = new Date();
    
    // Oblicz różnicę w milisekundach i konwertuj na dni
    const diffTime = Math.abs(today - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  return (
    <div className="divide-y">
      {zamowienia
        .filter(z => showArchive ? z.status === 'completed' : z.status === 'new')
        .map((zamowienie) => {
          const daysSinceCreated = getDaysSinceCreated(zamowienie.createdAt);
          const isOld = daysSinceCreated && daysSinceCreated > 7;
          
          return (
            <div key={zamowienie.id} className={`p-4 ${isOld ? 'bg-red-50' : ''}`}>
              <div 
                onClick={() => setExpandedId(expandedId === zamowienie.id ? null : zamowienie.id)}
                className="flex justify-between items-start cursor-pointer"
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <h3 className="font-medium text-lg">
                      {getLoadingCity(zamowienie)} → {getDeliveryCity(zamowienie)}
                    </h3>
                    {isOld && (
                      <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                        {daysSinceCreated} dni
                      </span>
                    )}
                  </div>
                  <div className="flex items-center mt-1 text-sm text-gray-500">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span className="mr-3">Data dostawy: {formatDate(zamowienie.deliveryDate)}</span>
                    
                    {zamowienie.mpk && (
                      <>
                        <span className="mr-3 font-medium">MPK: {zamowienie.mpk}</span>
                      </>
                    )}
                    
                    {zamowienie.distanceKm > 0 && (
                      <>
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>Odległość: {zamowienie.distanceKm} km</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center mt-1 text-sm text-gray-500">
                    {zamowienie.orderNumber && (
                      <span className="mr-3 font-medium">Numer: {zamowienie.orderNumber}</span>
                    )}
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Dodano: {formatDate(zamowienie.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-sm
                    ${zamowienie.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : zamowienie.response 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {zamowienie.status === 'completed' 
                      ? 'Zakończone' 
                      : zamowienie.response 
                        ? 'Odpowiedziane' 
                        : 'Nowe'}
                  </span>
                  {isAdmin && zamowienie.status === 'new' && (
                    <>
                      <button 
                        type="button"
                        className={buttonClasses.outline}
                        onClick={(e) => {
                          e.stopPropagation()
                          onResponse(zamowienie)
                        }}
                      >
                        Odpowiedz
                      </button>
                      <button 
                        type="button"
                        className={buttonClasses.success}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('Czy na pewno chcesz oznaczyć to zlecenie jako zrealizowane?')) {
                            onMarkAsCompleted(zamowienie.id)
                          }
                        }}
                      >
                        Zrealizowane
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedId(expandedId === zamowienie.id ? null : zamowienie.id);
                    }}
                    className={buttonClasses.icon}
                  >
                    {expandedId === zamowienie.id ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {expandedId === zamowienie.id && (
                <div className="mt-4 pl-4 border-l-2 border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nadawca */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center">
                        <Truck className="h-4 w-4 mr-2" />
                        Szczegóły załadunku
                      </h4>
                      {zamowienie.location === 'Producent' ? (
                        <p>{formatAddress(zamowienie.producerAddress)}</p>
                      ) : (
                        <p>{zamowienie.location}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-2 flex items-center">
                        <PhoneCall className="h-4 w-4 mr-1" />
                        Kontakt: {formatPhoneNumber(zamowienie.loadingContact)}
                      </p>
                    </div>
                    {/* Odbiorca */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center">
                        <MapPin className="h-4 w-4 mr-2" />
                        Szczegóły dostawy
                      </h4>
                      <p>{formatAddress(zamowienie.delivery)}</p>
                      <p className="text-sm text-gray-600 mt-2 flex items-center">
                        <PhoneCall className="h-4 w-4 mr-1" />
                        Kontakt: {formatPhoneNumber(zamowienie.unloadingContact)}
                      </p>
                    </div>
                  </div>

                  {/* Informacje o zamówieniu */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center">
                        <Clipboard className="h-4 w-4 mr-2" />
                        Dane zlecenia
                      </h4>
                      {zamowienie.orderNumber && (
                        <p className="text-sm"><span className="font-medium">Numer zamówienia:</span> {zamowienie.orderNumber}</p>
                      )}
                      <p className="text-sm"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
                      <p className="text-sm"><span className="font-medium">Osoba dodająca:</span> {zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm"><span className="font-medium">Osoba odpowiedzialna:</span> {zamowienie.responsiblePerson || zamowienie.createdBy || zamowienie.requestedBy}</p>
                      {zamowienie.distanceKm > 0 && (
                        <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm} km</p>
                      )}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center">
                        <FileText className="h-4 w-4 mr-2" />
                        Dokumenty i daty
                      </h4>
                      <p className="text-sm"><span className="font-medium">Dokumenty:</span> {zamowienie.documents}</p>
                      <p className="text-sm"><span className="font-medium">Data dodania:</span> {formatDateTime(zamowienie.createdAt)}</p>
                      {zamowienie.notes && (
                        <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.notes}</p>
                      )}
                    </div>
                  </div>

                  {/* Link do Google Maps */}
                  {generateGoogleMapsLink(zamowienie) && (
                    <div className="mt-3">
                      <a 
                        href={generateGoogleMapsLink(zamowienie)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Zobacz trasę na Google Maps
                      </a>
                    </div>
                  )}

                  {zamowienie.response && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Sekcja 1: Informacje o zamówieniu */}
                        <div>
                          <h4 className="font-medium mb-2">Dane zlecenia</h4>
                          <p className="text-sm"><span className="font-medium">Numer zamówienia:</span> {zamowienie.orderNumber || '-'}</p>
                          <p className="text-sm"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
                          <p className="text-sm"><span className="font-medium">Osoba dodająca:</span> {zamowienie.createdBy || zamowienie.requestedBy}</p>
                          <p className="text-sm"><span className="font-medium">Osoba odpowiedzialna:</span> {zamowienie.responsiblePerson || zamowienie.createdBy || zamowienie.requestedBy}</p>
                          <p className="text-sm"><span className="font-medium">Dokumenty:</span> {zamowienie.documents}</p>
                          {zamowienie.notes && (
                            <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.notes}</p>
                          )}
                        </div>
                        
                        {/* Sekcja 2: Informacje o transporcie */}
                        <div>
                          <h4 className="font-medium mb-2">Parametry transportu</h4>
                          <p className="text-sm"><span className="font-medium">Cena:</span> {zamowienie.response.deliveryPrice} PLN</p>
                          <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm || 'N/A'} km</p>
                          {zamowienie.distanceKm > 0 && zamowienie.response.deliveryPrice > 0 && (
                            <p className="text-sm"><span className="font-medium">Koszt za km:</span> {(zamowienie.response.deliveryPrice / zamowienie.distanceKm).toFixed(2)} PLN/km</p>
                          )}
                          <p className="text-sm"><span className="font-medium">Data odpowiedzi:</span> {formatDate(zamowienie.completedAt)}</p>
                          {zamowienie.response.adminNotes && (
                            <p className="text-sm"><span className="font-medium">Uwagi do transportu:</span> {zamowienie.response.adminNotes}</p>
                          )}
                        </div>
                        
                        {/* Sekcja 3: Informacje o przewoźniku */}
                        <div>
                          <h4 className="font-medium mb-2">Dane przewoźnika</h4>
                          {zamowienie.response.completedManually ? (
                            <p className="text-sm text-blue-600">Zamówienie zostało ręcznie oznaczone jako zrealizowane.</p>
                          ) : (
                            <>
                              <p className="text-sm"><span className="font-medium">Przewoźnik:</span> {zamowienie.response.driverName} {zamowienie.response.driverSurname}</p>
                              <p className="text-sm"><span className="font-medium">Telefon:</span> {formatPhoneNumber(zamowienie.response.driverPhone)}</p>
                              <p className="text-sm"><span className="font-medium">Numery auta:</span> {zamowienie.response.vehicleNumber}</p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button 
                          type="button"
                          className={buttonClasses.primary}
                          onClick={() => generateCMR(zamowienie)}
                        >
                          Generuj CMR
                        </button>
                        {zamowienie.response && !showArchive && canSendOrder && (
                          <button 
                            type="button"
                            className={buttonClasses.primary}
                            onClick={() => onCreateOrder(zamowienie)}
                          >
                            Stwórz zlecenie transportowe
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  )
}
