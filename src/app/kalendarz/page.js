// src/app/kalendarz/page.js
'use client'
import { useEffect } from 'react'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns'
import { pl } from 'date-fns/locale'
import { DragDropContext } from '@hello-pangea/dnd'
import CalendarGrid from './components/CalendarGrid'
import SimpleCalendarGrid from './components/SimpleCalendarGrid'
import TransportForm from './components/TransportForm'
import FilterPanel from './components/FilterPanel'
import TransportsList from './components/TransportsList'
import PackagingsList from './components/PackagingsList'
import ConfirmModal from './components/ConfirmModal'
import useKalendarzState from './hooks/useKalendarzState'
import useTransportOperations from './hooks/useTransportOperations'
import useDragAndDrop from './hooks/useDragAndDrop'

export default function KalendarzPage() {
  // Pobierz stan z custom hook
  const kalendarState = useKalendarzState();
  
  const {
    currentMonth, setCurrentMonth,
    selectedDate, setSelectedDate,
    transporty, setTransporty,
    userRole,
    edytowanyTransport, setEdytowanyTransport,
    przenoszonyTransport, setPrzenoszonyTransport,
    nowaData, setNowaData,
    userPermissions,
    nowyTransport, setNowyTransport,
    filtryAktywne, setFiltryAktywne,
    isLoading, setIsLoading,
    error,
    confirmModal, setConfirmModal
  } = kalendarState;
  
  // Operacje na transportach
  const transportOperations = useTransportOperations(
    kalendarState,
    {
      setTransporty,
      setNowyTransport,
      setEdytowanyTransport,
      setIsLoading,
      setError: kalendarState.setError,
      setPrzenoszonyTransport,
      setNowaData
    }
  );
  
  const {
    fetchTransports,
    fetchPackagings,
    handleSubmit,
    handleUpdateTransport,
    handleZakonczTransport,
    handleEditTransport,
    handlePrzeniesDoPrzenoszenia,
    handlePrzenoszenieTransportu,
    handlePackagingDrop,
    handleTransportMove
  } = transportOperations;
  
  // Obsługa drag & drop
  const dragAndDropHandlers = useDragAndDrop({
    handlePackagingDrop,
    handleTransportMove
  });
  
  const {
    handleDragStart,
    handleDragUpdate,
    handleDragEnd
  } = dragAndDropHandlers;
  
  // Pobierz dane przy inicjalizacji
  useEffect(() => {
    fetchTransports();
    fetchPackagings();
  }, []);
  
  // Funkcja do wybrania daty
  const handleDateClick = (date) => {
    setSelectedDate(date);
  };
  
  // Obsługa potwierdzenia przeniesienia
  const handleConfirmMove = () => {
    const { transport, newDate } = confirmModal;
    handlePrzenoszenieTransportu({
      id: transport.id,
      newDate: newDate
    });
    setConfirmModal({ isOpen: false, transport: null, newDate: null });
  };
  
  // Stwórz tablicę dni do wyświetlenia
  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });
  
  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Ładowanie...</div>
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Kalendarz Transportów - {format(currentMonth, 'LLLL yyyy', { locale: pl })}
        </h1>
        <div className="flex gap-4">
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Poprzedni miesiąc
          </button>
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Następny miesiąc
          </button>
          <a 
            href="/archiwum" 
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50"
          >
            Archiwum transportów
          </a>
        </div>
      </div>

      <FilterPanel 
        filtryAktywne={filtryAktywne} 
        setFiltryAktywne={setFiltryAktywne}
      />

      {/* Wspólny DragDropContext dla opakowań i kalendarza */}
      <DragDropContext 
        onDragStart={handleDragStart}
        onDragUpdate={handleDragUpdate}
        onDragEnd={handleDragEnd}
      >
        <PackagingsList />
        
        <SimpleCalendarGrid 
          daysInMonth={daysInMonth}
          onDateSelect={handleDateClick}
          currentMonth={currentMonth}
          transporty={transporty}
          onTransportMove={handleTransportMove}
          filtryAktywne={filtryAktywne}
        />
      </DragDropContext>

      <TransportsList
        selectedDate={selectedDate}
        transporty={transporty}
        userRole={userRole}
        onZakonczTransport={handleZakonczTransport}
        onEditTransport={handleEditTransport}
        onPrzeniesDoPrzenoszenia={handlePrzeniesDoPrzenoszenia}
        filtryAktywne={filtryAktywne}
      />

      {selectedDate && (
        <TransportForm
          selectedDate={selectedDate}
          nowyTransport={nowyTransport}
          handleInputChange={(e) => {
            const { name, value } = e.target;
            setNowyTransport(prev => ({
              ...prev,
              [name]: value
            }));
          }}
          handleSubmit={handleSubmit}
          edytowanyTransport={edytowanyTransport}
          handleUpdateTransport={handleUpdateTransport}
          setEdytowanyTransport={setEdytowanyTransport}
          setNowyTransport={setNowyTransport}
          userPermissions={userPermissions}
          transporty={transporty}
        />
      )}
      
      {przenoszonyTransport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Przenieś transport
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 mb-4">
                  Wybierz nową datę dla transportu do {przenoszonyTransport.miasto}
                </p>
                <input
                  type="datetime-local"
                  value={nowaData}
                  onChange={(e) => setNowaData(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-center gap-4 px-4 py-3">
                <button
                  onClick={() => handlePrzenoszenieTransportu({
                    id: przenoszonyTransport.id,
                    newDate: nowaData
                  })}
                  className="px-4 py-2 bg-blue-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Przenieś
                </button>
                <button
                  onClick={() => {
                    setPrzenoszonyTransport(null)
                    setNowaData('')
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal potwierdzenia przeniesienia transportu */}
      {confirmModal.isOpen && confirmModal.transport && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, transport: null, newDate: null })}
          onConfirm={handleConfirmMove}
          title="Przenieś transport"
          message={`Czy na pewno chcesz przenieść transport do ${confirmModal.transport.miasto} na dzień ${format(new Date(confirmModal.newDate), 'd MMMM yyyy', { locale: pl })}?`}
        />
      )}
    </div>
  )
}
