'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AwizacjeKabliPage() {
  const [advices, setAdvices] = useState([]);
  const [dictionaries, setDictionaries] = useState({
    supplier: [],
    order_type: [],
    unloading_place: [],
    cable_voltage: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdvice, setEditingAdvice] = useState(null);

  const initialFormState = {
    supplier: '',
    order_type: '',
    order_number: '',
    unloading_place: '',
    cable_voltage: '',
    cable_type_details: '',
    quantity: '',
    packaging: '',
    destination: '',
    preliminary_date_from: '',
    preliminary_date_to: '',
    final_date_from: '',
    final_date_to: '',
    status: 'new'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [advicesRes, dictRes] = await Promise.all([
        fetch('/api/cable-advices'),
        fetch('/api/cable-dictionaries')
      ]);
      
      if (!advicesRes.ok || !dictRes.ok) throw new Error('Nie udało się pobrać danych');
      
      const advicesData = await advicesRes.json();
      const dictData = await dictRes.json();
      
      setAdvices(advicesData);
      
      // Grupowanie słowników po kategorii
      const groupedDicts = {
        supplier: dictData.filter(d => d.category === 'supplier'),
        order_type: dictData.filter(d => d.category === 'order_type'),
        unloading_place: dictData.filter(d => d.category === 'unloading_place'),
        cable_voltage: dictData.filter(d => d.category === 'cable_voltage')
      };
      setDictionaries(groupedDicts);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvices = async () => {
    try {
      const res = await fetch('/api/cable-advices');
      if (res.ok) {
        const data = await res.json();
        setAdvices(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNewForm = () => {
    // Ustawienie domyślnych wartości z pierwszych elementów słownika, jeśli są dostępne
    setFormData({
      ...initialFormState,
      supplier: dictionaries.supplier[0]?.value || '',
      order_type: dictionaries.order_type[0]?.value || '',
      unloading_place: dictionaries.unloading_place[0]?.value || '',
      cable_voltage: dictionaries.cable_voltage[0]?.value || ''
    });
    setEditingAdvice(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      const method = editingAdvice ? 'PUT' : 'POST';
      const url = editingAdvice ? `/api/cable-advices/${editingAdvice.id}` : '/api/cable-advices';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Wystąpił błąd podczas zapisywania');
      
      await fetchAdvices();
      setShowForm(false);
      setEditingAdvice(null);
      
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (advice) => {
    const formattedData = { ...advice };
    ['preliminary_date_from', 'preliminary_date_to', 'final_date_from', 'final_date_to'].forEach(field => {
      if (formattedData[field]) {
        formattedData[field] = formattedData[field].split('T')[0];
      }
    });
    
    setFormData(formattedData);
    setEditingAdvice(advice);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę awizację?')) return;
    
    try {
      const res = await fetch(`/api/cable-advices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Nie udało się usunąć awizacji');
      
      await fetchAdvices();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Awizacje Kabli</h1>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
            } else {
              handleNewForm();
            }
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
        >
          {showForm ? 'Anuluj' : 'Dodaj Awizację'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-t-4 border-indigo-500">
          <h2 className="text-xl font-semibold mb-4 text-indigo-900">{editingAdvice ? 'Edytuj awizację' : 'Nowa awizacja'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dostawca</label>
                <select name="supplier" value={formData.supplier} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                  <option value="" disabled>Wybierz dostawcę</option>
                  {dictionaries.supplier.map(d => (
                    <option key={d.id} value={d.value}>{d.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ zamówienia</label>
                <select name="order_type" value={formData.order_type} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                  <option value="" disabled>Wybierz typ</option>
                  {dictionaries.order_type.map(d => (
                    <option key={d.id} value={d.value}>{d.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numer zamówienia</label>
                <input type="text" name="order_number" value={formData.order_number} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Miejsce rozładunku</label>
                <select name="unloading_place" value={formData.unloading_place} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                  <option value="" disabled>Wybierz miejsce</option>
                  {dictionaries.unloading_place.map(d => (
                    <option key={d.id} value={d.value}>{d.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj kabla (NN/WN)</label>
                <select name="cable_voltage" value={formData.cable_voltage} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                  <option value="" disabled>Wybierz napięcie</option>
                  {dictionaries.cable_voltage.map(d => (
                    <option key={d.id} value={d.value}>{d.value}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Szczegóły kabla (np. PGE)</label>
                <input type="text" name="cable_type_details" value={formData.cable_type_details} onChange={handleInputChange} placeholder="np. PGE/Tauron/ENEA lub nazwa" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ilość</label>
                <input type="number" step="0.01" name="quantity" value={formData.quantity} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfekcja</label>
                <input type="text" name="packaging" value={formData.packaging} onChange={handleInputChange} placeholder="np. 5 bębnów po 500m" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Przeznaczenie</label>
                <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="rynek, handlowiec, konkretny WMS" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin wstępny (Od)</label>
                <input type="date" name="preliminary_date_from" value={formData.preliminary_date_from} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin wstępny (Do)</label>
                <input type="date" name="preliminary_date_to" value={formData.preliminary_date_to} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div></div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin ostateczny (Od)</label>
                <input type="date" name="final_date_from" value={formData.final_date_from} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Termin ostateczny (Do)</label>
                <input type="date" name="final_date_to" value={formData.final_date_to} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>

            </div>

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Ładowanie danych...</div>
        ) : advices.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p>Brak zapisanych awizacji.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zamówienie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kabel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Miejsce</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termin Wstępny</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Termin Ostateczny</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {advices.map((advice) => (
                  <tr key={advice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{advice.order_number}</div>
                      <div className="text-sm text-gray-500">{advice.supplier} | {advice.order_type}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 font-medium">{advice.cable_voltage} - {advice.cable_type_details}</div>
                      <div className="text-sm text-gray-500">Ilość: {advice.quantity} | {advice.packaging}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{advice.unloading_place}</div>
                      <div className="text-sm text-gray-500">{advice.destination}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {advice.preliminary_date_from ? new Date(advice.preliminary_date_from).toLocaleDateString() : '-'} 
                        <br/> do <br/> 
                        {advice.preliminary_date_to ? new Date(advice.preliminary_date_to).toLocaleDateString() : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded inline-block">
                        {advice.final_date_from ? new Date(advice.final_date_from).toLocaleDateString() : 'Brak'} 
                        {advice.final_date_to && ` - ${new Date(advice.final_date_to).toLocaleDateString()}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEdit(advice)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edytuj</button>
                      <button onClick={() => handleDelete(advice.id)} className="text-red-600 hover:text-red-900">Usuń</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
