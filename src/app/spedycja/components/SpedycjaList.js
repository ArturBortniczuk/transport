import React, { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { generateCMR } from '@/lib/utils/generateCMR'

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
    success: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.city}, ${address.postalCode}, ${address.street}`
  }

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: pl })
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

  // Funkcja do określania statusu zamówienia
  const getStatusLabel = (zamowienie) => {
    if (zamowienie.status === 'completed') {
      return { label: 'Zakończone', className: 'bg-green-100 text-green-800' };
    } else if (zamowienie.response && Object.keys(zamowienie.response).length > 0) {
      return { label: 'Odpowiedziane', className: 'bg-blue-100 text-blue-800' };
    } else {
      return { label: 'Nowe', className: 'bg-blue-100 text-blue-800' };
    }
  }

  return (
    <div className="divide-y">
      {zamowienia
        .filter(z => showArchive ? z.status === 'completed' : z.status === 'new')
        .map((zamowienie) => {
          const statusInfo = getStatusLabel(zamowienie);
          
          return (
            <div key={zamowienie.id} className="p-4">
              <div 
                onClick={() => setExpandedId(expandedId === zamowienie.id ? null : zamowienie.id)}
                className="flex justify-between items-start cursor-pointer"
              >
                <div>
                  <h3 className="font-medium">
                    {getLoadingCity(zamowienie)} → {getDeliveryCity(zamowienie)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Data dostawy: {formatDate(zamowienie.deliveryDate)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {zamowienie.orderNumber && <span className="font-medium mr-2">{zamowienie.orderNumber}</span>}
                    MPK: {zamowienie.mpk}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-sm ${statusInfo.className}`}>
                    {statusInfo.label}
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
                </div>
              </div>

              {expandedId === zamowienie.id && (
                <div className="mt-4 pl-4 border-l-2 border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Sekcja 1: Dane zamówienia i zamawiającego */}
                    <div>
                      <h4 className="font-medium mb-2">Dane zamówienia</h4>
                      <p className="text-sm"><span className="font-medium">Numer zamówienia:</span> {zamowienie.orderNumber || '-'}</p>
                      <p className="text-sm"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
                      <p className="text-sm"><span className="font-medium">Osoba dodająca:</span> {zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm"><span className="font-medium">Osoba odpowiedzialna:</span> {zamowienie.responsiblePerson || zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm"><span className="font-medium">Dokumenty:</span> {zamowienie.documents}</p>
                    </div>

                    {/* Sekcja 2: Szczegóły załadunku/dostawy */}
                    <div>
                      <h4 className="font-medium mb-2">Szczegóły załadunku</h4>
                      {zamowienie.location === 'Producent' ? (
                        <p>{formatAddress(zamowienie.producerAddress)}</p>
                      ) : (
                        <p>{zamowienie.location}</p>
                      )}
                      <p className="text-sm text-gray-600">
                        Kontakt: {zamowienie.loadingContact}
                      </p>
                      
                      <h4 className="font-medium mb-2 mt-4">Szczegóły dostawy</h4>
                      <p>{formatAddress(zamowienie.delivery)}</p>
                      <p className="text-sm text-gray-600">
                        Kontakt: {zamowienie.unloadingContact}
                      </p>
                      
                      {/* Link do Google Maps */}
                      {generateGoogleMapsLink(zamowienie) && (
                        <p className="text-sm mt-2">
                          <a 
                            href={generateGoogleMapsLink(zamowienie)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:text-blue-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Zobacz trasę na Google Maps
                          </a>
                        </p>
                      )}
                    </div>

                    {/* Sekcja 3: Informacje o transporcie */}
                    <div>
                      <h4 className="font-medium mb-2">Informacje o transporcie</h4>
                      <p className="text-sm"><span className="font-medium">Data dostawy:</span> {formatDate(zamowienie.deliveryDate)}</p>
                      <p className="text-sm"><span className="font-medium">Data dodania:</span> {formatDate(zamowienie.createdAt)}</p>
                      <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm || '0'} km</p>
                      
                      {zamowienie.response && zamowienie.response.deliveryPrice && (
                        <>
                          <p className="text-sm"><span className="font-medium">Cena transportu:</span> {zamowienie.response.deliveryPrice} PLN</p>
                          <p className="text-sm"><span className="font-medium">Cena za km:</span> {(zamowienie.response.deliveryPrice / (zamowienie.distanceKm || 1)).toFixed(2)} PLN/km</p>
                        </>
                      )}
                      
                      {zamowienie.notes && (
                        <p className="text-sm mt-2"><span className="font-medium">Uwagi:</span> {zamowienie.notes}</p>
                      )}
                    </div>
                  </div>

                  {zamowienie.response && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Szczegóły realizacji</h4>
                      {zamowienie.response.completedManually ? (
                        <p className="text-sm text-blue-600">Zamówienie zostało ręcznie oznaczone jako zrealizowane.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Informacje o przewoźniku */}
                          <div>
                            <h5 className="text-sm font-medium mb-1">Dane przewoźnika</h5>
                            <p className="text-sm"><span className="font-medium">Kierowca:</span> {zamowienie.response.driverName} {zamowienie.response.driverSurname}</p>
                            <p className="text-sm"><span className="font-medium">Telefon:</span> {zamowienie.response.driverPhone}</p>
                            <p className="text-sm"><span className="font-medium">Numery auta:</span> {zamowienie.response.vehicleNumber}</p>
                          </div>
                          
                          {/* Informacje o kosztach */}
                          <div>
                            <h5 className="text-sm font-medium mb-1">Dane finansowe</h5>
                            <p className="text-sm"><span className="font-medium">Cena:</span> {zamowienie.response.deliveryPrice} PLN</p>
                            <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm || 'N/A'} km</p>
                            {zamowienie.distanceKm > 0 && zamowienie.response.deliveryPrice > 0 && (
                              <p className="text-sm"><span className="font-medium">Koszt za km:</span> {(zamowienie.response.deliveryPrice / zamowienie.distanceKm).toFixed(2)} PLN/km</p>
                            )}
                          </div>
                          
                          {/* Informacje o realizacji */}
                          <div>
                            <h5 className="text-sm font-medium mb-1">Informacje o realizacji</h5>
                            <p className="text-sm"><span className="font-medium">Data odpowiedzi:</span> {formatDate(zamowienie.completedAt || zamowienie.createdAt)}</p>
                            {zamowienie.response.adminNotes && (
                              <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.response.adminNotes}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 flex space-x-2">
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
