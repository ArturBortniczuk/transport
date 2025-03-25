'use client'
import { useState } from 'react'

export default function KurierForm({ onSubmit, magazynNadawcy, onCancel }) {
    const [formData, setFormData] = useState({
    // Dane nadawcy
    nadawcaTyp: 'firma',
    nadawcaNazwa: '',
    nadawcaUlica: '',
    nadawcaNumerDomu: '',
    nadawcaNumerLokalu: '',
    nadawcaKodPocztowy: '',
    nadawcaMiasto: '',
    nadawcaOsobaKontaktowa: '',
    nadawcaTelefon: '',
    nadawcaEmail: '',
    
    // Dane odbiorcy
    odbiorcaTyp: 'osoba',
    odbiorcaNazwa: '',
    odbiorcaUlica: '',
    odbiorcaNumerDomu: '',
    odbiorcaNumerLokalu: '',
    odbiorcaKodPocztowy: '',
    odbiorcaMiasto: '',
    odbiorcaOsobaKontaktowa: '',
    odbiorcaTelefon: '',
    odbiorcaEmail: '',
    
    // Szczegóły przesyłki
    zawartoscPrzesylki: '',
    MPK: '',
    uwagi: '',
    iloscPaczek: 1,
    waga: '',
    dlugosc: '',
    szerokosc: '',
    wysokosc: ''
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
    // Resetujemy formularz
    setFormData({
      nadawcaTyp: 'firma',
      nadawcaNazwa: '',
      nadawcaUlica: '',
      nadawcaNumerDomu: '',
      nadawcaNumerLokalu: '',
      nadawcaKodPocztowy: '',
      nadawcaMiasto: '',
      nadawcaOsobaKontaktowa: '',
      nadawcaTelefon: '',
      nadawcaEmail: '',
      
      odbiorcaTyp: 'osoba',
      odbiorcaNazwa: '',
      odbiorcaUlica: '',
      odbiorcaNumerDomu: '',
      odbiorcaNumerLokalu: '',
      odbiorcaKodPocztowy: '',
      odbiorcaMiasto: '',
      odbiorcaOsobaKontaktowa: '',
      odbiorcaTelefon: '',
      odbiorcaEmail: '',
      
      zawartoscPrzesylki: '',
      MPK: '',
      uwagi: '',
      iloscPaczek: 1,
      waga: '',
      dlugosc: '',
      szerokosc: '',
      wysokosc: ''
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4">
        <h2 className="text-xl font-bold text-white">Nowe zamówienie kuriera</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Sekcja Nadawcy */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nadawca</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="nadawcaTyp"
                    value="osoba"
                    checked={formData.nadawcaTyp === 'osoba'}
                    onChange={handleChange}
                    className="form-radio text-blue-600"
                  />
                  <span className="ml-2">Osoba prywatna</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="nadawcaTyp"
                    value="firma"
                    checked={formData.nadawcaTyp === 'firma'}
                    onChange={handleChange}
                    className="form-radio text-blue-600"
                  />
                  <span className="ml-2">Firma/Instytucja</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {formData.nadawcaTyp === 'osoba' ? 'Imię i nazwisko' : 'Nazwa firmy'}
              </label>
              <input
                type="text"
                name="nadawcaNazwa"
                value={formData.nadawcaNazwa}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Ulica</label>
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-4">
                  <input
                    type="text"
                    name="nadawcaUlica"
                    value={formData.nadawcaUlica}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="nadawcaNumerDomu"
                    value={formData.nadawcaNumerDomu}
                    onChange={handleChange}
                    placeholder="Nr domu"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="nadawcaNumerLokalu"
                    value={formData.nadawcaNumerLokalu}
                    onChange={handleChange}
                    placeholder="Nr lok."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kod pocztowy</label>
              <input
                type="text"
                name="nadawcaKodPocztowy"
                value={formData.nadawcaKodPocztowy}
                onChange={handleChange}
                placeholder="00-000"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Miejscowość</label>
              <input
                type="text"
                name="nadawcaMiasto"
                value={formData.nadawcaMiasto}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Osoba kontaktowa</label>
              <input
                type="text"
                name="nadawcaOsobaKontaktowa"
                value={formData.nadawcaOsobaKontaktowa}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Telefon</label>
              <input
                type="tel"
                name="nadawcaTelefon"
                value={formData.nadawcaTelefon}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="nadawcaEmail"
                value={formData.nadawcaEmail}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        </div>
        {/* Sekcja Odbiorcy */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Odbiorca</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="odbiorcaTyp"
                    value="osoba"
                    checked={formData.odbiorcaTyp === 'osoba'}
                    onChange={handleChange}
                    className="form-radio text-red-600"
                  />
                  <span className="ml-2">Osoba prywatna</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="odbiorcaTyp"
                    value="firma"
                    checked={formData.odbiorcaTyp === 'firma'}
                    onChange={handleChange}
                    className="form-radio text-red-600"
                  />
                  <span className="ml-2">Firma/Instytucja</span>
                </label>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {formData.odbiorcaTyp === 'osoba' ? 'Imię i nazwisko' : 'Nazwa firmy'}
              </label>
              <input
                type="text"
                name="odbiorcaNazwa"
                value={formData.odbiorcaNazwa}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Ulica</label>
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-4">
                  <input
                    type="text"
                    name="odbiorcaUlica"
                    value={formData.odbiorcaUlica}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="odbiorcaNumerDomu"
                    value={formData.odbiorcaNumerDomu}
                    onChange={handleChange}
                    placeholder="Nr domu"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    name="odbiorcaNumerLokalu"
                    value={formData.odbiorcaNumerLokalu}
                    onChange={handleChange}
                    placeholder="Nr lok."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Kod pocztowy</label>
              <input
                type="text"
                name="odbiorcaKodPocztowy"
                value={formData.odbiorcaKodPocztowy}
                onChange={handleChange}
                placeholder="00-000"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Miejscowość</label>
              <input
                type="text"
                name="odbiorcaMiasto"
                value={formData.odbiorcaMiasto}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Telefon</label>
              <input
                type="tel"
                name="odbiorcaTelefon"
                value={formData.odbiorcaTelefon}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                name="odbiorcaEmail"
                value={formData.odbiorcaEmail}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>
          </div>
        </div>
        {/* Sekcja Szczegółów Przesyłki */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Szczegóły przesyłki</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Zawartość przesyłki</label>
              <input
                type="text"
                name="zawartoscPrzesylki"
                value={formData.zawartoscPrzesylki}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">MPK</label>
              <input
                type="text"
                name="MPK"
                value={formData.MPK}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Ilość paczek</label>
              <input
                type="number"
                name="iloscPaczek"
                value={formData.iloscPaczek}
                onChange={handleChange}
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                required
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Waga (kg)</label>
                <input
                  type="number"
                  name="waga"
                  value={formData.waga}
                  onChange={handleChange}
                  step="0.1"
                  min="0.1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Długość (cm)</label>
                <input
                  type="number"
                  name="dlugosc"
                  value={formData.dlugosc}
                  onChange={handleChange}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Szerokość (cm)</label>
                <input
                  type="number"
                  name="szerokosc"
                  value={formData.szerokosc}
                  onChange={handleChange}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Wysokość (cm)</label>
                <input
                  type="number"
                  name="wysokosc"
                  value={formData.wysokosc}
                  onChange={handleChange}
                  min="1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
                  required
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Uwagi</label>
              <textarea
                name="uwagi"
                value={formData.uwagi}
                onChange={handleChange}
                rows="3"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Przyciski formularza */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            type="button"
            onClick={() => onCancel()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Zamów kuriera
          </button>
        </div>
      </div>
    </form>
  )
}