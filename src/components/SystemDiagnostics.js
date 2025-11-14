// src/components/SystemDiagnostics.js
'use client'
import React, { useState, useEffect } from 'react'
import { 
  AlertTriangle, CheckCircle, XCircle, RefreshCw, Database, 
  Server, Wifi, Code, Settings, Eye, EyeOff, Download, 
  FileText, Bug, Activity, Shield, Clock, Zap
} from 'lucide-react'

export default function SystemDiagnostics({ show = false, onClose }) {
  const [diagnostics, setDiagnostics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedTab, setSelectedTab] = useState('overview')
  const [expandedSections, setExpandedSections] = useState(new Set())

  useEffect(() => {
    if (show) {
      runDiagnostics()
    }
  }, [show])

  const runDiagnostics = async () => {
    setLoading(true)
    
    const results = {
      timestamp: new Date().toISOString(),
      overview: {
        status: 'checking',
        errors: 0,
        warnings: 0,
        success: 0
      },
      api: {},
      database: {},
      components: {},
      environment: {}
    }

    try {
      // Test API endpoints
      results.api = await testApiEndpoints()
      
      // Test database
      results.database = await testDatabase()
      
      // Test environment
      results.environment = await testEnvironment()
      
      // Test components
      results.components = await testComponents()
      
      // Calculate overview
      const allTests = [
        ...Object.values(results.api),
        ...Object.values(results.database),
        ...Object.values(results.environment),
        ...Object.values(results.components)
      ]
      
      results.overview = {
        status: allTests.some(t => t.status === 'error') ? 'error' : 
                allTests.some(t => t.status === 'warning') ? 'warning' : 'success',
        total: allTests.length,
        errors: allTests.filter(t => t.status === 'error').length,
        warnings: allTests.filter(t => t.status === 'warning').length,
        success: allTests.filter(t => t.status === 'success').length
      }
      
    } catch (error) {
      console.error('Diagnostics error:', error)
      results.overview.status = 'error'
      results.overview.errors = 1
    }
    
    setDiagnostics(results)
    setLoading(false)
  }

  const testApiEndpoints = async () => {
    const endpoints = [
      { name: 'Kurier API', url: '/api/kurier', method: 'GET' },
      { name: 'Kurier Stats', url: '/api/kurier/stats', method: 'GET' },
      { name: 'Auth Session', url: '/api/auth/session', method: 'GET' },
      { name: 'DHL Services', url: '/api/kurier/postal-services?postCode=15169', method: 'GET' }
    ]
    
    const results = {}
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          credentials: 'include'
        })
        
        const contentType = response.headers.get('content-type')
        let data = null
        
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json()
          } catch (parseError) {
            results[endpoint.name] = {
              status: 'error',
              message: 'JSON parse error: ' + parseError.message,
              httpStatus: response.status
            }
            continue
          }
        }
        
        if (response.ok) {
          results[endpoint.name] = {
            status: 'success',
            message: 'OK',
            httpStatus: response.status,
            responseTime: '< 1s',
            data: data ? Object.keys(data) : null
          }
        } else {
          results[endpoint.name] = {
            status: 'error',
            message: data?.error || `HTTP ${response.status}`,
            httpStatus: response.status
          }
        }
      } catch (error) {
        results[endpoint.name] = {
          status: 'error',
          message: 'Network error: ' + error.message,
          httpStatus: 0
        }
      }
    }
    
    return results
  }

  const testDatabase = async () => {
    const results = {}
    
    try {
      // Test database connection via API
      const response = await fetch('/api/system/database-test', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        results['Connection'] = {
          status: 'success',
          message: 'Connected to PostgreSQL',
          details: data.details
        }
        
        results['Tables'] = {
          status: data.tables?.length > 0 ? 'success' : 'warning',
          message: `${data.tables?.length || 0} tables found`,
          details: data.tables
        }
      } else {
        results['Connection'] = {
          status: 'error',
          message: 'Database connection failed'
        }
      }
    } catch (error) {
      results['Connection'] = {
        status: 'error',
        message: 'Database test failed: ' + error.message
      }
    }
    
    return results
  }

  const testEnvironment = async () => {
    const results = {}
    
    // Check environment variables
    results['NODE_ENV'] = {
      status: 'success',
      message: process.env.NODE_ENV || 'not set',
      value: process.env.NODE_ENV
    }
    
    // Check if running on client
    results['Client Side'] = {
      status: 'success',
      message: typeof window !== 'undefined' ? 'Browser environment' : 'Server environment',
      details: typeof window !== 'undefined' ? {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform
      } : null
    }
    
    // Check current URL
    if (typeof window !== 'undefined') {
      results['Current URL'] = {
        status: 'success',
        message: window.location.origin,
        details: {
          protocol: window.location.protocol,
          host: window.location.host,
          pathname: window.location.pathname
        }
      }
    }
    
    return results
  }

  const testComponents = async () => {
    const results = {}
    
    // Test React components
    const requiredComponents = [
      'TransportRating',
      'TransportRatingBadge'
    ]
    
    for (const component of requiredComponents) {
      try {
        const comp = await import(`@/components/${component}`)
        results[component] = {
          status: 'success',
          message: 'Component loaded successfully',
          hasDefault: !!comp.default
        }
      } catch (error) {
        results[component] = {
          status: 'warning',
          message: 'Component not found or has errors',
          error: error.message
        }
      }
    }
    
    return results
  }

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200'
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200'
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200'
    }
  }

  const exportDiagnostics = () => {
    const dataStr = JSON.stringify(diagnostics, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `system-diagnostics-${new Date().toISOString().slice(0, 19)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Bug className="w-6 h-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Diagnostyka Systemu</h2>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Sprawdzanie...' : 'Odśwież'}
            </button>
            {diagnostics && (
              <button
                onClick={exportDiagnostics}
                className="flex items-center px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Eksport
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-48 bg-gray-50 border-r p-4">
            <nav className="space-y-2">
              {[
                { id: 'overview', label: 'Przegląd', icon: Activity },
                { id: 'api', label: 'API', icon: Server },
                { id: 'database', label: 'Baza danych', icon: Database },
                { id: 'environment', label: 'Środowisko', icon: Settings },
                { id: 'components', label: 'Komponenty', icon: Code }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 text-sm rounded transition-colors ${
                    selectedTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Main content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                  <p className="text-gray-600">Uruchamianie diagnostyki...</p>
                </div>
              </div>
            ) : diagnostics ? (
              <div>
                {selectedTab === 'overview' && (
                  <div>
                    <h3 className="text-lg font-medium mb-4">Podsumowanie</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border ${getStatusColor(diagnostics.overview.status)}`}>
                        <div className="flex items-center">
                          {getStatusIcon(diagnostics.overview.status)}
                          <span className="ml-2 font-medium">Status ogólny</span>
                        </div>
                        <p className="mt-1 text-sm">{diagnostics.overview.status === 'success' ? 'Wszystko działa' : 'Wykryto problemy'}</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-green-50 border-green-200">
                        <div className="text-2xl font-bold text-green-700">{diagnostics.overview.success}</div>
                        <p className="text-sm text-green-600">Testy przeszły</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-700">{diagnostics.overview.warnings}</div>
                        <p className="text-sm text-yellow-600">Ostrzeżenia</p>
                      </div>
                      <div className="p-4 rounded-lg border bg-red-50 border-red-200">
                        <div className="text-2xl font-bold text-red-700">{diagnostics.overview.errors}</div>
                        <p className="text-sm text-red-600">Błędy</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Ostatnie sprawdzenie: {new Date(diagnostics.timestamp).toLocaleString('pl-PL')}
                    </div>
                  </div>
                )}

                {selectedTab !== 'overview' && diagnostics[selectedTab] && (
                  <div>
                    <h3 className="text-lg font-medium mb-4 capitalize">{selectedTab}</h3>
                    <div className="space-y-3">
                      {Object.entries(diagnostics[selectedTab]).map(([key, result]) => (
                        <div key={key} className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              {getStatusIcon(result.status)}
                              <span className="ml-2 font-medium">{key}</span>
                            </div>
                            {(result.details || result.data) && (
                              <button
                                onClick={() => toggleSection(`${selectedTab}-${key}`)}
                                className="text-sm text-gray-500 hover:text-gray-700"
                              >
                                {expandedSections.has(`${selectedTab}-${key}`) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-sm">{result.message}</p>
                          {result.httpStatus && (
                            <p className="text-xs text-gray-500 mt-1">HTTP {result.httpStatus}</p>
                          )}
                          {expandedSections.has(`${selectedTab}-${key}`) && (result.details || result.data) && (
                            <div className="mt-3 p-3 bg-gray-100 rounded text-xs">
                              <pre className="whitespace-pre-wrap overflow-x-auto">
                                {JSON.stringify(result.details || result.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Bug className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Kliknij "Odśwież" aby uruchomić diagnostykę</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
