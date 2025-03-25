'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Package, User, Building2, MapPin, Phone, Mail, Box, Weight, Ruler } from 'lucide-react'

export default function ZamowieniaList({ zamowienia, onZatwierdz, onUsun, userRole }) {
  const [expandedId, setExpandedId] = useState(null)

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  if (zamowienia.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center text-gray-500">
          Brak zamówień kuriera
        </div>
      </div>
    )
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
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Lista zamówień kuriera</h2>
      </div>

      <div className="p-6 space-y-4">
        {zamowienia.map((zamowienie) => (
          <div 
            key={zamowienie.id}
            className="border rounded-lg overflow-hidden"
          >
            {/* Nagłówek zamówienia */}
            <div
              onClick={() => toggleExpand(zamowienie.id)}
              className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
            >
              <div className="flex items-center space-x-4">
                <Package className="text-blue-600" />
                <div>
                  <div className="font-medium">{zamowienie.odbiorcaNazwa}</div>
                  <div className="text-sm text-gray-500">
                    {zamowienie.odbiorcaMiasto}, {formatDate(zamowienie.dataDodania)}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm 
                  ${zamowienie.status === 'oczekujące' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                  {zamowienie.status}
                </span>
                {expandedId === zamowienie.id ? <ChevronUp /> : <ChevronDown />}
              </div>
            </div>

            {/* Szczegóły zamówienia */}
            {expandedId === zamowienie.id && (
              <div className="p-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nadawca */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Nadawca</h4>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.nadawcaNazwa}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span>
                          {zamowienie.nadawcaUlica}, {zamowienie.nadawcaKodPocztowy} {zamowienie.nadawcaMiasto}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.nadawcaOsobaKontaktowa}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.nadawcaTelefon}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.nadawcaEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Odbiorca */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Odbiorca</h4>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        {zamowienie.odbiorcaTyp === 'osoba' ? 
                          <User className="w-4 h-4 mr-2 text-gray-400" /> : 
                          <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                        }
                        <span>{zamowienie.odbiorcaNazwa}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        <span>
                          {zamowienie.odbiorcaUlica} {zamowienie.odbiorcaNumerDomu}
                          {zamowienie.odbiorcaNumerLokalu && `/${zamowienie.odbiorcaNumerLokalu}`},
                          {zamowienie.odbiorcaKodPocztowy} {zamowienie.odbiorcaMiasto}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <User className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.odbiorcaOsobaKontaktowa}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.odbiorcaTelefon}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Mail className="w-4 h-4 mr-2 text-gray-400" />
                        <span>{zamowienie.odbiorcaEmail}</span>
                      </div>
                    </div>
                  </div>

                  {/* Szczegóły przesyłki */}
                  <div className="md:col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3">Szczegóły przesyłki</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          <Box className="w-4 h-4 mr-2 text-gray-400" />
                          <span>Zawartość: {zamowienie.zawartoscPrzesylki}</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Package className="w-4 h-4 mr-2 text-gray-400" />
                          <span>Ilość paczek: {zamowienie.iloscPaczek}</span>
                        </div>
                        {zamowienie.MPK && (
                          <div className="flex items-center text-sm">
                            <span className="text-gray-500">MPK: {zamowienie.MPK}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-sm">
                          <Weight className="w-4 h-4 mr-2 text-gray-400" />
                          <span>Waga: {zamowienie.waga} kg</span>
                        </div>
                        <div className="flex items-center text-sm">
                          <Ruler className="w-4 h-4 mr-2 text-gray-400" />
                          <span>Wymiary: {zamowienie.dlugosc}×{zamowienie.szerokosc}×{zamowienie.wysokosc} cm</span>
                        </div>
                      </div>
                      {zamowienie.uwagi && (
                        <div className="md:col-span-2">
                          <div className="text-sm">
                            <span className="text-gray-500">Uwagi: {zamowienie.uwagi}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Przyciski akcji */}
                {zamowienie.status === 'oczekujące' && (
                  <div className="mt-6 flex justify-end space-x-4">
                    <button
                      onClick={() => onUsun(zamowienie.id)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Usuń
                    </button>
                    <button
                      onClick={() => onZatwierdz(zamowienie.id)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-red-700"
                    >
                      Zatwierdź i wyślij do DHL
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}