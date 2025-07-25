// src/app/dashboard/page.js
'use client'
import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { StatsGrid } from '@/components/dashboard/DashboardStats'
import { 
  TodayTransportsWidget,
  WarehouseStatusWidget,
  RecentRatingsWidget,
  FleetActivityWidget,
  QuickActionsWidget
} from '@/components/dashboard/DashboardWidgets'
import {
  MonthlyTransportChart,
  WeeklyTransportChart,
  SpeditionCostChart,
  TransportTypePieChart,
  ActiveSpeditionsWidget
} from '@/components/dashboard/DashboardCharts'

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard')
      const data = await response.json()
      
      if (data.success) {
        setDashboardData(data.data)
        setUserRole(data.userRole)
      } else {
        setError(data.error)
      }
    } catch (error) {
      console.error('Błąd pobierania danych dashboard:', error)
      setError('Wystąpił błąd podczas pobierania danych')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1,2].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Błąd ładowania dashboardu</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Zarządzania</h1>
          <p className="text-gray-600 mt-2">
            Przegląd najważniejszych informacji o transporcie i flotie
          </p>
        </div>

        {/* Główne wskaźniki KPI */}
        <div className="mb-8">
          <StatsGrid data={dashboardData} />
        </div>

        {/* Główny content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <TodayTransportsWidget transports={dashboardData?.todayTransports} />
          <WarehouseStatusWidget warehouses={dashboardData?.warehouses} />
        </div>

        {/* Dodatkowe sekcje */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <RecentRatingsWidget ratings={dashboardData?.recentRatings} />
          <FleetActivityWidget 
            fleetsInUse={dashboardData?.fleetsInUse} 
            totalFleets={dashboardData?.totalFleets} 
          />
          <ActiveSpeditionsWidget 
            activeSpeditions={dashboardData?.activeSpeditions}
            speditionCosts={dashboardData?.speditionCosts}
          />
        </div>

        {/* Sekcja wykresów i analiz */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Analizy i Wykresy</h2>
          
          {/* Pierwszy rząd wykresów */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <MonthlyTransportChart data={dashboardData?.monthlyChartData} />
            <TransportTypePieChart data={dashboardData?.transportTypes} />
          </div>

          {/* Drugi rząd wykresów */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <WeeklyTransportChart data={dashboardData?.weeklyChartData} />
            <SpeditionCostChart 
              data={dashboardData?.costChartData} 
              costData={dashboardData?.speditionCosts}
            />
          </div>
        </div>

        {/* Szybkie akcje na końcu */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-start-3">
            <QuickActionsWidget />
          </div>
        </div>
      </div>
    </div>
  )
}
