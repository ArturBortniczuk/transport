'use client'
import { useState, useEffect } from 'react'
import AdminCheck from '@/components/AdminCheck'
import Link from 'next/link'

export default function ValuationSettingsPage() {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/valuation-settings');

            if (!response.ok) {
                throw new Error('Problem z pobraniem danych');
            }

            const data = await response.json();
            setSettings(data.settings || []);
        } catch (err) {
            setError('Nie udało się pobrać ustawień wyceny: ' + err.message);
            console.error('Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (id, newValue) => {
        setSettings(settings.map(setting =>
            setting.id === id ? { ...setting, value: newValue } : setting
        ));
        setSaveStatus(''); // Wyzeruj status zapisu, gdy uzytkownik zaczyna edycję
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);
        setSaveStatus('Zapisywanie...');

        try {
            const response = await fetch('/api/valuation-settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ settings })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Problem z zapisem danych');
            }

            setSaveStatus('Zmiany zostały pomyślnie zapisane!');
            setTimeout(() => setSaveStatus(''), 4000);

            // Odswiez po udanym zapisie
            fetchSettings();
        } catch (err) {
            setError('Wystąpił błąd podczas zapisywania: ' + err.message);
            setSaveStatus('');
            console.error('Error saving settings:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const renderInput = (setting) => {
        switch (setting.type) {
            case 'number':
                return (
                    <div className="relative rounded-md shadow-sm w-full md:w-48">
                        <input
                            type="number"
                            step="0.01"
                            value={setting.value}
                            onChange={(e) => handleInputChange(setting.id, e.target.value)}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-12 sm:text-sm border-gray-300 rounded-md py-2"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">
                                {setting.key.includes('km') ? 'PLN/km' :
                                    setting.key.includes('rate') ? 'PLN' :
                                        setting.key.includes('weight') ? 'kg' :
                                            setting.key.includes('length') ? 'm' :
                                                setting.key.includes('days') ? 'dni' : ''}
                            </span>
                        </div>
                    </div>
                );
            case 'percentage':
                return (
                    <div className="relative rounded-md shadow-sm w-full md:w-48">
                        <input
                            type="number"
                            step="1"
                            value={setting.value}
                            onChange={(e) => handleInputChange(setting.id, e.target.value)}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-3 pr-8 sm:text-sm border-gray-300 rounded-md py-2"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                        </div>
                    </div>
                );
            default:
                return (
                    <input
                        type="text"
                        value={setting.value}
                        onChange={(e) => handleInputChange(setting.id, e.target.value)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3"
                    />
                );
        }
    };

    return (
        <AdminCheck>
            <div className="max-w-4xl mx-auto p-6">
                {/* Nawigacja */}
                <div className="mb-6">
                    <Link href="/admin" className="text-purple-600 hover:text-purple-800 flex items-center text-sm font-medium">
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Powrót do Panelu
                    </Link>
                </div>

                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                            <span className="bg-purple-100 p-2 rounded-lg mr-3">
                                <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </span>
                            Ustawienia Wyceny Transportu
                        </h1>
                        <p className="text-gray-500 mt-2 ml-14">
                            Konfiguruj parametry wykorzystywane przez algorytm do szacowania kosztów transportu na stronie głównej wyceny.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                    <form onSubmit={handleSave}>
                        <div className="p-6">

                            {error && (
                                <div className="mb-6 p-4 bg-red-50 text-red-700 border-l-4 border-red-500 rounded-r-md">
                                    <div className="flex">
                                        <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        {error}
                                    </div>
                                </div>
                            )}

                            {loading ? (
                                <div className="py-12 flex justify-center items-center flex-col">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                                    <p className="text-gray-500">Pobieranie konfiguracji...</p>
                                </div>
                            ) : settings.length === 0 ? (
                                <div className="py-12 text-center text-gray-500">
                                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Brak parametrów w bazie. Upewnij się, że migracje zostały poprawnie wykonane.
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {settings.map((setting) => (
                                        <div key={setting.id} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between">
                                                <div className="mb-4 md:mb-0 md:w-2/3 pr-4">
                                                    <label htmlFor={`setting-${setting.id}`} className="block text-sm font-bold text-gray-800 mb-1">
                                                        {setting.name}
                                                    </label>
                                                    {setting.description && (
                                                        <p className="text-sm text-gray-500 leading-relaxed">
                                                            {setting.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="md:w-1/3 flex md:justify-end">
                                                    {renderInput(setting)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!loading && settings.length > 0 && (
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                                <div>
                                    {saveStatus && (
                                        <span className={`text-sm font-medium ${saveStatus.includes('omyślnie') ? 'text-green-600' : 'text-purple-600 animate-pulse'}`}>
                                            {saveStatus}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className={`inline-flex items-center px-6 py-2.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                    ${isSaving ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-700 hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors'}`}
                                >
                                    {isSaving ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Zapisywanie...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                            </svg>
                                            Zapisz wszystkie zmiany
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </AdminCheck>
    );
}
