'use client'
import { useState, useEffect } from 'react';
import AdminCheck from '@/components/AdminCheck';
import Link from 'next/link';

export default function CableAdvicesPage() {
  const [advices, setAdvices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdvice, setEditingAdvice] = useState(null);

  const initialFormState = {
    supplier: 'NKT',
    order_type: 'ZD',
    order_number: '',
    unloading_place: 'WMS Zielonka',
    cable_voltage: 'NN',
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
    fetchAdvices();
  }, []);

  const fetchAdvices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cable-advices');
      if (!res.ok) throw new Error('Nie udało się pobrać danych');
      const data = await res.json();
      setAdvices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
      setFormData(initialFormState);
      
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (advice) => {
    const formattedData = { ...advice };
    // Formatowanie dat dla input type="date"
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
    <AdminCheck requiredPermission="cable_advices">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link href="/admin" className="mr-4 text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Awizacje Kabli</h1>
          </div>
          <button
            onClick={() => {
              setFormData(initialFormState);
              setEditingAdvice(null);
              setShowForm(!showForm);
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
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">{editingAdvice ? 'Edytuj awizację' : 'Nowa awizacja'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Podstawowe dane zamówienia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dostawca</label>
                  <select name="supplier" value={formData.supplier} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="NKT">NKT</option>
                    <option value="ELPAR">ELPAR</option>
                    <option value="NEXANS">NEXANS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ zamówienia</label>
                  <select name="order_type" value={formData.order_type} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="ZD">ZD</option>
                    <option value="ZDS">ZDS</option>
                    <option value="ZDH">ZDH</option>
                    <option value="ZDB">ZDB</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numer zamówienia</label>
                  <input type="text" name="order_number" value={formData.order_number} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                </div>

                {/* Miejsce i sprzęt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Miejsce rozładunku</label>
                  <select name="unloading_place" value={formData.unloading_place} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="WMS Zielonka">WMS Zielonka</option>
                    <option value="WMS Białystok">WMS Białystok</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rodzaj kabla (NN/WN)</label>
                  <select name="cable_voltage" value={formData.cable_voltage} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="NN">Niskie napięcie (NN)</option>
                    <option value="WN">Wysokie napięcie (WN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Szczegóły kabla (np. PGE)</label>
                  <input type="text" name="cable_type_details" value={formData.cable_type_details} onChange={handleInputChange} placeholder="np. PGE/Tauron/ENEA lub nazwa" className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>

                {/* Ilości */}
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

                {/* Terminy Wstępne */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Termin wstępny (Od)</label>
                  <input type="date" name="preliminary_date_from" value={formData.preliminary_date_from} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Termin wstępny (Do)</label>
                  <input type="date" name="preliminary_date_to" value={formData.preliminary_date_to} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>

                <div></div> {/* Pusty slot dla układu */}

                {/* Terminy Ostateczne */}
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
                <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50">
                  {isSubmitting ? 'Zapisywanie...' : 'Zapisz'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabela awizacji */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Ładowanie danych...</div>
          ) : advices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Brak zapisanych awizacji.</div>
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
                    <tr key={advice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{advice.order_number}</div>
                        <div className="text-sm text-gray-500">{advice.supplier} | {advice.order_type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{advice.cable_voltage} - {advice.cable_type_details}</div>
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
                        <div className="text-sm font-medium text-indigo-600">
                          {advice.final_date_from ? new Date(advice.final_date_from).toLocaleDateString() : 'Brak'} 
                          {advice.final_date_to && ` do ${new Date(advice.final_date_to).toLocaleDateString()}`}
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
    </AdminCheck>
  );
}
