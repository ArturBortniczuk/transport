'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AwizacjeKabliPage() {
  const [advices, setAdvices] = useState([]);
  const [users, setUsers] = useState([]);
  const [dictionaries, setDictionaries] = useState({
    supplier: [],
    order_type: [],
    unloading_place: [],
    cable_voltage: [],
    cable_guidelines: [],
    warehouse: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdvice, setEditingAdvice] = useState(null);

  const RYNKI = ["Mazowiecki", "Podlaski", "Śląski", "Dolnośląski", "Wielkopolski", "Małopolski", "Lubelski", "Pomorski", "Zachodniopomorski"];

  const initialFormState = {
    supplier: '',
    order_type: '',
    order_number: '',
    unloading_place: '',
    cable_voltage: '',
    cable_guidelines: '',
    packagings_data: [],
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
      
      const [advicesRes, dictRes, usersRes] = await Promise.all([
        fetch('/api/cable-advices'),
        fetch('/api/cable-dictionaries'),
        fetch('/api/users')
      ]);
      
      if (!advicesRes.ok || !dictRes.ok) throw new Error('Nie udało się pobrać danych');
      
      const advicesData = await advicesRes.json();
      const dictData = await dictRes.json();
      const usersData = usersRes.ok ? await usersRes.json() : [];
      
      setAdvices(advicesData);
      setUsers(usersData);
      
      const groupedDicts = {
        supplier: dictData.filter(d => d.category === 'supplier'),
        order_type: dictData.filter(d => d.category === 'order_type'),
        unloading_place: dictData.filter(d => d.category === 'unloading_place'),
        cable_voltage: dictData.filter(d => d.category === 'cable_voltage'),
        cable_guidelines: dictData.filter(d => d.category === 'cable_guidelines'),
        warehouse: dictData.filter(d => d.category === 'warehouse')
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

  const handleAddPackaging = () => {
    setFormData(prev => ({
      ...prev,
      packagings_data: [
        ...prev.packagings_data,
        { drums: 1, length: 1000, dest_type: 'Rynek', dest_value: RYNKI[0] }
      ]
    }));
  };

  const handleRemovePackaging = (index) => {
    setFormData(prev => ({
      ...prev,
      packagings_data: prev.packagings_data.filter((_, i) => i !== index)
    }));
  };

  const handlePackagingChange = (index, field, value) => {
    setFormData(prev => {
      const newData = [...prev.packagings_data];
      newData[index] = { ...newData[index], [field]: value };
      
      // Reset dest_value when type changes
      if (field === 'dest_type') {
        if (value === 'Rynek') newData[index].dest_value = RYNKI[0];
        else if (value === 'Handlowiec') newData[index].dest_value = users[0]?.name || '';
        else if (value === 'Magazyn') newData[index].dest_value = dictionaries.warehouse[0]?.value || '';
      }
      
      return { ...prev, packagings_data: newData };
    });
  };

  const calculateTotalQuantity = () => {
    return formData.packagings_data.reduce((sum, item) => {
      const drums = parseInt(item.drums) || 0;
      const length = parseInt(item.length) || 0;
      return sum + (drums * length);
    }, 0);
  };

  const handleNewForm = () => {
    setFormData({
      ...initialFormState,
      supplier: dictionaries.supplier[0]?.value || '',
      order_type: dictionaries.order_type[0]?.value || '',
      unloading_place: dictionaries.unloading_place[0]?.value || '',
      cable_voltage: dictionaries.cable_voltage[0]?.value || '',
      cable_guidelines: dictionaries.cable_guidelines[0]?.value || '',
      packagings_data: [{ drums: 1, length: 1000, dest_type: 'Rynek', dest_value: RYNKI[0] }]
    });
    setEditingAdvice(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.packagings_data.length === 0) {
      alert('Musisz dodać przynajmniej jedną konfekcję!');
      return;
    }
    
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
    
    // Parse JSON array if it's string
    if (typeof formattedData.packagings_data === 'string') {
      try {
        formattedData.packagings_data = JSON.parse(formattedData.packagings_data);
      } catch (e) {
        formattedData.packagings_data = [];
      }
    }
    if (!formattedData.packagings_data) formattedData.packagings_data = [];
    
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

  const parsePackagings = (dataStr) => {
    if (!dataStr) return [];
    if (typeof dataStr !== 'string') return dataStr;
    try { return JSON.parse(dataStr); } catch (e) { return []; }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Awizacje Kabli</h1>
        <button
          onClick={() => {
            if (showForm) setShowForm(false);
            else handleNewForm();
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Wytyczne kabla</label>
                <select name="cable_guidelines" value={formData.cable_guidelines} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                  <option value="" disabled>Wybierz wytyczne</option>
                  {dictionaries.cable_guidelines.map(d => (
                    <option key={d.id} value={d.value}>{d.value}</option>
                  ))}
                </select>
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

            {/* SEKCJA KONFEKCJI I PRZEZNACZENIA */}
            <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Konfekcja i Przeznaczenie</h3>
                <span className="bg-indigo-100 text-indigo-800 py-1 px-3 rounded-full font-bold text-sm">
                  Łączna ilość: {calculateTotalQuantity()} m
                </span>
              </div>
              
              {formData.packagings_data.map((pack, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-3 mb-4 p-4 bg-white rounded shadow-sm border border-gray-100">
                  <div className="w-20">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Bębny</label>
                    <input type="number" min="1" value={pack.drums} onChange={(e) => handlePackagingChange(idx, 'drums', e.target.value)} className="w-full border-gray-300 rounded-md text-sm" required />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Długość (m)</label>
                    <input type="number" min="1" value={pack.length} onChange={(e) => handlePackagingChange(idx, 'length', e.target.value)} className="w-full border-gray-300 rounded-md text-sm" required />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Dla kogo</label>
                    <select value={pack.dest_type} onChange={(e) => handlePackagingChange(idx, 'dest_type', e.target.value)} className="w-full border-gray-300 rounded-md text-sm">
                      <option value="Rynek">Rynek</option>
                      <option value="Handlowiec">Handlowiec</option>
                      <option value="Magazyn">Magazyn</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Wybór ({pack.dest_type})</label>
                    {pack.dest_type === 'Rynek' && (
                      <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm">
                        {RYNKI.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                    {pack.dest_type === 'Handlowiec' && (
                      <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm">
                        {users.map(u => <option key={u.email} value={u.name}>{u.name}</option>)}
                      </select>
                    )}
                    {pack.dest_type === 'Magazyn' && (
                      <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm">
                        {dictionaries.warehouse.map(w => <option key={w.id} value={w.value}>{w.value}</option>)}
                      </select>
                    )}
                  </div>
                  <button type="button" onClick={() => handleRemovePackaging(idx)} className="text-red-500 hover:text-red-700 p-2" title="Usuń pozycję">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}

              <button type="button" onClick={handleAddPackaging} className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Dodaj konfekcję
              </button>
            </div>

            <div className="flex justify-end">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konfekcja i Przeznaczenie</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Terminy</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {advices.map((advice) => {
                  const packs = parsePackagings(advice.packagings_data);
                  return (
                    <tr key={advice.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{advice.order_number}</div>
                        <div className="text-sm text-gray-500">{advice.supplier} | {advice.order_type}</div>
                        <div className="text-xs text-gray-400 mt-1">Rozładunek: {advice.unloading_place}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 font-medium">{advice.cable_voltage}</div>
                        <div className="text-sm text-gray-500">Wyt: {advice.cable_guidelines}</div>
                        <div className="text-sm font-bold text-indigo-600 mt-1">Suma: {advice.quantity}m</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {packs.map((p, i) => (
                            <div key={i} className="text-xs border-l-2 border-indigo-200 pl-2">
                              <span className="font-medium text-gray-700">{p.drums}x{p.length}m</span>
                              <span className="text-gray-500 mx-1">➜</span>
                              <span className="text-gray-600">[{p.dest_type}] {p.dest_value}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-gray-500">
                          Wst: {advice.preliminary_date_from ? new Date(advice.preliminary_date_from).toLocaleDateString() : '-'} 
                          {advice.preliminary_date_to && ` do ${new Date(advice.preliminary_date_to).toLocaleDateString()}`}
                        </div>
                        <div className="text-xs font-medium text-indigo-600 mt-1">
                          Ost: {advice.final_date_from ? new Date(advice.final_date_from).toLocaleDateString() : '-'} 
                          {advice.final_date_to && ` do ${new Date(advice.final_date_to).toLocaleDateString()}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEdit(advice)} className="text-indigo-600 hover:text-indigo-900 mr-4">Edytuj</button>
                        <button onClick={() => handleDelete(advice.id)} className="text-red-600 hover:text-red-900">Usuń</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
