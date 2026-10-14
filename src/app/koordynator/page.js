// src/app/koordynator/page.js
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FileSpreadsheet,
  MapPin,
  Upload,
  Search,
  Filter,
  X,
  Plus,
  Truck,
  CheckCircle2,
  Clock,
  Building,
  Calendar,
  Layers,
  Eye,
  RefreshCw,
  ArrowRight,
  Database,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import WzDetailsModal from '@/components/WzDetailsModal';
import CreateTransportFromWzModal from '@/components/CreateTransportFromWzModal';

// Dynamiczny import mapy Leaflet (bez SSR)
const WzLeafletMap = dynamic(
  () => import('@/components/WzLeafletMap'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col justify-center items-center h-[550px] w-full bg-blue-50/40 rounded-xl border border-blue-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
        <p className="text-sm text-blue-700 font-medium">Ładowanie mapy logistycznej...</p>
      </div>
    )
  }
);

export default function KoordynatorPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Aktywna zakładka: 'documents' (lista WZ), 'map' (mapa logistyczna), 'import' (import ERP)
  const [activeTab, setActiveTab] = useState('documents');

  // Dane WZ z bazy
  const [documents, setDocuments] = useState([]);
  const [mapDocuments, setMapDocuments] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [rynki, setRynki] = useState([]);
  const [handlowcy, setHandlowcy] = useState([]);
  const [typyDokumentow, setTypyDokumentow] = useState([]);
  const [stats, setStats] = useState({ total: 0, nowy: 0, przypisany: 0, zrealizowany: 0, totalBrutto: 0, totalWagaKg: 0, totalWagaTon: 0, totalBebny: 0 });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loadingData, setLoadingData] = useState(false);

  // Filtry
  const [search, setSearch] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRynek, setSelectedRynek] = useState('all');
  const [selectedHandlowiec, setSelectedHandlowiec] = useState('all');
  const [selectedTypDokumentu, setSelectedTypDokumentu] = useState('all');
  const [onlyWithDrums, setOnlyWithDrums] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Zaznaczone dokumenty WZ
  const [selectedWzNumbers, setSelectedWzNumbers] = useState([]);

  // Modale
  const [inspectWzNumber, setInspectWzNumber] = useState(null);
  const [isCreateTransportOpen, setIsCreateTransportOpen] = useState(false);

  // Stan importu CSV
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 1. Weryfikacja użytkownika
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();

        if (!data.isAuthenticated) {
          router.push('/login');
          return;
        }

        const role = (data.user?.role || '').toLowerCase();
        const isAdmin = data.user?.isAdmin === true || role === 'admin';
        const permissions = data.user?.permissions || {};
        const isMagazyn = role.includes('magazyn') || role === 'koordynator';
        const canView = isAdmin || isMagazyn || permissions.coordinator?.view !== false;

        if (!canView) {
          router.push('/dashboard');
          return;
        }

        setUser(data.user);
      } catch (error) {
        console.error('Błąd weryfikacji użytkownika:', error);
        router.push('/login');
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [router]);

  // 2. Pobieranie danych dokumentów WZ z API
  const fetchWzData = async (page = 1) => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
        search: search.trim(),
        warehouse: selectedWarehouse,
        status: selectedStatus,
        rynek: selectedRynek,
        handlowiec: selectedHandlowiec
      });
      if (selectedTypDokumentu !== 'all') params.append('typDokumentu', selectedTypDokumentu);
      if (onlyWithDrums) params.append('tylkoBebny', 'true');
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/wz?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setDocuments(json.documents || []);
        setPagination(json.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 });
        setStats(json.stats || { total: 0, nowy: 0, przypisany: 0, zrealizowany: 0, totalBrutto: 0, totalWagaKg: 0, totalWagaTon: 0, totalBebny: 0 });
        if (json.warehouses && json.warehouses.length > 0) setWarehouses(json.warehouses);
        if (json.rynki && json.rynki.length > 0) setRynki(json.rynki);
        if (json.handlowcy && json.handlowcy.length > 0) setHandlowcy(json.handlowcy);
        if (json.typyDokumentow && json.typyDokumentow.length > 0) setTypyDokumentow(json.typyDokumentow);
      }
    } catch (err) {
      console.error('Błąd pobierania WZ:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // 3. Pobieranie dokumentów dla mapy (z koordynatami)
  const fetchMapData = async () => {
    try {
      const params = new URLSearchParams({
        mapOnly: 'true',
        limit: '1500',
        warehouse: selectedWarehouse,
        status: selectedStatus,
        rynek: selectedRynek,
        handlowiec: selectedHandlowiec
      });
      if (selectedTypDokumentu !== 'all') params.append('typDokumentu', selectedTypDokumentu);
      if (onlyWithDrums) params.append('tylkoBebny', 'true');
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/wz?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setMapDocuments(json.documents || []);
      }
    } catch (err) {
      console.error('Błąd pobierania punktów mapy:', err);
    }
  };

  // Wywołanie pobierania po zmianie filtrów
  useEffect(() => {
    if (!loadingUser && user) {
      fetchWzData(1);
      fetchMapData();
    }
  }, [loadingUser, user, selectedWarehouse, selectedStatus, selectedRynek, selectedHandlowiec, selectedTypDokumentu, onlyWithDrums, dateFrom, dateTo]);

  // Szukanie z opóźnieniem
  useEffect(() => {
    if (!loadingUser && user) {
      const timer = setTimeout(() => {
        fetchWzData(1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [search]);

  // Obsługa zaznaczania
  const handleToggleSelect = (nrWz) => {
    setSelectedWzNumbers(prev =>
      prev.includes(nrWz) ? prev.filter(n => n !== nrWz) : [...prev, nrWz]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageWz = documents.map(d => d.nr_wz);
    const allSelected = pageWz.every(n => selectedWzNumbers.includes(n));
    if (allSelected) {
      setSelectedWzNumbers(prev => prev.filter(n => !pageWz.includes(n)));
    } else {
      setSelectedWzNumbers(prev => [...new Set([...prev, ...pageWz])]);
    }
  };

  const selectedDocsObjects = useMemo(() => {
    // Łączymy z aktualnej strony lub mapy
    const allKnown = [...documents, ...mapDocuments];
    const seen = new Set();
    const result = [];
    selectedWzNumbers.forEach(nr => {
      const doc = allKnown.find(d => d.nr_wz === nr);
      if (doc && !seen.has(nr)) {
        seen.add(nr);
        result.push(doc);
      }
    });
    return result;
  }, [selectedWzNumbers, documents, mapDocuments]);

  // Obsługa importu pliku
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsImporting(true);
    setImportMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/wz', {
        method: 'POST',
        body: formData
      });

      const json = await res.json();
      if (json.success) {
        setImportMessage({
          type: 'success',
          text: json.message,
          result: json.result
        });
        fetchWzData(1);
        fetchMapData();
      } else {
        setImportMessage({
          type: 'error',
          text: json.error || 'Błąd importu pliku'
        });
      }
    } catch (err) {
      setImportMessage({
        type: 'error',
        text: 'Wystąpił błąd podczas wysyłania pliku na serwer'
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* 1. Header & Navigation */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Dokumenty Magazynowe (WZ) & Logistyka
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Centralny panel synchronizacji z ERP, planowania tras na mapie i tworzenia transportów
              </p>
            </div>
          </div>

          {/* Przełącznik zakładek */}
          <div className="flex items-center bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/60 self-start md:self-auto">
            <button
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'documents'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Lista WZ ({pagination.total})</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'map'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>Mapa dostaw</span>
            </button>

            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'import'
                  ? 'bg-white text-blue-700 shadow-xs border border-gray-200/50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Import ERP (CSV)</span>
            </button>
          </div>
        </div>

        {/* 2. Karty statystyk */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Wszystkie dokumenty</p>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats.total.toLocaleString()}</p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Do zaplanowania</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{stats.nowy.toLocaleString()}</p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">W transporcie</p>
              <p className="text-2xl font-black text-purple-600 mt-1">{stats.przypisany.toLocaleString()}</p>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tonaż / Masa</p>
              <p className="text-xl font-black text-amber-600 mt-1">
                {stats.totalWagaTon ? `${stats.totalWagaTon} t` : `${stats.totalWagaKg || 0} kg`}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Bębny: {stats.totalBebny || 0} szt.</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Wartość brutto</p>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {stats.totalBrutto.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} zł
              </p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. Pasek filtrów wspólny dla Listy i Mapy */}
        {activeTab !== 'import' && (
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
              {/* Szukajka */}
              <div className="relative min-w-[220px] flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Szukaj po WZ, towarze, kliencie, adresie, bębnie..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Magazyn */}
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Wszystkie magazyny</option>
                {warehouses.map(w => (
                  <option key={w.symbol} value={w.symbol}>{w.label}</option>
                ))}
              </select>

              {/* Rynek */}
              <select
                value={selectedRynek}
                onChange={(e) => setSelectedRynek(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Wszystkie rynki</option>
                {rynki.map(r => (
                  <option key={r} value={r}>Rynek: {r}</option>
                ))}
              </select>

              {/* Typ dokumentu */}
              <select
                value={selectedTypDokumentu}
                onChange={(e) => setSelectedTypDokumentu(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Wszystkie typy</option>
                {typyDokumentow.map(t => (
                  <option key={t} value={t}>Typ: {t}</option>
                ))}
              </select>

              {/* Filtr bębnów */}
              <button
                type="button"
                onClick={() => setOnlyWithDrums(prev => !prev)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                  onlyWithDrums
                    ? 'bg-purple-100 text-purple-900 border-purple-300 shadow-2xs'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                title="Pokaż tylko dokumenty z bębnami kablowymi"
              >
                <span>📦 Bębny kablowe</span>
                {stats.totalBebny > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${onlyWithDrums ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {stats.docsWithDrums || stats.totalBebny}
                  </span>
                )}
              </button>

              {/* Handlowiec */}
              <select
                value={selectedHandlowiec}
                onChange={(e) => setSelectedHandlowiec(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[180px]"
              >
                <option value="all">Wszyscy handlowcy</option>
                {handlowcy.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3.5 py-2 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Wszystkie statusy</option>
                <option value="nowy">Do zaplanowania (Nowe)</option>
                <option value="przypisany">W transporcie</option>
                <option value="zrealizowany">Zrealizowane</option>
              </select>

              {/* Data od / do */}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs outline-none"
                  title="Data od"
                />
                <span>-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs outline-none"
                  title="Data do"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchWzData(pagination.page);
                  fetchMapData();
                }}
                className="p-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                title="Odśwież"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Pasek akcji zbiorczych gdy są zaznaczone dokumenty */}
        {selectedWzNumbers.length > 0 && (
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white p-4 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-sm">
                  Zaznaczono {selectedWzNumbers.length} dokumentów WZ
                </p>
                <p className="text-xs text-blue-100">
                  Pozycji: {selectedDocsObjects.reduce((acc, d) => acc + parseInt(d.pozycje_count || 0, 10), 0)} • 
                  Wartość: {selectedDocsObjects.reduce((acc, d) => acc + parseFloat(d.dok_brutto || 0), 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  {selectedDocsObjects.some(d => parseFloat(d.waga_suma || 0) > 0) && (
                    <> • Łączna masa: <b className="text-amber-200">{(selectedDocsObjects.reduce((acc, d) => acc + parseFloat(d.waga_suma || 0), 0) / 1000).toFixed(2)} t</b></>
                  )}
                  {selectedDocsObjects.some(d => parseInt(d.liczba_bebnow || 0, 10) > 0) && (
                    <> • Bębny: <b className="text-purple-200">{selectedDocsObjects.reduce((acc, d) => acc + parseInt(d.liczba_bebnow || 0, 10), 0)} szt.</b></>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsCreateTransportOpen(true)}
                className="bg-white text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold shadow-xs transition-colors flex items-center gap-2"
              >
                <Truck className="w-4 h-4" />
                <span>Utwórz transport własny ({selectedWzNumbers.length})</span>
              </button>

              {activeTab !== 'map' && (
                <button
                  onClick={() => setActiveTab('map')}
                  className="bg-blue-600/70 hover:bg-blue-600 text-white border border-white/20 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Pokaż na mapie</span>
                </button>
              )}

              <button
                onClick={() => setSelectedWzNumbers([])}
                className="text-white/80 hover:text-white px-3 py-2 text-xs font-medium"
              >
                Wyczyść zaznaczenie
              </button>
            </div>
          </div>
        )}

        {/* 4. Zawartość Zakładki 1: Lista dokumentów WZ */}
        {activeTab === 'documents' && (
          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center">
                      <button
                        onClick={handleSelectAllOnPage}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Zaznacz / odznacz stronę"
                      >
                        {documents.length > 0 && documents.every(d => selectedWzNumbers.includes(d.nr_wz)) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-2 font-semibold text-center w-14">Typ</th>
                    <th className="py-3 px-3 font-semibold">Numer WZ</th>
                    <th className="py-3 px-3 font-semibold">Data</th>
                    <th className="py-3 px-3 font-semibold">Magazyn</th>
                    <th className="py-3 px-3 font-semibold">Kontrahent / Miejsce</th>
                    <th className="py-3 px-3 font-semibold">Adres dostawy</th>
                    <th className="py-3 px-3 font-semibold text-right">Waga</th>
                    <th className="py-3 px-2 font-semibold text-center">Bębny</th>
                    <th className="py-3 px-2 font-semibold text-center">Poz.</th>
                    <th className="py-3 px-3 font-semibold text-right">Wartość brutto</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingData ? (
                    <tr>
                      <td colSpan="13" className="py-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        Wczytywanie dokumentów WZ...
                      </td>
                    </tr>
                  ) : documents.length > 0 ? (
                    documents.map((doc) => {
                      const isSelected = selectedWzNumbers.includes(doc.nr_wz);
                      return (
                        <tr
                          key={doc.id || doc.nr_wz}
                          className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(doc.nr_wz)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide uppercase ${
                              doc.typ_dokumentu === 'WZ' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              doc.typ_dokumentu === 'WI' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              doc.typ_dokumentu === 'WZO' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}>
                              {doc.typ_dokumentu || 'WZ'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-gray-900">
                            <button
                              onClick={() => setInspectWzNumber(doc.nr_wz)}
                              className="hover:text-blue-600 hover:underline text-left"
                            >
                              {doc.nr_wz}
                            </button>
                            {doc.dokumenty_powiazane && (
                              <span className="block text-[10px] font-mono text-gray-400 font-normal truncate max-w-[150px]" title={`Powiązane: ${doc.dokumenty_powiazane}`}>
                                ↳ {doc.dokumenty_powiazane}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-gray-600 whitespace-nowrap">
                            {doc.data_wystawienia ? new Date(doc.data_wystawienia).toLocaleDateString('pl-PL') : '-'}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-gray-100 text-gray-800 border border-gray-200">
                                {doc.symbol_magazynu}
                              </span>
                              {doc.rynek && (
                                <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800" title={`Rynek: ${doc.rynek}`}>
                                  {doc.rynek}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <p className="font-semibold text-gray-900 truncate" title={doc.nazwa_kontrahenta}>
                              {doc.nazwa_kontrahenta}
                            </p>
                            {doc.handlowiec && (
                              <p className="text-[10px] text-blue-700 font-medium truncate" title={`Handlowiec: ${doc.handlowiec}`}>
                                👤 {doc.handlowiec}
                              </p>
                            )}
                            {doc.nazwa_miejsca_dostawy && doc.nazwa_miejsca_dostawy !== doc.nazwa_kontrahenta && (
                              <p className="text-[11px] text-gray-500 truncate" title={doc.nazwa_miejsca_dostawy}>
                                {doc.nazwa_miejsca_dostawy}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <div className="flex items-center gap-1 text-gray-700">
                              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate" title={doc.adres_dostawy || doc.extracted_city}>
                                {doc.adres_dostawy || (doc.extracted_city ? `${doc.kod_pocztowy_dostawy || doc.extracted_postal_code || ''} ${doc.extracted_city}` : 'Odbiór własny / brak')}
                              </span>
                            </div>
                            {doc.kod_pocztowy_dostawy && (
                              <span className="text-[10px] text-gray-400 block pl-4 font-mono">
                                Kod: {doc.kod_pocztowy_dostawy}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {parseFloat(doc.waga_suma || 0) > 0 ? (
                              <span className="font-semibold text-gray-900">
                                {parseFloat(doc.waga_suma) >= 1000
                                  ? `${(parseFloat(doc.waga_suma) / 1000).toFixed(2)} t`
                                  : `${parseFloat(doc.waga_suma).toFixed(1)} kg`}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center whitespace-nowrap">
                            {parseInt(doc.liczba_bebnow || 0, 10) > 0 ? (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200"
                                title={`Liczba bębnów kablowych: ${doc.liczba_bebnow}`}
                              >
                                📦 {doc.liczba_bebnow}
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center font-semibold text-gray-700">
                            {doc.pozycje_count}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                            {parseFloat(doc.dok_brutto || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {doc.status === 'przypisany' ? (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-purple-100 text-purple-800">
                                Transport #{doc.transport_id}
                              </span>
                            ) : doc.status === 'zrealizowany' ? (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-emerald-100 text-emerald-800">
                                Zrealizowany
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-blue-100 text-blue-800">
                                Do zaplanowania
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => setInspectWzNumber(doc.nr_wz)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Szczegóły i pozycje towarowe"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="13" className="py-12 text-center text-gray-400">
                        Brak dokumentów spełniających kryteria wyszukiwania.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginacja */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div>
                Pokazano <b>{documents.length}</b> z <b>{pagination.total}</b> dokumentów
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchWzData(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>Strona <b>{pagination.page}</b> z <b>{pagination.totalPages || 1}</b></span>
                <button
                  onClick={() => fetchWzData(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 border border-gray-300 rounded-lg bg-white disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Zawartość Zakładki 2: Mapa logistyczna */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-gray-100 flex items-center justify-between text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>
                  Punkty dostaw na mapie: <b>{mapDocuments.length}</b> dokumentów z lokalizacją
                </span>
              </div>
              <span className="text-gray-400">
                Kliknij punkt na mapie, aby podejrzeć szczegóły i zaznaczyć WZ do trasy.
              </span>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-xs border border-gray-100">
              <WzLeafletMap
                documents={mapDocuments}
                selectedWzNumbers={selectedWzNumbers}
                onToggleSelect={handleToggleSelect}
                className="h-[650px] w-full rounded-xl overflow-hidden"
              />
            </div>
          </div>
        )}

        {/* 6. Zawartość Zakładki 3: Import z ERP */}
        {activeTab === 'import' && (
          <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-8 space-y-8 max-w-4xl mx-auto">
            <div className="text-center max-w-xl mx-auto">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Import dokumentów WZ z ERP</h2>
              <p className="text-xs text-gray-500 mt-1">
                Wgraj najnowszy zrzut CSV wygenerowany z systemu ERP (np. z bieżącego tygodnia).
                System automatycznie zaktualizuje bazę i doda nowe dokumenty bez duplikowania.
              </p>
            </div>

            {/* Strefa Drag & Drop */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-gray-300 hover:border-blue-400 bg-gray-50/50'
              }`}
            >
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-800">Przeciągnij i upuść plik CSV tutaj</p>
              <p className="text-xs text-gray-500 mt-1 mb-4">Obsługiwany separator: średnik (;), kodowanie: Windows-1250 lub UTF-8</p>
              
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-xs inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Wybierz plik z dysku</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>

            {isImporting && (
              <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700" />
                <span>Trwa przetwarzanie i zapisywanie dokumentów do bazy...</span>
              </div>
            )}

            {/* Komunikat po imporcie */}
            {importMessage && (
              <div className={`p-4 rounded-xl border ${
                importMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  {importMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-red-600" />}
                  <span>{importMessage.text}</span>
                </div>
                {importMessage.result && (
                  <div className="text-xs space-y-1 mt-2 text-emerald-700">
                    <p>• Liczba unikalnych WZ: <b>{importMessage.result.totalDocuments}</b></p>
                    <p>• Liczba pozycji towarowych: <b>{importMessage.result.totalItems}</b></p>
                    {importMessage.result.dateRange && (
                      <p>• Zakres dat: <b>{importMessage.result.dateRange.from}</b> do <b>{importMessage.result.dateRange.to}</b></p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Karta informacyjna o automatycznym UPSERT */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-2">
              <span className="font-bold text-gray-800 uppercase tracking-wider text-[11px] block">
                Bezpieczeństwo danych i aktualizacje:
              </span>
              <p>• System używa unikalnych kluczy <code>NR_WZ</code> oraz <code>ID_POZYCJI</code>.</p>
              <p>• Wgrywając zrzut z bieżącego tygodnia, transporty przypisane wcześniej do WZ pozostają nienaruszone.</p>
              <p>• Automatycznie uzupełniane są współrzędne miast docelowych oraz numery kontaktowe wyciągane z uwag.</p>
            </div>
          </div>
        )}

      </div>

      {/* Modal szczegółów pojedynczego WZ */}
      {inspectWzNumber && (
        <WzDetailsModal
          wzNumber={inspectWzNumber}
          onClose={() => setInspectWzNumber(null)}
          onAssignChange={() => {
            fetchWzData(pagination.page);
            fetchMapData();
          }}
        />
      )}

      {/* Modal tworzenia transportu z wybranych WZ */}
      {isCreateTransportOpen && (
        <CreateTransportFromWzModal
          selectedDocs={selectedDocsObjects}
          onClose={() => setIsCreateTransportOpen(false)}
          onSuccess={(transportId) => {
            setSelectedWzNumbers([]);
            fetchWzData(pagination.page);
            fetchMapData();
            router.push('/kalendarz');
          }}
        />
      )}
    </div>
  );
}
