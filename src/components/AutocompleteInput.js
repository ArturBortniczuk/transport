// src/components/AutocompleteInput.js
'use client'
import { useState, useEffect, useRef } from 'react'

export default function AutocompleteInput({ 
  value, 
  onChange, 
  options, 
  placeholder,
  onSelectOption
}) {
  const [inputValue, setInputValue] = useState(value || '')
  const [filteredOptions, setFilteredOptions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  useEffect(() => {
    // Zamknij dropdown gdy klikniemy poza komponentem
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [wrapperRef])

  const handleInputChange = (e) => {
    const value = e.target.value
    setInputValue(value)
    onChange(value)
    
    // Filtruj opcje na podstawie wpisanego tekstu
    if (value.trim() === '') {
      setFilteredOptions([])
    } else {
      const filtered = options.filter(option => 
        option.label.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredOptions(filtered)
    }
    
    setIsOpen(true)
  }

  const handleSelectOption = (option) => {
    setInputValue(option.label)
    onChange(option.label)
    onSelectOption(option)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto focus:outline-none sm:text-sm">
          {filteredOptions.map((option, index) => (
            <li
              key={index}
              onClick={() => handleSelectOption(option)}
              className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-100"
            >
              <div className="flex justify-between">
                <span className="block truncate font-medium">{option.label}</span>
                {option.mpk && (
                  <span className="text-gray-500 pr-4">MPK: {option.mpk}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}