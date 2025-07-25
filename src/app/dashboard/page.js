// src/app/dashboard/page.js
'use client'
import React, { useState, useEffect } from 'react'
import { 
  Truck, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  MapPin,
  Star,
  Calendar,
  FileText,
  Building,
  Activity
} from 'lucide-react'

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Aktywne Transporty"
            value={dashboardData?.activeTransports || 0}
            icon={<Truck className="w-8 h-8 text-blue-600" />}
            color="blue"
            description="Transporty w trakcie"
          />
          
          <StatCard
            title="Oczekujące Wnioski"
            value={dashboardData?.pendingRequests || 0}
            icon={<Clock className="w-8 h-8 text-yellow-600" />}
            color="yellow"
            description="Wymagają zatwierdzenia"
          />
          
          <StatCard
            title="Kierowcy na Trasach"
            value={dashboardData?.activeDrivers || 0}
            icon={<Users className="w-8 h-8 text-green-600" />}
            color="green"
            description="Aktywni kierowcy"
          />
          
          <StatCard
            title="Średnia Ocena"
            value={dashboardData?.averageRating ? `${dashboardData.averageRating}%` : 'N/A'}
            icon={<Star className="w-8 h-8 text-purple-600" />}
            color="purple"
            description="Oceny transportów"
          />
        </div>

        {/* Główny content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Dzisiejsze transporty */}
          <DashboardWidget
            title="Dzisiejsze Transporty"
            icon={<Calendar className="w-5 h-5" />}
          >
            <div className="space-y-3">
              {dashboardData?.todayTransports?.length > 0 ? (
                dashboardData.todayTransports.slice(0, 5).map((transport, index) => (
                  <TransportItem key={index} transport={transport} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Brak transportów na dzisiaj</p>
              )}
            </div>
          </DashboardWidget>

          {/* Status magazynów */}
          <DashboardWidget
            title="Status Magazynów"
            icon={<Building className="w-5 h-5" />}
          >
            <div className="space-y-4">
              <WarehouseStatus 
                name="Białystok" 
                activeTransports={dashboardData?.warehouses?.bialystok || 0}
                status="operational"
              />
              <WarehouseStatus 
                name="Zielonka" 
                activeTransports={dashboardData?.warehouses?.zielonka || 0}
                status="operational"
              />
            </div>
          </DashboardWidget>
        </div>

        {/* Dodatkowe sekcje */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ostatnie oceny */}
          <DashboardWidget
            title="Ostatnie Oceny"
            icon={<Star className="w-5 h-5" />}
          >
            <div className="space-y-3">
              {dashboardData?.recentRatings?.length > 0 ? (
                dashboardData.recentRatings.slice(0, 3).map((rating, index) => (
                  <RatingItem key={index} rating={rating} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Brak ostatnich ocen</p>
              )}
            </div>
          </DashboardWidget>

          {/* Aktywność floty */}
          <DashboardWidget
            title="Aktywność Floty"
            icon={<Activity className="w-5 h-5" />}
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pojazdy w użyciu</span>
                <span className="font-semibold">{dashboardData?.fleetsInUse || 0}/{dashboardData?.totalFleets || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{width: `${(dashboardData?.fleetsInUse / dashboardData?.totalFleets) * 100 || 0}%`}}
                ></div>
              </div>
              <div className="text-xs text-gray-500">
                Wykorzystanie floty: {Math.round((dashboardData?.fleetsInUse / dashboardData?.totalFleets) * 100 || 0)}%
              </div>
            </div>
          </DashboardWidget>

          {/* Szybkie akcje */}
          <DashboardWidget
            title="Szybkie Akcje"
            icon={<FileText className="w-5 h-5" />}
          >
            <div className="space-y-2">
              <QuickActionButton 
                href="/kalendarz" 
                text="Nowy Transport" 
                icon={<Truck className="w-4 h-4" />}
                color="blue"
              />
              <QuickActionButton 
                href="/spedycja" 
                text="Panel Spedycji" 
                icon={<FileText className="w-4 h-4" />}
                color="green"
              />
              <QuickActionButton 
                href="/archiwum" 
                text="Archiwum" 
                icon={<Clock className="w-4 h-4" />}
                color="gray"
              />
            </div>
          </DashboardWidget>
        </div>
      </div>
    </div>
  )
}

// Komponenty pomocnicze
function StatCard({ title, value, icon, color, description }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200', 
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200'
  }

  return (
    <div className={`p-6 rounded-lg border ${colorClasses[color]} bg-white shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className="flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )
}

function DashboardWidget({ title, icon, children }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-gray-900 ml-2">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function TransportItem({ transport }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="font-medium text-gray-900">
          {transport.source} → {transport.destination}
        </div>
        <div className="text-sm text-gray-600">
          {transport.driver} • MPK: {transport.mpk || 'Brak'}
        </div>
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
        transport.status === 'completed' ? 'bg-green-100 text-green-800' :
        transport.status === 'active' ? 'bg-blue-100 text-blue-800' :
        'bg-yellow-100 text-yellow-800'
      }`}>
        {transport.status === 'completed' ? 'Ukończony' :
         transport.status === 'active' ? 'Aktywny' : 'Oczekujący'}
      </div>
    </div>
  )
}

function WarehouseStatus({ name, activeTransports, status }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-3 ${
          status === 'operational' ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">{activeTransports} aktywnych transportów</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900">
          {status === 'operational' ? 'Operacyjny' : 'Problem'}
        </div>
      </div>
    </div>
  )
}

function RatingItem({ rating }) {
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
      <div className="flex-1">
        <div className="text-sm font-medium text-gray-900">{rating.transport}</div>
        <div className="text-xs text-gray-600">{rating.date}</div>
      </div>
      <div className="flex items-center">
        <Star className="w-4 h-4 text-yellow-500 mr-1" />
        <span className="text-sm font-medium">{rating.score}%</span>
      </div>
    </div>
  )
}

function QuickActionButton({ href, text, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white', 
    gray: 'bg-gray-600 hover:bg-gray-700 text-white'
  }

  return (
    <a 
      href={href}
      className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors ${colorClasses[color]}`}
    >
      {icon}
      <span className="ml-2 text-sm font-medium">{text}</span>
    </a>
  )
}
