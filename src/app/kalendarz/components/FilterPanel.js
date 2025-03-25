'use client'
import { KIEROWCY, RYNKI } from '../constants'

export default function FilterPanel({ filtryAktywne, setFiltryAktywne }) {
  return (
    <div className="mb-6 bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Filtry</h3>
      <div className="grid grid-cols-3 gap-4">
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
            onChange={(e) => setFiltryAktywne(prev => ({...prev, kierowca: e.target.value}))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Wszyscy kierowcy</option>
            {KIEROWCY.map(kierowca => (
              <option key={kierowca.id} value={kierowca.id}>
                {kierowca.imie} ({kierowca.tabliceRej})
              </option>
            ))}
          </select>
        </div>

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
      </div>
    </div>
  );
}