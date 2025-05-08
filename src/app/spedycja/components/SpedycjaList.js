import React, { useState } from 'react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { generateCMR } from '@/lib/utils/generateCMR'
import { Truck, Package, MapPin, Phone, FileText, Calendar, DollarSign, User, Clipboard, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'

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
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2",
    success: "px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
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
      return { 
        label: 'Zakończone', 
        className: 'bg-green-100 text-green-800 border border-green-300',
        icon: <Clipboard size={16} className="mr-1" />
      };
    } else if (zamowienie.response && Object.keys(zamowienie.response).length > 0) {
      return { 
        label: 'Odpowiedziane', 
        className: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
        icon: <Truck size={16} className="mr-1" />
      };
    } else {
      return { 
        label: 'Nowe', 
        className: 'bg-blue-100 text-blue-800 border border-blue-300',
        icon: <Package size={16} className="mr-1" />
      };
    }
  }

  return (
    <div className="divide-y">
      {zamowienia
        .filter(z => showArchive ? z.status === 'completed' : z.status === 'new')
        .map((zamowienie) => {
          const statusInfo = getStatusLabel(zamowienie);
          
          return (
            <div key={zamowienie.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div 
                onClick={() => setExpandedId(expandedId === zamowienie.id ? null : zamowienie.id)}
                className="flex justify-between items-start cursor-pointer"
              >
                <div className="flex items-start">
                  <div className="mr-3 mt-1">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700">
                      <Truck size={18} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium flex items-center">
                      {getLoadingCity(zamowienie)} 
                      <ArrowRight size={16} className="mx-1 text-gray-500" /> 
                      {getDeliveryCity(zamowienie)}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <Calendar size={14} className="mr-1" />
                      Data dostawy: {formatDate(zamowienie.deliveryDate)}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <FileText size={14} className="mr-1" />
                      {zamowienie.orderNumber && <span className="font-medium mr-2">{zamowienie.orderNumber}</span>}
                      MPK: {zamowienie.mpk}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm flex items-center ${statusInfo.className}`}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                  
                  {expandedId === zamowienie.id ? (
                    <button 
                      className="p-1 rounded-full hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedId(null)
                      }}
                    >
                      <ChevronUp size={20} />
                    </button>
                  ) : (
                    <button 
                      className="p-1 rounded-full hover:bg-gray-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedId(zamowienie.id)
                      }}
                    >
                      <ChevronDown size={20} />
                    </button>
                  )}
                  
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
                        <Clipboard size={16} />
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
                        <Truck size={16} />
                        Zrealizowane
                      </button>
                    </>
                  )}
                </div>
              </div>

              {expandedId === zamowienie.id && (
                <div className="mt-6 pl-4 border-l-4 border-blue-200 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    {/* Sekcja 1: Dane zamówienia i zamawiającego */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-3 pb-2 border-b flex items-center text-blue-700">
                        <FileText size={18} className="mr-2" />
                        Dane zamówienia
                      </h4>
                      <p className="text-sm mb-2"><span className="font-medium">Numer zamówienia:</span> {zamowienie.orderNumber || '-'}</p>
                      <p className="text-sm mb-2"><span className="font-medium">MPK:</span> {zamowienie.mpk}</p>
                      <p className="text-sm mb-2"><span className="font-medium">Osoba dodająca:</span> {zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm mb-2"><span className="font-medium">Osoba odpowiedzialna:</span> {zamowienie.responsiblePerson || zamowienie.createdBy || zamowienie.requestedBy}</p>
                      <p className="text-sm mb-2"><span className="font-medium">Dokumenty:</span> {zamowienie.documents}</p>
                    </div>

                    {/* Sekcja 2: Szczegóły załadunku/dostawy */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-3 pb-2 border-b flex items-center text-green-700">
                        <MapPin size={18} className="mr-2" />
                        Szczegóły załadunku
                      </h4>
                      {zamowienie.location === 'Producent' ? (
                        <p className="mb-2">{formatAddress(zamowienie.producerAddress)}</p>
                      ) : (
                        <p className="mb-2">{zamowienie.location}</p>
                      )}
                      <p className="text-sm text-gray-600 mb-3 flex items-center">
                        <Phone size={14} className="mr-1" />
                        Kontakt: {zamowienie.loadingContact}
                      </p>
                      
                      <h4 className="font-medium mt-5 mb-3 pb-2 border-b flex items-center text-orange-700">
                        <MapPin size={18} className="mr-2" />
                        Szczegóły dostawy
                      </h4>
                      <p className="mb-2">{formatAddress(zamowienie.delivery)}</p>
                      <p className="text-sm text-gray-600 mb-3 flex items-center">
                        <Phone size={14} className="mr-1" />
                        Kontakt: {zamowienie.unloadingContact}
                      </p>
                      
                      {/* Link do Google Maps */}
                      {generateGoogleMapsLink(zamowienie) && (
                        <div className="mt-4">
                          <a 
                            href={generateGoogleMapsLink(zamowienie)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-md flex items-center w-fit transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MapPin size={16} className="mr-2" />
                            Zobacz trasę na Google Maps
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Sekcja 3: Informacje o transporcie */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                      <h4 className="font-medium mb-3 pb-2 border-b flex items-center text-purple-700">
                        <Truck size={18} className="mr-2" />
                        Informacje o transporcie
                      </h4>
                      <p className="text-sm mb-2 flex items-center">
                        <Calendar size={14} className="mr-2 text-gray-500" />
                        <span className="font-medium">Data dostawy:</span> {formatDate(zamowienie.deliveryDate)}
                      </p>
                      <p className="text-sm mb-2 flex items-center">
                        <Calendar size={14} className="mr-2 text-gray-500" />
                        <span className="font-medium">Data dodania:</span> {formatDate(zamowienie.createdAt)}
                      </p>
                      <p className="text-sm mb-2 flex items-center">
                        <MapPin size={14} className="mr-2 text-gray-500" />
                        <span className="font-medium">Odległość:</span> 
                        <span className="bg-blue-50 px-2 py-0.5 rounded ml-1 font-medium">
                          {zamowienie.distanceKm || '0'} km
                        </span>
                      </p>
                      
                      {zamowienie.response && zamowienie.response.deliveryPrice && (
                        <>
                          <p className="text-sm mb-2 flex items-center">
                            <DollarSign size={14} className="mr-2 text-gray-500" />
                            <span className="font-medium">Cena transportu:</span> 
                            <span className="bg-green-50 px-2 py-0.5 rounded ml-1 font-medium">
                              {zamowienie.response.deliveryPrice} PLN
                            </span>
                          </p>
                          <p className="text-sm mb-2 flex items-center">
                            <DollarSign size={14} className="mr-2 text-gray-500" />
                            <span className="font-medium">Cena za km:</span> 
                            <span className="bg-green-50 px-2 py-0.5 rounded ml-1 font-medium">
                              {(zamowienie.response.deliveryPrice / (zamowienie.distanceKm || 1)).toFixed(2)} PLN/km
                            </span>
                          </p>
                        </>
                      )}
                      
                      {zamowienie.notes && (
                        <div className="mt-3 bg-gray-50 p-2 rounded-md">
                          <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {zamowienie.response && (
                    <div className="mt-4 bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm">
                      <h4 className="font-medium mb-3 pb-2 border-b border-gray-200 flex items-center text-gray-800">
                        <Truck size={18} className="mr-2" />
                        Szczegóły realizacji
                      </h4>
                      {zamowienie.response.completedManually ? (
                        <div className="bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100 flex items-center">
                          <Clipboard size={18} className="mr-2" />
                          Zamówienie zostało ręcznie oznaczone jako zrealizowane.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Informacje o przewoźniku */}
                          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                            <h5 className="text-sm font-medium mb-2 pb-1 border-b flex items-center text-blue-600">
                              <User size={14} className="mr-1" />
                              Dane przewoźnika
                            </h5>
                            <p className="text-sm mb-1.5"><span className="font-medium">Kierowca:</span> {zamowienie.response.driverName} {zamowienie.response.driverSurname}</p>
                            <p className="text-sm mb-1.5"><span className="font-medium">Telefon:</span> {zamowienie.response.driverPhone}</p>
                            <p className="text-sm mb-1.5"><span className="font-medium">Numery auta:</span> {zamowienie.response.vehicleNumber}</p>
                          </div>
                          
                          {/* Informacje o kosztach */}
                          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                            <h5 className="text-sm font-medium mb-2 pb-1 border-b flex items-center text-green-600">
                              <DollarSign size={14} className="mr-1" />
                              Dane finansowe
                            </h5>
                            <p className="text-sm mb-1.5"><span className="font-medium">Cena:</span> 
                              <span className="bg-green-50 px-2 py-0.5 rounded ml-1">
                                {zamowienie.response.deliveryPrice} PLN
                              </span>
                            </p>
                            <p className="text-sm mb-1.5"><span className="font-medium">Odległość:</span> {zamowienie.distanceKm || 'N/A'} km</p>
                            {zamowienie.distanceKm > 0 && zamowienie.response.deliveryPrice > 0 && (
                              <p className="text-sm mb-1.5"><span className="font-medium">Koszt za km:</span> 
                                <span className="bg-green-50 px-2 py-0.5 rounded ml-1">
                                  {(zamowienie.response.deliveryPrice / zamowienie.distanceKm).toFixed(2)} PLN/km
                                </span>
                              </p>
                            )}
                          </div>
                          
                          {/* Informacje o realizacji */}
                          <div className="bg-white p-3 rounded-md shadow-sm border border-gray-100">
                            <h5 className="text-sm font-medium mb-2 pb-1 border-b flex items-center text-purple-600">
                              <Calendar size={14} className="mr-1" />
                              Informacje o realizacji
                            </h5>
                            <p className="text-sm mb-1.5"><span className="font-medium">Data odpowiedzi:</span> {formatDate(zamowienie.completedAt || zamowienie.createdAt)}</p>
                            {zamowienie.response.adminNotes && (
                              <p className="text-sm"><span className="font-medium">Uwagi:</span> {zamowienie.response.adminNotes}</p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-5 flex space-x-3">
                        <button 
                          type="button"
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
                          onClick={() => generateCMR(zamowienie)}
                        >
                          <FileText size={16} />
                          Generuj CMR
                        </button>
                        {zamowienie.response && !showArchive && canSendOrder && (
                          <button 
                            type="button"
                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-2"
                            onClick={() => onCreateOrder(zamowienie)}
                          >
                            <Truck size={16} />
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
