import React, { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { generateCMR } from '@/lib/utils/generateCMR'

export default function SpedycjaList({ zamowienia, showArchive, isAdmin, onResponse, onMarkAsCompleted }) {
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

  return (
    <div className="divide-y">
      {zamowienia
        .filter(z => showArchive ? z.status === 'completed' : z.status === 'new')
        .map((zamowienie) => (
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
                  MPK: {zamowienie.mpk}
                  {zamowienie.distanceKm > 0 && ` • Odległość: ${zamowienie.distanceKm} km`}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-sm
                  ${zamowienie.status === 'new' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                  }`}
                >
                  {zamowienie.status === 'new' ? 'Nowe' : 'Zakończone'}
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
                <div className="grid grid-cols-2 gap-4">
                  {/* Nadawca */}
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
                  </div>
                  {/* Odbiorca */}
                  <div>
                    <h4 className="font-medium mb-2">Szczegóły dostawy</h4>
                    <p>{formatAddress(zamowienie.delivery)}</p>
                    <p className="text-sm text-gray-600">
                      Kontakt: {zamowienie.unloadingContact}
                    </p>
                  </div>
                </div>

                {/* Informacje o osobach i MPK */}
                <div className="mt-4 bg-gray-50 p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Dane zlecenia</h4>
                      <p className="text-sm"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
                      <p className="text-sm"><span className="font-medium">Osoba dodająca:</span> {zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm"><span className="font-medium">Osoba odpowiedzialna:</span> {zamowienie.responsiblePerson || zamowienie.createdBy || zamowienie.requestedBy}</p>
                      {zamowienie.distanceKm > 0 && (
                        <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm} km</p>
                      )}
                      {/* Link do Google Maps */}
                      {generateGoogleMapsLink(zamowienie) && (
                        <p className="text-sm mt-2">
                          <a 
                            href={generateGoogleMapsLink(zamowienie)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Zobacz trasę na Google Maps
                          </a>
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Dokumenty i daty</h4>
                      <p className="text-sm"><span className="font-medium">Dokumenty:</span> {zamowienie.documents}</p>
                      <p className="text-sm"><span className="font-medium">Data dodania:</span> {formatDate(zamowienie.createdAt)}</p>
                      {zamowienie.notes && (
                        <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.notes}</p>
                      )}
                    </div>
                  </div>
                </div>

                {zamowienie.response && (
                  <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Szczegóły realizacji</h4>
                    {zamowienie.response.completedManually ? (
                      <p className="text-sm text-blue-600">Zamówienie zostało ręcznie oznaczone jako zrealizowane.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm"><span className="font-medium">Przewoźnik:</span> {zamowienie.response.driverName} {zamowienie.response.driverSurname}</p>
                          <p className="text-sm"><span className="font-medium">Telefon:</span> {zamowienie.response.driverPhone}</p>
                          <p className="text-sm"><span className="font-medium">Numery auta:</span> {zamowienie.response.vehicleNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm"><span className="font-medium">Cena:</span> {zamowienie.response.deliveryPrice} PLN</p>
                          <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm || 'N/A'} km</p>
                          {zamowienie.distanceKm > 0 && zamowienie.response.deliveryPrice > 0 && (
                            <p className="text-sm"><span className="font-medium">Koszt za km:</span> {(zamowienie.response.deliveryPrice / zamowienie.distanceKm).toFixed(2)} PLN/km</p>
                          )}
                          <p className="text-sm"><span className="font-medium">Data odpowiedzi:</span> {formatDate(zamowienie.completedAt)}</p>
                        </div>
                      </div>
                    )}
                    {zamowienie.response.adminNotes && (
                      <p className="text-sm mt-2"><span className="font-medium">Uwagi:</span> {zamowienie.response.adminNotes}</p>
                    )}
                    
                    <div className="mt-4">
                      <button 
                        type="button"
                        className={buttonClasses.primary}
                        onClick={() => generateCMR(zamowienie)}
                      >
                        Generuj CMR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}
