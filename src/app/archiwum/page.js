'use client'
import { useState, useEffect } from 'react'
// Dodaj na początku pliku, po importach
const KIEROWCY = [
  { id: 1, imie: "Dzianis Nestser", telefon: "885 560 083", tabliceRej: "BI 833JG" },
  { id: 2, imie: "Wojciech Ostaszewski", telefon: "691 690 165", tabliceRej: "BI 25150" },
  { id: 3, imie: "Wojciech Ostaszewski", telefon: "691 690 165", tabliceRej: "BI 23003" },
  { id: 4, imie: "Krzysztof Sobolewski", telefon: "885 561 444", tabliceRej: "BI 61620" },
  { id: 5, imie: "Krzysztof Bauer", telefon: "693 880 149", tabliceRej: "BI 609EM" },
  { id: 6, imie: "Paweł Stradomski", telefon: "885 560 557", tabliceRej: "BI 517GL" }
];

const RYNKI = [
  'Podlaski',
  'Mazowiecki',
  'Pomorski',
  'Lubelski',
  'Śląski',
  'Wielkopolski',
  'Małopolski',
  'Dolnośląski'
];

const POZIOMY_ZALADUNKU = [
  '25%',
  '50%',
  '75%',
  '100%'
];

const ArchiwumPage = () => {
  const [archiwum, setArchiwum] = useState([])

  useEffect(() => {
    const savedArchiwum = localStorage.getItem('archiwumTransportow')
    if (savedArchiwum) {
      setArchiwum(JSON.parse(savedArchiwum))
    }
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Archiwum Transportów</h1>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data transportu
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Miejsce docelowe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Magazyn
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Odległość
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data zakończenia
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archiwum.map((transport) => (
                <tr key={transport.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transport.dataDostawy).toLocaleDateString('pl')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.miasto} ({transport.kodPocztowy})
                    {transport.ulica && ` - ${transport.ulica}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.zrodlo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.odleglosc || 'N/A'} km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {transport.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transport.dataZakonczenia ? new Date(transport.dataZakonczenia).toLocaleString('pl') : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ArchiwumPage