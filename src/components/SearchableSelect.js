'use client'
import React, { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ options, value, onChange, placeholder, disabled, name }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Zsynchronizuj lokalny searchTerm z wybraną wartością
  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Obsługa kliknięcia poza komponentem zamyka listę
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        // Jeśli użytkownik wpisał coś, ale nie wybrał z listy, możemy to zaakceptować jako custom value, 
        // lub zresetować do wybranej wartości. W tym przypadku zachowujemy, co wpisał (Custom value)
        if (searchTerm !== value) {
          onChange({ target: { name, value: searchTerm } });
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef, searchTerm, value, onChange, name]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        name={name}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
          onChange({ target: { name, value: e.target.value } });
        }}
        onClick={() => setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
      />
      
      {/* Ikonka strzałki w dół */}
      <div 
        className="absolute inset-y-0 right-0 flex items-center px-2 cursor-pointer"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && !disabled && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={index}
                onClick={() => {
                  setSearchTerm(option);
                  setIsOpen(false);
                  onChange({ target: { name, value: option } });
                }}
                className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
              >
                {option}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-gray-500 text-sm">Brak wyników (wpisz własną wartość)</li>
          )}
        </ul>
      )}
    </div>
  );
}
