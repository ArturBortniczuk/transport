// src/components/dashboard/DashboardWidgets.js
'use client'
import { 
  Calendar, 
  Building, 
  Star, 
  Activity, 
  FileText, 
  Truck, 
  Clock,
  MapPin,
  User,
  Phone,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'

export function DashboardWidget({ title, icon, children, className = "" }) {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-center mb-4">
        <div className="text-gray-600">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 ml-2">{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function TodayTransportsWidget({ transports }) {
  return (
    <DashboardWidget
      title="Dzisiejsze Transporty"
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
            <p className="text-gray-500">Brak transportów na dzisiaj</p>
            <Link 
              href="/kalendarz" 
              className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
            >
              Dodaj transport →
            </Link>
          </div>
        )}
      </div>
    </DashboardWidget>
  )
}

export function WarehouseStatusWidget({ warehouses }) {
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
        
        {/* Podsumowanie */}
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

export function RecentRatingsWidget({ ratings }) {
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
          <Link 
            href="/archiwum" 
            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
          >
            Zobacz wszystkie oceny 
            <ExternalLink className="w-3 h-3 ml-1" />
          </Link>
        </div>
      )}
    </DashboardWidget>
  )
}

export function FleetActivityWidget({ fleetsInUse, totalFleets }) {
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
            className={`h-3 rounded-full transition-all duration-500 ${
              usagePercentage >= 80 ? 'bg-red-500' :
              usagePercentage >= 60 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{width: `${usagePercentage}%`}}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Wykorzystanie floty</span>
          <span className={`font-medium ${
            usagePercentage >= 80 ? 'text-red-600' :
            usagePercentage >= 60 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {usagePercentage}%
          </span>
        </div>
        
        {/* Dodatkowe informacje */}
        <div className="pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <div className="flex justify-between mb-1">
              <span>Dostępne pojazdy:</span>
              <span className="font-medium">{totalFleets - fleetsInUse}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-medium ${
                usagePercentage >= 90 ? 'text-red-600' :
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

export function QuickActionsWidget() {
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

// Funkcje pomocnicze
function TransportItem({ transport }) {
  const getStatusColor = (status) => {
    switch(status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  const getStatusText = (status) => {
    switch(status) {
      case 'completed':
        return 'Ukończony';
      case 'active':
        return 'Aktywny';
      case 'pending':
        return 'Oczekujący';
      default:
        return 'Nieznany';
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
        <div className={`w-3 h-3 rounded-full mr-3 ${
          status === 'operational' ? 'bg-green-500' : 'bg-red-500'
        }`}></div>
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-sm text-gray-600">
            {activeTransports} {activeTransports === 1 ? 'aktywny transport' : 'aktywnych transportów'}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${
          status === 'operational' ? 'text-green-600' : 'text-red-600'
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
    <Link 
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
    </Link>
  )
}
