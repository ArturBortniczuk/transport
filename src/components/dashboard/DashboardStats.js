// src/components/dashboard/DashboardStats.js
'use client'
import { 
  Truck, 
  Clock, 
  Users, 
  Star, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle
} from 'lucide-react'

export function StatCard({ title, value, icon, color, description, trend, trendValue }) {
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

export function StatsGrid({ data }) {
  const stats = [
    {
      title: "Aktywne Transporty",
      value: data?.activeTransports || 0,
      icon: <Truck className="w-8 h-8" />,
      color: "blue",
      description: "Transporty w trakcie realizacji"
    },
    {
      title: "Oczekujące Wnioski",
      value: data?.pendingRequests || 0,
      icon: data?.pendingRequests > 0 ? <AlertTriangle className="w-8 h-8" /> : <Clock className="w-8 h-8" />,
      color: data?.pendingRequests > 0 ? "red" : "yellow",
      description: "Wymagają zatwierdzenia"
    },
    {
      title: "Kierowcy na Trasach",
      value: data?.activeDrivers || 0,
      icon: <Users className="w-8 h-8" />,
      color: "green",
      description: "Aktywni kierowcy"
    },
    {
      title: "Średnia Ocena",
      value: data?.averageRating ? `${data.averageRating}%` : 'N/A',
      icon: <Star className="w-8 h-8" />,
      color: "purple",
      description: "Oceny transportów"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  )
}
