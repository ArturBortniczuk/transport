'use client'
import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, 
  Layers, 
  Boxes,
  Truck,
  LayoutGrid,
  ExternalLink
} from 'lucide-react';

const APPS = [
  {
    id: 'opakowania',
    name: 'Strona opakowaniowa',
    url: 'https://www.opakowania.grupaeltron.pl',
    icon: Package,
    iconBg: 'bg-blue-100 text-blue-600',
    isCurrent: false
  },
  {
    id: 'rury',
    name: 'Strona Rurowa',
    url: 'https://www.rury.grupaeltron.pl',
    icon: Layers,
    iconBg: 'bg-cyan-100 text-cyan-600',
    isCurrent: false
  },
  {
    id: 'transport',
    name: 'Strona transportowa',
    url: 'https://www.transport.grupaeltron.pl',
    icon: Truck,
    iconBg: 'bg-emerald-100 text-emerald-600',
    isCurrent: true
  },
  {
    id: 'portal',
    name: 'Pulpit narzędzi',
    url: 'https://www.narzedzia.grupaeltron.pl',
    icon: Boxes,
    iconBg: 'bg-amber-100 text-amber-600',
    isCurrent: false
  }
];

export const AppSwitcher = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Przełącz aplikację"
        className={`p-2 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-emerald-50 border-emerald-300 text-emerald-600 shadow-sm'
            : 'text-gray-600 border-gray-200 hover:bg-gray-100'
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-50">
          <div className="space-y-1">
            {APPS.map((app) => {
              const Icon = app.icon;
              return (
                <a
                  key={app.id}
                  href={app.isCurrent ? '#' : app.url}
                  onClick={() => {
                    if (app.isCurrent) setIsOpen(false);
                  }}
                  target={app.isCurrent ? '_self' : '_blank'}
                  rel="noopener noreferrer"
                  className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between group ${
                    app.isCurrent
                      ? 'bg-emerald-50/80 border-emerald-200'
                      : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${app.iconBg} group-hover:scale-105 transition-transform`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-xs text-gray-800 group-hover:text-emerald-600 transition-colors truncate">
                      {app.name}
                    </span>
                  </div>

                  {app.isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" title="Aktywna" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppSwitcher;
