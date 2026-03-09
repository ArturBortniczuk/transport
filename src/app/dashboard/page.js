// src/app/dashboard/page.js
'use client'
import React, { useState, useEffect } from 'react'
import {
  Truck,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Star,
  Calendar,
  FileText,
  Building,
  Activity,
  MapPin,
  User,
  ExternalLink,
  BarChart3,
  PieChart,
  DollarSign
} from 'lucide-react'

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userRole, setUserRole] = useState('')
  const [userName, setUserName] = useState('')

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
        setUserName(data.userName)
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
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[1, 2].map(i => (
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

  const isFiltered = dashboardData?.userFiltered;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isFiltered ? `Twój Dashboard - ${userName}` : 'Dashboard Zarządzania'}
            </h1>
            <p className="text-gray-600 mt-2">
              {isFiltered
                ? 'Przegląd transportów i kosztów spedycji przypisanych do Twojego rynku'
                : 'Przegląd najważniejszych informacji o transporcie i flotie'}
            </p>
          </div>
          {isFiltered && (
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
              Dane filtrowane (Twój rynek / MPK)
            </div>
          )}
        </div>

        {/* Główne wskaźniki KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title={isFiltered ? "Twoje Aktywne Transporty" : "Aktywne Transporty"}
            value={(dashboardData?.activeTransports || 0) + (dashboardData?.activeSpeditions || 0)}
            icon={<Truck className="w-8 h-8" />}
            color="blue"
            description={`Własne: ${dashboardData?.activeTransports || 0} | Spedycyjne: ${dashboardData?.activeSpeditions || 0}`}
          />

          <StatCard
            title={isFiltered ? "Twoje Wnioski Oczekujące" : "Oczekujące Wnioski"}
            value={dashboardData?.pendingRequests || 0}
            icon={dashboardData?.pendingRequests > 0 ? <AlertCircle className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
            color={dashboardData?.pendingRequests > 0 ? "red" : "yellow"}
            description={isFiltered ? "Wnioski do rozpatrzenia" : "Wymagają zatwierdzenia"}
          />

          {!isFiltered && (
            <StatCard
              title="Kierowcy na Trasach"
              value={dashboardData?.activeDrivers || 0}
              icon={<Users className="w-8 h-8" />}
              color="green"
              description="Aktywni kierowcy"
            />
          )}

          <StatCard
            title={isFiltered ? "Koszty Twojej Spedycji" : "Koszty Spedycji"}
            value={dashboardData?.speditionCosts?.thisMonth ? `${dashboardData.speditionCosts.thisMonth.toLocaleString()} zł` : '0 zł'}
            icon={<DollarSign className="w-8 h-8" />}
            color="purple"
            description="W tym miesiącu"
            trend={dashboardData?.speditionCosts?.thisMonth > dashboardData?.speditionCosts?.lastMonth ? 'up' :
              dashboardData?.speditionCosts?.thisMonth < dashboardData?.speditionCosts?.lastMonth ? 'down' : null}
            trendValue={dashboardData?.speditionCosts?.lastMonth ?
              `${Math.abs(Math.round(((dashboardData.speditionCosts.thisMonth - dashboardData.speditionCosts.lastMonth) / dashboardData.speditionCosts.lastMonth) * 100))}%` :
              null}
          />
        </div>

        {/* Główny content grid */}
        <div className={`grid grid-cols-1 gap-6 mb-8 ${isFiltered ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
          <TodayTransportsWidget transports={dashboardData?.todayTransports} isFiltered={isFiltered} />
          {!isFiltered && (
            <WarehouseStatusWidget warehouses={dashboardData?.warehouses} />
          )}
        </div>

        {/* Dodatkowe sekcje */}
        <div className={`grid grid-cols-1 gap-6 mb-8 ${isFiltered ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          <RecentRatingsWidget ratings={dashboardData?.recentRatings} />
          {!isFiltered && (
            <FleetActivityWidget
              fleetsInUse={dashboardData?.fleetsInUse}
              totalFleets={dashboardData?.totalFleets}
            />
          )}
          <ActiveSpeditionsWidget
            activeSpeditions={dashboardData?.activeSpeditions}
            speditionCosts={dashboardData?.speditionCosts}
            isFiltered={isFiltered}
          />
        </div>

        {isFiltered && (
          <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MyTransportsChart data={dashboardData} />
              <RecentSpeditionsFeedWidget speditions={dashboardData?.recentSpeditions} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CostAnalysisWidget costData={dashboardData?.speditionCosts} isFiltered={isFiltered} />
              <CostChartWidget chartData={dashboardData?.costChartData} />
            </div>
          </div>
        )}

        {/* Sekcja analiz bez wykresów (tylko dla niefiltrowanych) */}
        {!isFiltered && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Analizy i Statystyki</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <TransportAnalysisWidget data={dashboardData} isFiltered={isFiltered} />
              <CostAnalysisWidget costData={dashboardData?.speditionCosts} isFiltered={isFiltered} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <MonthlyStatsWidget data={dashboardData?.costChartData} isFiltered={isFiltered} />
              <TransportTypesWidget data={dashboardData?.transportTypes} isFiltered={isFiltered} />
              <QuickActionsWidget />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Komponenty pomocnicze
function StatCard({ title, value, icon, color, description, trend, trendValue }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600'
  }

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return null;
  }

  return (
    <div className={`p-6 rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow ${colorClasses[color]?.includes('border') ? colorClasses[color] : 'border-gray-200'}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-center mt-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && trendValue && (
              <div className="flex items-center ml-3">
                {getTrendIcon()}
                <span className={`text-sm ml-1 ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {trendValue}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className={`flex-shrink-0 ${colorClasses[color]?.includes('text') ? colorClasses[color] : 'text-gray-400'}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function DashboardWidget({ title, icon, children, className = "" }) {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col h-full ${className}`}>
      <div className="flex items-center mb-4 flex-shrink-0">
        <div className="text-gray-600">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 ml-2">{title}</h3>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        {children}
      </div>
    </div>
  )
}

function TodayTransportsWidget({ transports, isFiltered }) {
  return (
    <DashboardWidget
      title={isFiltered ? "Twoje Dzisiejsze Transporty" : "Dzisiejsze Transporty"}
      icon={<Calendar className="w-5 h-5" />}
    >
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {transports?.length > 0 ? (
          transports.map((transport, index) => (
            <TransportItem key={index} transport={transport} />
          ))
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {isFiltered ? 'Brak Twoich transportów na dzisiaj' : 'Brak transportów na dzisiaj'}
            </p>
            <a
              href="/kalendarz"
              className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
            >
              Dodaj transport →
            </a>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function WarehouseStatusWidget({ warehouses }) {
  return (
    <DashboardWidget
      title="Status Magazynów"
      icon={<Building className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <WarehouseStatus
          name="Białystok"
          activeTransports={warehouses?.bialystok || 0}
          status="operational"
        />
        <WarehouseStatus
          name="Zielonka"
          activeTransports={warehouses?.zielonka || 0}
          status="operational"
        />

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Łącznie aktywnych:</span>
            <span className="font-semibold text-gray-900">
              {(warehouses?.bialystok || 0) + (warehouses?.zielonka || 0)}
            </span>
          </div>
        </div>
      </div>
    </DashboardWidget>
  )
}

function RecentRatingsWidget({ ratings }) {
  return (
    <DashboardWidget
      title="Ostatnie Oceny"
      icon={<Star className="w-5 h-5" />}
    >
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {ratings?.length > 0 ? (
          ratings.map((rating, index) => (
            <RatingItem key={index} rating={rating} />
          ))
        ) : (
          <div className="text-center py-6">
            <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Brak ostatnich ocen</p>
          </div>
        )}
      </div>

      {ratings?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <a
            href="/archiwum"
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
          >
            Zobacz wszystkie oceny
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      )}
    </DashboardWidget>
  )
}

function FleetActivityWidget({ fleetsInUse, totalFleets }) {
  const usagePercentage = totalFleets > 0 ? Math.round((fleetsInUse / totalFleets) * 100) : 0;

  return (
    <DashboardWidget
      title="Aktywność Floty"
      icon={<Activity className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Pojazdy w użyciu</span>
          <span className="font-semibold text-lg">{fleetsInUse}/{totalFleets}</span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${usagePercentage >= 80 ? 'bg-red-500' :
              usagePercentage >= 60 ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
            style={{ width: `${usagePercentage}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Wykorzystanie floty</span>
          <span className={`font-medium ${usagePercentage >= 80 ? 'text-red-600' :
            usagePercentage >= 60 ? 'text-yellow-600' :
              'text-green-600'
            }`}>
            {usagePercentage}%
          </span>
        </div>

        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <div className="flex justify-between mb-1">
              <span>Dostępne pojazdy:</span>
              <span className="font-medium">{totalFleets - fleetsInUse}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-medium ${usagePercentage >= 90 ? 'text-red-600' :
                usagePercentage >= 70 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                {usagePercentage >= 90 ? 'Krytyczne' :
                  usagePercentage >= 70 ? 'Wysokie' :
                    'Normalne'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardWidget>
  )
}

function ActiveSpeditionsWidget({ activeSpeditions, speditionCosts, isFiltered }) {
  return (
    <DashboardWidget
      title={isFiltered ? "Twoje Aktywne Spedycje" : "Aktywne Spedycje"}
      icon={<FileText className="w-5 h-5" />}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col justify-center items-center text-center p-6 border-b border-gray-100 min-h-[160px]">
          <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-blue-600 border-b-2 border-transparent">{activeSpeditions || 0}</span>
          </div>
          <p className="text-gray-600 font-medium">Spedycje w realizacji</p>
          <p className="text-sm text-gray-500 mt-1">
            {isFiltered ? "Aktywne zlecenia dla Twojego rynku" : "Wszystkie aktywne zlecenia spedycyjne w systemie"}
          </p>
        </div>

        {speditionCosts && (
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Koszty w tym miesiącu</div>
              <div className="font-bold text-lg text-green-700">
                {speditionCosts.thisMonth.toLocaleString()} zł
              </div>
              {speditionCosts.lastMonth > 0 && (
                <div className="text-xs text-gray-500">
                  {speditionCosts.thisMonth > speditionCosts.lastMonth ? '↗' : '↘'}
                  {' '}vs. {speditionCosts.lastMonth.toLocaleString()} zł
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">Koszty w tym tygodniu</div>
              <div className="font-bold text-lg text-blue-700">
                {speditionCosts.thisWeek.toLocaleString()} zł
              </div>
              {speditionCosts.lastWeek > 0 && (
                <div className="text-xs text-gray-500">
                  {speditionCosts.thisWeek > speditionCosts.lastWeek ? '↗' : '↘'}
                  {' '}vs. {speditionCosts.lastWeek.toLocaleString()} zł
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function MyTransportsChart({ data }) {
  const ownCount = data?.transportTypes?.own?.thisMonth || 0;
  const spedCount = data?.transportTypes?.spedition?.thisMonth || 0;
  const total = ownCount + spedCount;

  const ownPercent = total > 0 ? Math.round((ownCount / total) * 100) : 0;
  const spedPercent = total > 0 ? Math.round((spedCount / total) * 100) : 0;

  return (
    <DashboardWidget
      title="Podział Twoich Transportów"
      icon={<PieChart className="w-5 h-5 text-indigo-600" />}
      className="bg-gradient-to-br from-white to-blue-50/50"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center text-sm mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
            <span className="text-gray-700 font-medium">Transport Własny</span>
          </div>
          <span className="font-bold text-blue-700 text-xl">{ownCount}</span>
        </div>
        <div className="w-full bg-white/60 shadow-inner rounded-full h-8 overflow-hidden flex border border-gray-100" title={`Własny: ${ownPercent}%`}>
          <div
            className="bg-gradient-to-r from-blue-400 to-blue-600 h-full flex items-center justify-center text-xs text-white font-bold transition-all duration-1000 shadow-sm"
            style={{ width: `${ownPercent}%` }}
          >
            {ownPercent > 10 ? `${ownPercent}%` : ''}
          </div>
        </div>

        <div className="flex justify-between items-center text-sm mb-2 mt-8">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500 shadow-sm"></div>
            <span className="text-gray-700 font-medium">Transport Spedycyjny</span>
          </div>
          <span className="font-bold text-purple-700 text-xl">{spedCount}</span>
        </div>
        <div className="w-full bg-white/60 shadow-inner rounded-full h-8 overflow-hidden flex border border-gray-100" title={`Spedycyjny: ${spedPercent}%`}>
          <div
            className="bg-gradient-to-r from-purple-400 to-purple-600 h-full flex items-center justify-center text-xs text-white font-bold transition-all duration-1000 shadow-sm"
            style={{ width: `${spedPercent}%` }}
          >
            {spedPercent > 10 ? `${spedPercent}%` : ''}
          </div>
        </div>

        {total === 0 && (
          <div className="text-center text-sm text-gray-400 italic mt-6 bg-white/50 py-3 rounded-lg">
            Brak transportów w tym miesiącu.
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function RecentSpeditionsFeedWidget({ speditions }) {
  return (
    <DashboardWidget
      title="Ostatnie Koszty Spedycji"
      icon={<DollarSign className="w-5 h-5 text-green-600" />}
      className="bg-gradient-to-br from-white to-green-50/30"
    >
      <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
        {speditions && speditions.length > 0 ? (
          speditions.map((sped, index) => (
            <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-medium mb-1">
                  {new Date(sped.date).toLocaleDateString('pl-PL')} • {sped.spedition_number}
                </span>
                <span className="text-sm font-semibold text-gray-800">
                  Kierunek: <span className="text-indigo-600">{sped.destination}</span>
                </span>
              </div>
              <div className="flex items-center bg-green-50 px-3 py-1.5 rounded-md border border-green-100">
                <span className="font-bold text-green-700">
                  {sped.price !== null ? `${sped.price.toLocaleString()} zł` : 'Wycena'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Brak historii kosztów spedycji.</p>
            <p className="text-xs text-gray-400 mt-1">Gdy dodasz zlecenia, pojawią się tutaj.</p>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function TransportAnalysisWidget({ data, isFiltered }) {
  return (
    <DashboardWidget
      title={isFiltered ? "Analiza Twoich Transportów" : "Ogólna Analiza Transportów"}
      icon={<Activity className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Transport własny (miesiąc)</span>
          <span className="font-semibold text-blue-600">{data?.transportTypes?.own?.thisMonth || 0}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Transport spedycyjny (miesiąc)</span>
          <span className="font-semibold text-red-600">{data?.transportTypes?.spedition?.thisMonth || 0}</span>
        </div>

        {/* Prostky wykres słupkowy CSS */}
        <div className="mt-4">
          <div className="text-xs text-gray-500 mb-2">Porównanie miesięczne</div>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="w-16 text-xs text-gray-600 mr-2">Własny</div>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                  style={{
                    width: `${data?.transportTypes ? (data.transportTypes.own.thisMonth / Math.max(data.transportTypes.own.thisMonth + data.transportTypes.spedition.thisMonth, 1)) * 100 : 0}%`
                  }}
                ></div>
              </div>
              <div className="w-8 text-xs text-gray-600 ml-2 text-right">{data?.transportTypes?.own?.thisMonth || 0}</div>
            </div>
            <div className="flex items-center">
              <div className="w-16 text-xs text-gray-600 mr-2">Spedycja</div>
              <div className="flex-1 bg-gray-200 rounded-full h-4">
                <div
                  className="bg-red-500 h-4 rounded-full transition-all duration-500"
                  style={{
                    width: `${data?.transportTypes ? (data.transportTypes.spedition.thisMonth / Math.max(data.transportTypes.own.thisMonth + data.transportTypes.spedition.thisMonth, 1)) * 100 : 0}%`
                  }}
                ></div>
              </div>
              <div className="w-8 text-xs text-gray-600 ml-2 text-right">{data?.transportTypes?.spedition?.thisMonth || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardWidget>
  )
}

function CostAnalysisWidget({ costData, isFiltered }) {
  const currentMonth = costData?.thisMonth || 0;
  const lastMonth = costData?.lastMonth || 0;

  // Oblicz postęp (czy przekroczyliśmy budżet z zeszłego miesiąca?)
  const limit = lastMonth > 0 ? lastMonth : Math.max(currentMonth, 10000); // fallback
  const percentUsed = Math.min(Math.round((currentMonth / limit) * 100), 100);
  const isOverBudget = currentMonth > lastMonth && lastMonth > 0;

  return (
    <DashboardWidget
      title={isFiltered ? "Twój Budżet Spedycyjny" : "Analiza Kosztów Spedycji"}
      icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
      className="bg-white border-emerald-100/50"
    >
      <div className="space-y-6">
        {costData ? (
          <>
            <div className="flex justify-between items-end mb-2">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Koszty w tym miesiącu</div>
                <div className="text-3xl font-bold text-gray-900">{currentMonth.toLocaleString()} zł</div>
              </div>

              {lastMonth > 0 && (
                <div className={`flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${isOverBudget ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                  {isOverBudget ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {Math.abs(Math.round(((currentMonth - lastMonth) / lastMonth) * 100))}%
                </div>
              )}
            </div>

            {/* Pasek postępu vs zeszły miesiąc */}
            {lastMonth > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-500">Postęp względem zeszłego miesiąca</span>
                  <span className={isOverBudget ? "text-red-600" : "text-emerald-600"}>
                    {percentUsed}% limitu
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-1000 ${percentUsed > 90 ? 'bg-red-500' : percentUsed > 75 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                    style={{ width: `${percentUsed}%` }}
                  ></div>
                </div>
                <div className="text-right text-xs text-gray-400">
                  Zeszły miesiąc: {lastMonth.toLocaleString()} zł
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 mt-6">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50/30 p-4 rounded-xl border border-indigo-50/50">
                <div className="text-xs font-semibold text-indigo-600/70 mb-1 uppercase tracking-wider">Ten tydzień</div>
                <div className="font-bold text-indigo-900 text-lg">{costData.thisWeek.toLocaleString()} zł</div>
              </div>
              <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-100/50">
                <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Poprzedni tydzień</div>
                <div className="font-bold text-gray-700 text-lg">{costData.lastWeek.toLocaleString()} zł</div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Brak danych o kosztach</p>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function CostChartWidget({ chartData }) {
  // Max cost for height percentages
  const maxCost = chartData && chartData.length > 0
    ? Math.max(...chartData.map(d => d.koszt), 1)
    : 1;

  return (
    <DashboardWidget
      title="Historia Kosztów (6m)"
      icon={<BarChart3 className="w-5 h-5 text-indigo-500" />}
      className="bg-white border-indigo-50"
    >
      <div className="space-y-4">
        {chartData && chartData.length > 0 ? (
          <div className="flex items-end justify-between h-56 mt-6 pt-4 space-x-2">
            {chartData.map((data, index) => {
              const heightPercent = Math.max((data.koszt / maxCost) * 100, 5); // min 5% 
              const isCurrentMonth = index === chartData.length - 1;

              return (
                <div key={index} className="flex flex-col items-center flex-1 group">
                  <div className="relative flex justify-center w-full h-full flex-col justify-end">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-gray-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg whitespace-nowrap transition-all duration-300 z-10 pointer-events-none mb-2 shadow-lg">
                      {data.koszt.toLocaleString()} zł
                      <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 left-1/2 -bottom-1 -translate-x-1/2"></div>
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full max-w-[44px] rounded-t-xl mx-auto transition-all duration-1000 origin-bottom hover:brightness-110 ${isCurrentMonth
                          ? 'bg-gradient-to-t from-indigo-500 to-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                          : 'bg-gradient-to-t from-gray-200 to-gray-100 border-x border-t border-gray-200/50'
                        }`}
                      style={{ height: `${heightPercent}%` }}
                    ></div>
                  </div>
                  <span className={`text-xs mt-3 ${isCurrentMonth ? 'font-bold text-indigo-600' : 'text-gray-500 font-medium'}`}>
                    {data.month}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Brak danych historycznych do wyświetlenia</p>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function MonthlyStatsWidget({ data, isFiltered }) {
  // Obliczamy max i uwnikamy dzielenia przez 0
  const maxValue = data ? Math.max(...data.map(d => d.koszt), 1) : 1;

  return (
    <DashboardWidget
      title={isFiltered ? "Twoje Koszty Spedycji (6m)" : "Koszty Spedycji (6m)"}
      icon={<BarChart3 className="w-5 h-5" />}
    >
      <div className="space-y-3">
        {data && data.length > 0 ? (
          data.slice(-3).map((month, index) => (
            <div key={index} className="bg-gray-50 p-3 rounded-lg">
              <div className="font-medium text-gray-900 mb-2">{month.month}</div>
              <div className="text-sm">
                <div className="text-green-600 font-semibold">
                  Koszt spedycji: {month.koszt.toLocaleString()} zł
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6">
            <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Brak danych o kosztach</p>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function TransportTypesWidget({ data, isFiltered }) {
  const ownCount = data?.own?.count || 0;
  const spedCount = data?.spedition?.count || 0;
  const total = ownCount + spedCount || 1; // unikamy dzielenia przez 0

  const ownPercentage = Math.round((ownCount / total) * 100);
  const speditionPercentage = Math.round((spedCount / total) * 100);

  return (
    <DashboardWidget
      title={isFiltered ? "Podział Twoich Transportów" : "Podział Transportów"}
      icon={<PieChart className="w-5 h-5" />}
    >
      <div className="space-y-4">
        {total > 0 ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Transport własny</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{data.own.thisMonth}</div>
                <div className="text-xs text-gray-500">{ownPercentage}%</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Transport spedycyjny</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{data.spedition.thisMonth}</div>
                <div className="text-xs text-gray-500">{speditionPercentage}%</div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Łącznie:</span>
                <span className="font-bold text-lg">{total}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <PieChart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Brak danych o transportach</p>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

function QuickActionsWidget() {
  const actions = [
    {
      href: "/kalendarz",
      text: "Nowy Transport",
      icon: <Truck className="w-4 h-4" />,
      color: "blue",
      description: "Dodaj nowy transport"
    },
    {
      href: "/spedycja",
      text: "Panel Spedycji",
      icon: <FileText className="w-4 h-4" />,
      color: "green",
      description: "Zarządzaj zleceniami"
    },
    {
      href: "/archiwum",
      text: "Archiwum",
      icon: <Clock className="w-4 h-4" />,
      color: "gray",
      description: "Przeglądaj historię"
    }
  ]

  return (
    <DashboardWidget
      title="Szybkie Akcje"
      icon={<FileText className="w-5 h-5" />}
    >
      <div className="space-y-3">
        {actions.map((action, index) => (
          <QuickActionButton key={index} {...action} />
        ))}
      </div>
    </DashboardWidget>
  )
}

// Pozostałe funkcje pomocnicze
function TransportItem({ transport }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return 'Ukończony';
      case 'active': return 'Aktywny';
      case 'pending': return 'Oczekujący';
      default: return 'Nieznany';
    }
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 flex items-center">
          <MapPin className="w-4 h-4 text-gray-400 mr-1 flex-shrink-0" />
          <span className="truncate">{transport.source} → {transport.destination}</span>
        </div>
        <div className="text-sm text-gray-600 mt-1 flex items-center">
          <User className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
          <span className="truncate">{transport.driver}</span>
          {transport.mpk && transport.mpk !== 'Brak' && (
            <>
              <span className="mx-1">•</span>
              <span className="truncate">MPK: {transport.mpk}</span>
            </>
          )}
        </div>
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${getStatusColor(transport.status)}`}>
        {getStatusText(transport.status)}
      </div>
    </div>
  )
}

function WarehouseStatus({ name, activeTransports, status }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center">
        <div className={`w-3 h-3 rounded-full mr-3 ${status === 'operational' ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">
            {activeTransports} {activeTransports === 1 ? 'aktywny transport' : 'aktywnych transportów'}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${status === 'operational' ? 'text-green-600' : 'text-red-600'
          }`}>
          {status === 'operational' ? 'Operacyjny' : 'Problem'}
        </div>
      </div>
    </div>
  )
}

function RatingItem({ rating }) {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{rating.transport}</div>
        <div className="text-xs text-gray-600">{rating.date}</div>
      </div>
      <div className="flex items-center ml-2 flex-shrink-0">
        <Star className="w-4 h-4 text-yellow-500 mr-1" />
        <span className={`text-sm font-medium ${getScoreColor(rating.score)}`}>
          {rating.score}%
        </span>
      </div>
    </div>
  )
}

function QuickActionButton({ href, text, icon, color, description }) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    gray: 'bg-gray-600 hover:bg-gray-700 text-white'
  }

  return (
    <a
      href={href}
      className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${colorClasses[color]} group`}
    >
      <div className="flex items-center">
        {icon}
        <div className="ml-3">
          <div className="text-sm font-medium">{text}</div>
          <div className="text-xs opacity-90">{description}</div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}
