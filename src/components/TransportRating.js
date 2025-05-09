// src/components/TransportRating.js
'use client'
import { useState, useEffect } from 'react'
import { Star, StarHalf, X } from 'lucide-react'

export default function TransportRating({ transportId, onClose }) {
  const [ratings, setRatings] = useState([])
  const [averageRating, setAverageRating] = useState(0)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userRating, setUserRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Pobierz dane o bieżącym użytkowniku
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/user')
        const data = await response.json()
        
        if (data.isAuthenticated && data.user) {
          setCurrentUserEmail(data.user.email)
          setIsAdmin(data.user.isAdmin)
        }
      } catch (error) {
        console.error('Błąd pobierania danych użytkownika:', error)
      }
    }
    
    fetchCurrentUser()
  }, [])

  // Pobierz oceny dla transportu
  useEffect(() => {
    const fetchRatings = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/transport-ratings?transportId=${transportId}`)
        const data = await response.json()
        
        if (data.success) {
          setRatings(data.ratings)
          setAverageRating(data.averageRating)
          setCount(data.count)
          
          // Sprawdź czy użytkownik już ocenił ten transport
          if (currentUserEmail) {
            const userRatingObj = data.ratings.find(r => r.rater_email === currentUserEmail)
            if (userRatingObj) {
              setUserRating(userRatingObj.rating)
              setComment(userRatingObj.comment || '')
            }
          }
        } else {
          setError(data.error)
        }
      } catch (error) {
        console.error('Błąd pobierania ocen:', error)
        setError('Wystąpił błąd podczas pobierania ocen')
      } finally {
        setLoading(false)
      }
    }
    
    if (transportId) {
      fetchRatings()
    }
  }, [transportId, currentUserEmail, submitSuccess])

  // Funkcja wysyłająca ocenę
  const handleSubmitRating = async (e) => {
    e.preventDefault()
    
    if (userRating < 1) {
      setSubmitError('Wybierz ocenę od 1 do 5')
      return
    }
    
    try {
      setSubmitting(true)
      setSubmitError(null)
      
      const response = await fetch('/api/transport-ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transportId,
          rating: userRating,
          comment: comment.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSubmitSuccess(true)
        
        // Wyczyść błędy i ustaw timeout do ukrycia komunikatu sukcesu
        setTimeout(() => {
          setSubmitSuccess(false)
        }, 3000)
      } else {
        setSubmitError(data.error)
      }
    } catch (error) {
      console.error('Błąd wysyłania oceny:', error)
      setSubmitError('Wystąpił błąd podczas wysyłania oceny')
    } finally {
      setSubmitting(false)
    }
  }

  // Funkcja usuwająca ocenę
  const handleDeleteRating = async (ratingId) => {
    if (!confirm('Czy na pewno chcesz usunąć tę ocenę?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/transport-ratings?id=${ratingId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Odśwież listę ocen
        setSubmitSuccess(true)
        setTimeout(() => {
          setSubmitSuccess(false)
        }, 1000)
      } else {
        alert(data.error || 'Nie udało się usunąć oceny')
      }
    } catch (error) {
      console.error('Błąd usuwania oceny:', error)
      alert('Wystąpił błąd podczas usuwania oceny')
    }
  }

  // Renderowanie gwiazdek dla danej oceny
  const renderStars = (rating, interactive = false) => {
    const stars = []
    
    for (let i = 1; i <= 5; i++) {
      if (interactive) {
        // Interaktywne gwiazdki do wyboru oceny
        stars.push(
          <button
            key={i}
            type="button"
            onClick={() => setUserRating(i)}
            className={`text-2xl focus:outline-none transition-colors ${
              i <= userRating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            title={`${i} ${i === 1 ? 'gwiazdka' : i < 5 ? 'gwiazdki' : 'gwiazdek'}`}
          >
            ★
          </button>
        )
      } else {
        // Statyczne gwiazdki do wyświetlania oceny
        const filled = Math.min(Math.max(rating - (i - 1), 0), 1)
        
        if (filled >= 0.75) {
          stars.push(<Star key={i} className="text-yellow-400 fill-yellow-400 w-4 h-4" />)
        } else if (filled >= 0.25) {
          stars.push(<StarHalf key={i} className="text-yellow-400 fill-yellow-400 w-4 h-4" />)
        } else {
          stars.push(<Star key={i} className="text-gray-300 w-4 h-4" />)
        }
      }
    }
    
    return <div className="flex space-x-1">{stars}</div>
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Oceny transportu</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Oceny transportu</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        
        {error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-md mb-4">
            {error}
          </div>
        ) : (
          <>
            {/* Podsumowanie ocen */}
            <div className="bg-blue-50 p-4 rounded-md mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center mb-2 sm:mb-0">
                  <div className="text-3xl font-bold text-blue-800 mr-3">
                    {averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center">
                    {renderStars(averageRating)}
                    <span className="ml-2 text-sm text-gray-500">
                      ({count} {count === 1 ? 'ocena' : count < 5 ? 'oceny' : 'ocen'})
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Formularz dodawania oceny */}
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <h3 className="font-medium mb-3">Twoja ocena</h3>
              <form onSubmit={handleSubmitRating}>
                <div className="mb-3 flex justify-center">
                  {renderStars(userRating, true)}
                </div>
                
                <div className="mb-3">
                  <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                    Komentarz (opcjonalnie)
                  </label>
                  <textarea
                    id="comment"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Podziel się swoją opinią na temat tego transportu..."
                  />
                </div>
                
                {submitError && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-md mb-3 text-sm">
                    {submitError}
                  </div>
                )}
                
                {submitSuccess && (
                  <div className="bg-green-50 text-green-700 p-3 rounded-md mb-3 text-sm">
                    Twoja ocena została zapisana!
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {submitting ? 'Zapisywanie...' : 'Zapisz ocenę'}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Lista ocen */}
            <div>
              <h3 className="font-medium mb-3">Wszystkie oceny</h3>
              
              {ratings.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  Brak ocen dla tego transportu. Bądź pierwszy i oceń!
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{rating.rater_name}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(rating.created_at).toLocaleDateString('pl-PL', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="mt-1">{renderStars(rating.rating)}</div>
                        </div>
                        
                        {(currentUserEmail === rating.rater_email || isAdmin) && (
                          <button
                            onClick={() => handleDeleteRating(rating.id)}
                            className="text-red-500 hover:text-red-700"
                            title="Usuń ocenę"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                      
                      {rating.comment && (
                        <div className="mt-2 text-gray-700 whitespace-pre-line">
                          {rating.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
