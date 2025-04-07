'use client';
import React, { useState } from 'react';
import Link from 'next/link';

export function SimpleSidebarDemo(props) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className={`h-full transition-all duration-300 bg-blue-800 text-white ${isOpen ? 'w-64' : 'w-16'}`}>
        <div className="flex flex-col h-full px-3 py-8">
          {/* Logo */}
          <div className="flex items-center mb-8">
            <div className="h-5 w-6 bg-white rounded"></div>
            {isOpen && (
              <span className="ml-2 text-white font-medium">TransportSystem</span>
            )}
          </div>

          {/* Toggle button */}
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="absolute left-16 top-20 z-30 w-8 h-8 rounded-full bg-white text-blue-800 flex items-center justify-center shadow"
          >
            {isOpen ? '<' : '>'}
          </button>

          {/* Navigation links */}
          <nav className="flex flex-col gap-2">
            <Link href="/kalendarz" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M8 12h8" />
                <path d="M12 8v8" />
              </svg>
              {isOpen && <span className="ml-2">Kalendarz</span>}
            </Link>
            <Link href="/mapa" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                <line x1="9" x2="9" y1="3" y2="18" />
                <line x1="15" x2="15" y1="6" y2="21" />
              </svg>
              {isOpen && <span className="ml-2">Mapa</span>}
            </Link>
            <Link href="/admin" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {isOpen && <span className="ml-2">Panel Administratora</span>}
            </Link>
            <Link href="/archiwum" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              </svg>
              {isOpen && <span className="ml-2">Archiwum</span>}
            </Link>
            <Link href="/change-password" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {isOpen && <span className="ml-2">Zmień hasło</span>}
            </Link>
            <Link href="/logout" className="flex items-center px-3 py-2 rounded hover:bg-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {isOpen && <span className="ml-2">Wyloguj się</span>}
            </Link>
          </nav>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {props.children}
      </div>
    </div>
  );
}
