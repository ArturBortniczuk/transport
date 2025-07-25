// src/components/dashboard/DashboardCharts.js
'use client'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  BarChart3, 
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  DollarSign,
  Truck,
  Calendar,
  Activity
} from 'lucide-react'
import { DashboardWidget } from './DashboardWidgets'

// Kolory dla wykresów
const COLORS = {
  own: '#3B82F6',      // niebieski
  spedition: '#EF4444', // czerwony
  cost: '#10B981',     // zielony
  accent: '#F59E0B'    // pomarańczowy
}

export function MonthlyTransportChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <DashboardWidget
        title="Transporty Miesięcznie"
        icon={<BarChart3 className="w-5 h-5" />}
        className="col-span-2"
      >
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Brak danych do wyświetlenia</p>
        </div>
      </DashboardWidget>
    )
  }

  return (
    <DashboardWidget
      title="Transporty Miesięcznie - Własny vs Spedycyjny"
      icon={<BarChart3 className="w-5 h-5" />}
      className="col-span-2"
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              stroke="#666" 
              fontSize={12}
            />
            <YAxis 
              stroke="#666" 
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value, name) => [
                value,
                name === 'własny' ? 'Transport własny' : 'Transport spedycyjny'
              ]}
              labelFormatter={(label) => `Miesiąc: ${label}`}
            />
            <Legend 
              formatter={(value) => 
                value === 'własny' ? 'Transport własny' : 'Transport spedycyjny'
              }
            />
            <Bar 
              dataKey="własny" 
              fill={COLORS.own} 
              radius={[4, 4, 0, 0]}
              name="własny"
            />
            <Bar 
              dataKey="spedycyjny" 
              fill={COLORS.spedition} 
              radius={[4, 4, 0, 0]}
              name="spedycyjny"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Podsumowanie pod wykresem */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
        <div className="text-center">
          <div className="font-semibold text-blue-600">
            {data.reduce((sum, item) => sum + item.własny, 0)}
          </div>
          <div className="text-gray-500">Transporty własne</div>
        </div>
        <div className="text-center">
          <div className="font-semibold text-red-600">
            {data.reduce((sum, item) => sum + item.spedycyjny, 0)}
          </div>
          <div className="text-gray-500">Transporty spedycyjne</div>
        </div>
      </div>
    </DashboardWidget>
  )
}

export function WeeklyTransportChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <DashboardWidget
        title="Transporty Tygodniowo"
        icon={<LineChartIcon className="w-5 h-5" />}
      >
        <div className="text-center py-8">
          <LineChartIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Brak danych do wyświetlenia</p>
        </div>
      </DashboardWidget>
    )
  }

  return (
    <DashboardWidget
      title="Transporty Tygodniowo"
      icon={<LineChartIcon className="w-5 h-5" />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="week" 
              stroke="#666" 
              fontSize={12}
            />
            <YAxis 
              stroke="#666" 
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value, name) => [
                value,
                name === 'własny' ? 'Transport własny' : 'Transport spedycyjny'
              ]}
              labelFormatter={(label) => `Tydzień: ${label}`}
            />
            <Legend 
              formatter={(value) => 
                value === 'własny' ? 'Własny' : 'Spedycyjny'
              }
            />
            <Line 
              type="monotone" 
              dataKey="własny" 
              stroke={COLORS.own} 
              strokeWidth={3}
              dot={{ fill: COLORS.own, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: COLORS.own, strokeWidth: 2 }}
            />
            <Line 
              type="monotone" 
              dataKey="spedycyjny" 
              stroke={COLORS.spedition} 
              strokeWidth={3}
              dot={{ fill: COLORS.spedition, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: COLORS.spedition, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </DashboardWidget>
  )
}

export function SpeditionCostChart({ data, costData }) {
  if (!data || data.length === 0) {
    return (
      <DashboardWidget
        title="Koszty Spedycji Miesięcznie"
        icon={<DollarSign className="w-5 h-5" />}
      >
        <div className="text-center py-8">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Brak danych do wyświetlenia</p>
        </div>
      </DashboardWidget>
    )
  }

  return (
    <DashboardWidget
      title="Koszty Spedycji Miesięcznie"
      icon={<DollarSign className="w-5 h-5" />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              stroke="#666" 
              fontSize={12}
            />
            <YAxis 
              stroke="#666" 
              fontSize={12}
              tickFormatter={(value) => `${value.toLocaleString()} zł`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value) => [`${value.toLocaleString()} zł`, 'Koszt spedycji']}
              labelFormatter={(label) => `Miesiąc: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="koszt" 
              stroke={COLORS.cost} 
              strokeWidth={3}
              dot={{ fill: COLORS.cost, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: COLORS.cost, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Podsumowanie kosztów */}
      {costData && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="font-semibold text-green-700">Ten miesiąc</div>
              <div className="text-lg font-bold text-green-900">
                {costData.thisMonth.toLocaleString()} zł
              </div>
              <div className="text-xs text-green-600">
                vs. {costData.lastMonth.toLocaleString()} zł (poprzedni)
              </div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-semibold text-blue-700">Ten tydzień</div>
              <div className="text-lg font-bold text-blue-900">
                {costData.thisWeek.toLocaleString()} zł
              </div>
              <div className="text-xs text-blue-600">
                vs. {costData.lastWeek.toLocaleString()} zł (poprzedni)
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardWidget>
  )
}

export function TransportTypePieChart({ data }) {
  if (!data || (!data.own.thisMonth && !data.spedition.thisMonth)) {
    return (
      <DashboardWidget
        title="Podział Transportów"
        icon={<PieChartIcon className="w-5 h-5" />}
      >
        <div className="text-center py-8">
          <PieChartIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Brak danych do wyświetlenia</p>
        </div>
      </DashboardWidget>
    )
  }

  const pieData = [
    { name: 'Transport własny', value: data.own.thisMonth, color: COLORS.own },
    { name: 'Transport spedycyjny', value: data.spedition.thisMonth, color: COLORS.spedition }
  ]

  const total = data.own.thisMonth + data.spedition.thisMonth
  const ownPercentage = total > 0 ? Math.round((data.own.thisMonth / total) * 100) : 0
  const speditionPercentage = total > 0 ? Math.round((data.spedition.thisMonth / total) * 100) : 0

  return (
    <DashboardWidget
      title="Podział Transportów (ten miesiąc)"
      icon={<PieChartIcon className="w-5 h-5" />}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value, name) => [value, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda i statystyki */}
      <div className="mt-4 space-y-3">
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
      </div>
    </DashboardWidget>
  )
}

// Widget z aktywnymi spedycjami
export function ActiveSpeditionsWidget({ activeSpeditions, speditionCosts }) {
  return (
    <DashboardWidget
      title="Aktywne Spedycje"
      icon={<Truck className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600 mb-2">
            {activeSpeditions || 0}
          </div>
          <div className="text-sm text-gray-600">
            Spedycji w trakcie realizacji
          </div>
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
