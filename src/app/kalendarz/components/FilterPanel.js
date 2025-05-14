// src/app/kalendarz/components/FilterPanel.js

import { KIEROWCY, POJAZDY, RYNKI } from '../constants';

// W komponencie dodajemy nowe pole dla filtrowania według pojazdu
export default function FilterPanel({ filtryAktywne, setFiltryAktywne }) {
  return (
    <div className="mb-6 bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Filtry</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4"> {/* Zwiększamy liczbę kolumn z 4 na 5 */}
        {/* Istniejące filtry bez zmian */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Magazyn
          </label>
          <select
            value={filtryAktywne.magazyn}
            onChange={(e) => setFiltryAktywne(prev => ({...prev, magazyn: e.target.value}))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Wszystkie magazyny</option>
            <option value="bialystok">Magazyn Białystok</option>
            <option value="zielonka">Magazyn Zielonka</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Kierowca
          </label>
          <select
            value={filtryAktywne.kierowca}
            onChange={(e) => setFiltryAktywne(prev => ({...prev, kierowca: e.target.value ? parseInt(e.target.value) : ''}))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Wszyscy kierowcy</option>
            {KIEROWCY.map(kierowca => (
              <option key={kierowca.id} value={kierowca.id}>
                {kierowca.imie}
              </option>
            ))}
          </select>
        </div>

        {/* Nowy filtr pojazdu */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Pojazd
          </label>
          <select
            value={filtryAktywne.pojazd || ''}
            onChange={(e) => setFiltryAktywne(prev => ({...prev, pojazd: e.target.value ? parseInt(e.target.value) : ''}))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Wszystkie pojazdy</option>
            {POJAZDY.map(pojazd => (
              <option key={pojazd.id} value={pojazd.id}>
                {pojazd.tabliceRej} ({pojazd.model})
              </option>
            ))}
          </select>
        </div>

        {/* Pozostałe filtry bez zmian */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Rynek
          </label>
          <select
            value={filtryAktywne.rynek}
            onChange={(e) => setFiltryAktywne(prev => ({...prev, rynek: e.target.value}))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Wszystkie rynki</option>
            {RYNKI.map(rynek => (
              <option key={rynek} value={rynek}>
                {rynek.charAt(0).toUpperCase() + rynek.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status transportów
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="pokazZrealizowane"
              checked={filtryAktywne.pokazZrealizowane === true}
              onChange={(e) => setFiltryAktywne(prev => ({...prev, pokazZrealizowane: e.target.checked}))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="pokazZrealizowane" className="ml-2 block text-sm text-gray-700">
              Pokaż zrealizowane transporty
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
