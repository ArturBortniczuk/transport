'use client';
import { useState } from 'react';
import { SidebarDemo } from '@/components/SidebarDemo';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isToday } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function SidebarTestPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  // Generowanie dni w kalendarzu
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Poniedziałek jako pierwszy dzień tygodnia
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const content = (
    <div className="flex flex-col h-full w-full overflow-auto">
      <div className="px-6 py-6 flex-1">
        <h1 className="text-3xl font-bold mb-6">Kalendarz Transportów</h1>
        
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded hover:bg-gray-100"
            >
              &lt; Poprzedni
            </button>
            <h2 className="text-xl font-semibold">
              {format(currentMonth, 'LLLL yyyy', { locale: pl })}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded hover:bg-gray-100"
            >
              Następny &gt;
            </button>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'].map(day => (
              <div key={day} className="text-center font-semibold py-2">
                {day}
              </div>
            ))}
            
            {days.map(day => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isToday(day);
              
              return (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    py-3 px-1 border border-gray-200 rounded text-center cursor-pointer
                    ${!isCurrentMonth ? 'text-gray-400' : ''}
                    ${isSelected ? 'bg-blue-100 border-blue-300' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="text-sm">{format(day, 'd')}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Panel z listą transportów - można rozszerzyć */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-xl font-semibold mb-4">
            Transporty na {format(selectedDate, 'd MMMM yyyy', { locale: pl })}
          </h2>
          <div className="text-gray-500">Nie znaleziono transportów na wybrany dzień.</div>
        </div>
      </div>
    </div>
  );

  return (
    <SidebarDemo>
      {content}
    </SidebarDemo>
  );
}
