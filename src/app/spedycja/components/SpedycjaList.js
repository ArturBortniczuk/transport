// src/app/spedycja/components/SpedycjaList.js
import React, { useState } from 'react'
import { generateCMR } from '@/lib/utils/generateCMR'

export default function SpedycjaList({ zamowienia, showArchive, isAdmin, onResponse }) {
  const [expandedId, setExpandedId] = useState(null)

  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
  }

  const formatAddress = (address) => {
    if (!address) return ''
    return `${address.city}, ${address.postalCode}, ${address.street}`
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

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
                  {zamowienie.location} → {zamowienie.delivery.city}
                </h3>
                <p className="text-sm text-gray-500">
                  Data dostawy: {zamowienie.deliveryDate}
                </p>
                <p className="text-sm text-gray-500">
                  MPK: {zamowienie.mpk}
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm"><span className="font-medium">Przewoźnik:</span> {zamowienie.response.driverName} {zamowienie.response.driverSurname}</p>
                        <p className="text-sm"><span className="font-medium">Telefon:</span> {zamowienie.response.driverPhone}</p>
                        <p className="text-sm"><span className="font-medium">Numery auta:</span> {zamowienie.response.vehicleNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm"><span className="font-medium">Cena:</span> {zamowienie.response.deliveryPrice} PLN</p>
                        <p className="text-sm"><span className="font-medium">Odległość:</span> {zamowienie.response.distanceKm || 'N/A'} km</p>
                        <p className="text-sm"><span className="font-medium">Data odpowiedzi:</span> {formatDate(zamowienie.completedAt)}</p>
                      </div>
                    </div>
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
