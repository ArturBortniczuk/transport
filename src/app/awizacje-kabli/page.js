'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SearchableSelect from '@/components/SearchableSelect';

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
  const [cablesCatalog, setCablesCatalog] = useState({ uniqueNames: [], grouped: {} });
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
      
      const [advicesRes, dictRes, usersRes, cablesRes] = await Promise.all([
        fetch('/api/cable-advices'),
        fetch('/api/cable-dictionaries'),
        fetch('/api/users'),
        fetch('/api/cables-catalog')
      ]);
      
      if (!advicesRes.ok || !dictRes.ok) throw new Error('Nie udało się pobrać danych');
      
      const advicesData = await advicesRes.json();
      const dictData = await dictRes.json();
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const cablesData = cablesRes.ok ? await cablesRes.json() : { uniqueNames: [], grouped: {} };
      
      setAdvices(advicesData);
      setUsers(usersData);
      setCablesCatalog(cablesData);
      
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

  const getNewPackaging = () => ({
    cable_name: '',
    cable_cross_section: '',
    cable_voltage: dictionaries.cable_voltage[0]?.value || '',
    cable_guidelines: dictionaries.cable_guidelines[0]?.value || '',
    drums: 1, 
    length: 1, // Domyślnie 1 km
    dest_type: 'Rynek', 
    dest_value: RYNKI[0] 
  });

  const handleAddPackaging = () => {
    setFormData(prev => ({
      ...prev,
      packagings_data: [
        ...prev.packagings_data,
        getNewPackaging()
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
      
      if (field === 'cable_name') {
        newData[index].cable_cross_section = '';
      }

      if (field === 'dest_type') {
        if (value === 'Rynek') newData[index].dest_value = RYNKI[0];
        else if (value === 'Handlowiec') newData[index].dest_value = users[0]?.name || '';
        else if (value === 'Magazyn') newData[index].dest_value = dictionaries.warehouse[0]?.value || '';
      }
      
      return { ...prev, packagings_data: newData };
    });
  };

  const calculateTotalQuantity = () => {
    const sum = formData.packagings_data.reduce((sum, item) => {
      const drums = parseInt(item.drums) || 0;
      // Zmieniamy parse na float
      const length = parseFloat(item.length?.toString().replace(',', '.')) || 0;
      return sum + (drums * length);
    }, 0);
    // Zaokrąglenie do maksymalnie 3 miejsc po przecinku
    return parseFloat(sum.toFixed(3));
  };

  const handleNewForm = () => {
    setFormData({
      ...initialFormState,
      supplier: dictionaries.supplier[0]?.value || '',
      order_type: dictionaries.order_type[0]?.value || '',
      unloading_place: dictionaries.unloading_place[0]?.value || '',
      packagings_data: [getNewPackaging()]
    });
    setEditingAdvice(null);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.packagings_data.length === 0) {
      alert('Musisz dodać przynajmniej jedną pozycję konfekcji!');
      return;
    }
    
    // Walidacja czy wszystkie odcinki mają nazwę i przekrój
    const invalidPackagings = formData.packagings_data.some(p => !p.cable_name || !p.cable_cross_section);
    if (invalidPackagings) {
      alert('Każdy dodany odcinek musi mieć określoną nazwę kabla oraz przekrój.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const payload = {
        ...formData,
        cable_name: '',
        cable_cross_section: '',
        cable_voltage: '',
        cable_guidelines: ''
      };

      const method = editingAdvice ? 'PUT' : 'POST';
      const url = editingAdvice ? `/api/cable-advices/${editingAdvice.id}` : '/api/cable-advices';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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
    
    if (typeof formattedData.packagings_data === 'string') {
      try {
        formattedData.packagings_data = JSON.parse(formattedData.packagings_data);
      } catch (e) {
        formattedData.packagings_data = [];
      }
    }
    if (!formattedData.packagings_data) formattedData.packagings_data = [];
    
    // Migracja starych danych z poziomu awizacji do poziomu konfekcji, jeśli brakuje
    formattedData.packagings_data = formattedData.packagings_data.map(p => ({
      ...p,
      cable_name: p.cable_name || advice.cable_name || '',
      cable_cross_section: p.cable_cross_section || advice.cable_cross_section || '',
      cable_voltage: p.cable_voltage || advice.cable_voltage || '',
      cable_guidelines: p.cable_guidelines || advice.cable_guidelines || ''
    }));

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
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg shadow-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showForm ? 'Powrót do listy' : '+ Dodaj Awizację'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-md">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 border border-gray-100">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">
            {editingAdvice ? 'Edytuj awizację' : 'Tworzenie nowej awizacji'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex justify-center items-center text-sm">1</span>
                Dane Ogólne
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dostawca</label>
                  <select name="supplier" value={formData.supplier} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="" disabled>Wybierz dostawcę</option>
                    {dictionaries.supplier.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Typ zamówienia</label>
                  <select name="order_type" value={formData.order_type} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required>
                    <option value="" disabled>Wybierz typ</option>
                    {dictionaries.order_type.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
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
                    {dictionaries.unloading_place.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex justify-center items-center text-sm">2</span>
                Terminy Dostawy
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wstępny (Od)</label>
                  <input type="date" name="preliminary_date_from" value={formData.preliminary_date_from} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wstępny (Do)</label>
                  <input type="date" name="preliminary_date_to" value={formData.preliminary_date_to} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ostateczny (Od)</label>
                  <input type="date" name="final_date_from" value={formData.final_date_from} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ostateczny (Do)</label>
                  <input type="date" name="final_date_to" value={formData.final_date_to} onChange={handleInputChange} className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-full flex justify-center items-center text-sm">3</span>
                  Kable i Konfekcja
                </h3>
                <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-sm">
                  Łącznie: {calculateTotalQuantity()} km
                </span>
              </div>
              
              <div className="space-y-6">
                {formData.packagings_data.map((pack, idx) => (
                  <div key={idx} className="relative bg-white rounded-xl shadow-sm border-2 border-indigo-50 p-6 transition-all hover:border-indigo-100">
                    {/* Usuwanie */}
                    {formData.packagings_data.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemovePackaging(idx)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                        title="Usuń ten kabel"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                    
                    <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-4 border-b border-indigo-50 pb-2">Odcinek kabla #{idx + 1}</h4>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Wybór kabla */}
                      <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Marka Kabla</label>
                        <SearchableSelect 
                          name="cable_name"
                          value={pack.cable_name}
                          onChange={(e) => handlePackagingChange(idx, 'cable_name', e.target.value)}
                          options={cablesCatalog.uniqueNames}
                          placeholder="Wybierz kabel..."
                        />
                      </div>
                      
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Przekrój</label>
                        <SearchableSelect 
                          name="cable_cross_section"
                          value={pack.cable_cross_section}
                          onChange={(e) => handlePackagingChange(idx, 'cable_cross_section', e.target.value)}
                          options={pack.cable_name && cablesCatalog.grouped[pack.cable_name] ? cablesCatalog.grouped[pack.cable_name] : []}
                          placeholder="Przekrój..."
                          disabled={!pack.cable_name}
                        />
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Napięcie</label>
                        <select value={pack.cable_voltage} onChange={(e) => handlePackagingChange(idx, 'cable_voltage', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="">-- wybierz --</option>
                          {dictionaries.cable_voltage.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                        </select>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Wytyczne</label>
                        <select value={pack.cable_guidelines} onChange={(e) => handlePackagingChange(idx, 'cable_guidelines', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                          <option value="">-- wybierz --</option>
                          {dictionaries.cable_guidelines.map(d => <option key={d.id} value={d.value}>{d.value}</option>)}
                        </select>
                      </div>

                      {/* Konfekcja */}
                      <div className="lg:col-span-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 flex gap-3">
                        <div className="w-1/2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Ilość Bębnów</label>
                          <input type="number" min="1" value={pack.drums} onChange={(e) => handlePackagingChange(idx, 'drums', e.target.value)} className="w-full border-gray-300 rounded-md text-sm font-bold text-center text-indigo-900 shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                        <div className="w-1/2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase">Długość (km)</label>
                          <input type="number" step="any" min="0.001" value={pack.length} onChange={(e) => handlePackagingChange(idx, 'length', e.target.value)} className="w-full border-gray-300 rounded-md text-sm font-bold text-center text-indigo-900 shadow-sm focus:ring-indigo-500 focus:border-indigo-500" required />
                        </div>
                      </div>

                      {/* Przeznaczenie */}
                      <div className="lg:col-span-12 flex flex-col sm:flex-row gap-4 mt-2 p-4 bg-gray-50 rounded-lg border border-gray-100 items-center">
                        <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Przeznaczenie:</span>
                        <div className="w-full sm:w-48">
                          <select value={pack.dest_type} onChange={(e) => handlePackagingChange(idx, 'dest_type', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="Rynek">Rynek</option>
                            <option value="Handlowiec">Handlowiec</option>
                            <option value="Magazyn">Magazyn</option>
                          </select>
                        </div>
                        <div className="w-full sm:w-64">
                          {pack.dest_type === 'Rynek' && (
                            <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                              {RYNKI.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          )}
                          {pack.dest_type === 'Handlowiec' && (
                            <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                              {users.map(u => <option key={u.email} value={u.name}>{u.name}</option>)}
                            </select>
                          )}
                          {pack.dest_type === 'Magazyn' && (
                            <select value={pack.dest_value} onChange={(e) => handlePackagingChange(idx, 'dest_value', e.target.value)} className="w-full border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                              {dictionaries.warehouse.map(w => <option key={w.id} value={w.value}>{w.value}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <button type="button" onClick={handleAddPackaging} className="inline-flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  Dodaj kolejny kabel do awizacji
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg mr-4 transition-colors">
                Anuluj
              </button>
              <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-8 py-2.5 rounded-lg font-bold shadow-md hover:bg-green-700 disabled:opacity-50 transition-colors">
                {isSubmitting ? 'Zapisywanie...' : 'Zapisz całą awizację'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Ładowanie awizacji...</div>
        ) : advices.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-lg">Brak zapisanych awizacji.</p>
            <p className="text-sm mt-2">Kliknij "+ Dodaj Awizację" u góry, aby utworzyć pierwszą.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Zamówienie</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kable i Konfekcja</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Terminy</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Akcje</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {advices.map((advice) => {
                  const packs = parsePackagings(advice.packagings_data);
                  
                  // Migracja danych dla wyświetlania starego zapisu awizacji (jeśli kabel nie był w paczce)
                  const displayPacks = packs.map(p => ({
                    ...p,
                    cable_name: p.cable_name || advice.cable_name || '-',
                    cable_cross_section: p.cable_cross_section || advice.cable_cross_section || '-',
                    cable_voltage: p.cable_voltage || advice.cable_voltage || '',
                    cable_guidelines: p.cable_guidelines || advice.cable_guidelines || ''
                  }));

                  return (
                    <tr key={advice.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-lg">{advice.order_number}</div>
                        <div className="text-sm font-medium text-indigo-600 mt-1">{advice.supplier}</div>
                        <div className="text-xs text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{advice.order_type}</div>
                        <div className="text-xs text-gray-500 mt-2 flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {advice.unloading_place}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-3">
                          {displayPacks.map((p, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded p-3 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <span className="font-bold text-gray-800">{p.cable_name}</span>
                                  <span className="ml-2 font-medium text-gray-600">{p.cable_cross_section}</span>
                                  {p.cable_voltage && <span className="ml-2 text-xs text-indigo-500">[{p.cable_voltage}]</span>}
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-indigo-700">{p.drums}x{p.length}km</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-500">{p.cable_guidelines ? `Wyt: ${p.cable_guidelines}` : ''}</span>
                                <span className="text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                  {p.dest_type}: <span className="font-medium text-gray-800">{p.dest_value}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {displayPacks.length > 1 && (
                          <div className="text-right mt-2 text-xs font-bold text-gray-500 uppercase">
                            Całkowita ilość: <span className="text-indigo-600">{advice.quantity}km</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="bg-gray-50 p-2 rounded border border-gray-100 mb-2">
                          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Termin Wstępny</div>
                          <div className="text-xs font-medium text-gray-700">
                            {advice.preliminary_date_from ? new Date(advice.preliminary_date_from).toLocaleDateString() : 'Brak'} 
                            {advice.preliminary_date_to && ` - ${new Date(advice.preliminary_date_to).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="bg-indigo-50 p-2 rounded border border-indigo-100">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Termin Ostateczny</div>
                          <div className="text-xs font-bold text-indigo-700">
                            {advice.final_date_from ? new Date(advice.final_date_from).toLocaleDateString() : 'Brak'} 
                            {advice.final_date_to && ` - ${new Date(advice.final_date_to).toLocaleDateString()}`}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-top">
                        <div className="flex flex-col gap-2 items-end">
                          <button onClick={() => handleEdit(advice)} className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors w-20 text-center">Edytuj</button>
                          <button onClick={() => handleDelete(advice.id)} className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors w-20 text-center">Usuń</button>
                        </div>
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
