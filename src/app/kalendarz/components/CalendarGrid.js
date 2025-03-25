'use client'
import { format, getDate, isSameDay } from 'date-fns'
import { pl } from 'date-fns/locale'
import { KIEROWCY, getKierowcaColor } from '../constants'
import { useState, useEffect } from 'react'

export default function CalendarGrid({ 
  daysInMonth, 
  selectedDate, 
  handleDateClick, 
  transporty,
  filtryAktywne,
  currentMonth 
}) {
  // Używamy stanu lokalnego, aby obsłużyć kliknięcie zamiast używać callbacka z props
  const [localSelectedDate, setLocalSelectedDate] = useState(null);
  
  // Synchronizujemy nasz lokalny stan z props, gdy się zmienia
  useEffect(() => {
    setLocalSelectedDate(selectedDate);
  }, [selectedDate]);
  
  // Obsługujemy kliknięcie lokalnie
  const onDateClick = (day) => {
    setLocalSelectedDate(day);
    // Wywołujemy funkcję z props dopiero po aktualizacji stanu lokalnego
    setTimeout(() => {
      if (handleDateClick) {
        handleDateClick(day);
      }
    }, 0);
  };

  const filtrujTransporty = (transporty) => {
    if (!transporty) return [];
    
    return transporty.filter(transport => {
      const pasujeMagazyn = !filtryAktywne.magazyn || transport.zrodlo === filtryAktywne.magazyn;
      const pasujeKierowca = !filtryAktywne.kierowca || transport.kierowcaId === filtryAktywne.kierowca;
      const pasujeRynek = !filtryAktywne.rynek || transport.rynek === filtryAktywne.rynek;
      
      return (transport.status === 'aktywny' || transport.status === 'active') && 
             pasujeMagazyn && pasujeKierowca && pasujeRynek;
    });
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'].map((day) => (
        <div key={day} className="text-center font-semibold p-2">
          {day}
        </div>
      ))}

      {daysInMonth.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const isCurrentMonth = format(day, 'M') === format(currentMonth, 'M');
        const aktywneTransporty = transporty[dateKey]?.filter(t => 
          t.status === 'aktywny' || t.status === 'active'
        ) || [];
        const filtrowaneTransporty = filtrujTransporty(aktywneTransporty);
        const isSelected = localSelectedDate && isSameDay(day, localSelectedDate);

        return (
          <div
            key={dateKey}
            onClick={() => onDateClick(day)}
            className={`
              p-4 border rounded-lg cursor-pointer transition-all
              ${isSelected ? 'ring-2 ring-blue-500' : ''}
              ${!isCurrentMonth ? 'opacity-50 bg-gray-50' : 'hover:shadow-md'}
              min-h-[120px] relative
            `}
          >
            <div className={`font-medium ${!isCurrentMonth ? 'text-gray-400' : ''}`}>
              <div className="text-xs text-gray-500 mb-1">
                {format(day, 'EEEEEE', { locale: pl })}
              </div>
              {getDate(day)}
            </div>
            {filtrowaneTransporty.length > 0 && (
              <div className="mt-1 space-y-1">
                {filtrowaneTransporty.map(transport => (
                  <div 
                    key={transport.id} 
                    className={`text-xs px-2 py-1 rounded-full ${getKierowcaColor(transport.kierowcaId)}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{transport.miasto}</span>
                      <span className="text-xs opacity-75">
                        {KIEROWCY.find(k => k.id === parseInt(transport.kierowcaId))?.tabliceRej}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}