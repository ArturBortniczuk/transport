'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import AdminCheck from '@/components/AdminCheck';

export default function ValuationSettingsAdmin() {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/valuation-settings');
            if (!response.ok) throw new Error('Błąd pobierania ustawień');
            const data = await response.json();
            setSettings(data);
        } catch (error) {
            console.error(error);
            setMessage('Nie udało się pobrać ustawień wyceny.');
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleChange = (key, newValue) => {
        setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');

        try {
            const response = await fetch('/api/admin/valuation-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Błąd zapisywania');

            setMessage('Ustawienia zostały pomyślnie zapisane.');
            setMessageType('success');

            // Ukryj wiadomość po 3 sekundach
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error(error);
            setMessage('Nie udało się zapisać ustawień: ' + error.message);
            setMessageType('error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminCheck requireFullAdmin={true}>
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                            <Settings className="mr-3 h-8 w-8 text-blue-600" />
                            Parametry Wyceny Transportu
                        </h1>
                        <p className="text-gray-500 mt-2">Dostosuj stawki i mnożniki używane w kalkulatorze transportu we własnym zakresie.</p>
                    </div>
                    <button
                        onClick={fetchSettings}
                        className="flex items-center p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Odśwież formularz"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {message && (
                    <div className={`p-4 mb-6 rounded-md flex items-center ${messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {messageType === 'success' ? <CheckCircle className="w-5 h-5 mr-3 text-green-500" /> : <AlertCircle className="w-5 h-5 mr-3 text-red-500" />}
                        {message}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                        <span className="ml-3 text-gray-500">Pobieranie ustawień...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                        <div className="p-0">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Parametr / Opis</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Wartość</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Typ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {settings.map((setting) => (
                                        <tr key={setting.key} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">{setting.name}</div>
                                                <div className="text-xs text-gray-500 mt-1">{setting.description}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step={setting.type === 'number' && setting.key === 'rate_per_km' ? "0.01" : "1"}
                                                        value={setting.value}
                                                        onChange={(e) => handleChange(setting.key, e.target.value)}
                                                        className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        required
                                                    />
                                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500 sm:text-sm">
                                                            {setting.type === 'percentage' ? '%' : (setting.key.includes('threshold') ? (setting.key.includes('weight') ? 'kg' : (setting.key.includes('days') ? 'dni' : 'm')) : 'PLN')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${setting.type === 'percentage' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                    {setting.type === 'percentage' ? 'Mnożnik / Wskaźnik (%)' : 'Wartość Stała (Liczba)'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={fetchSettings}
                                className="mr-4 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Anuluj
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex justify-center items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                            >
                                {saving ? (
                                    <><RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" /> Zapisywanie...</>
                                ) : (
                                    <><Save className="-ml-1 mr-2 h-4 w-4" /> Zapisz Ustawienia</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </AdminCheck>
    );
}
