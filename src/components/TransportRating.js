// src/components/TransportRating.js - zmodyfikowana wersja
'use client'
import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, X } from 'lucide-react'

export default function TransportRating({ transportId, onClose }) {
  const [ratings, setRatings] = useState([])
  const [isPositive, setIsPositive] = useState(null) // null, true (łapka w górę), false (łapka w dół)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canBeRated, setCanBeRated] = useState(true)

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
          setIsPositive(data.isPositive)
          setCanBeRated(data.canBeRated) // Ustawiamy, czy transport może być oceniony
          
          // Sprawdź czy użytkownik już ocenił ten transport
          if (currentUserEmail) {
            const userRatingObj = data.ratings.find(r => r.rater_email === currentUserEmail)
            if (userRatingObj) {
              setIsPositive(userRatingObj.is_positive)
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
    
    if (isPositive === null) {
      setSubmitError('Wybierz ocenę (łapka w górę lub w dół)')
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
          isPositive,
          comment: comment.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSubmitSuccess(true)
        setCanBeRated(false) // Po dodaniu oceny już nie można oceniać
        
        // Odśwież oceny, aby wyświetlić nową ocenę
        const fetchUpdatedRatings = async () => {
          const response = await fetch(`/api/transport-ratings?transportId=${transportId}`)
          const data = await response.json()
          
          if (data.success) {
            setRatings(data.ratings)
          }
        }
        
        fetchUpdatedRatings()
        
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
        setCanBeRated(true) // Po usunięciu oceny można znowu oceniać
        setRatings([]) // Wyczyść listę ocen
        
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

  // Renderowanie oceny (łapka w górę/dół)
  const renderThumb = (positive, interactive = false) => {
    if (interactive) {
      // Interaktywne przyciski do wyboru oceny
      return (
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setIsPositive(true)}
            className={`text-2xl p-3 rounded-full transition-colors ${
              isPositive === true ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-600'
            }`}
            title="Pozytywna ocena"
          >
            <ThumbsUp size={32} />
          </button>
          <button
            type="button"
            onClick={() => setIsPositive(false)}
            className={`text-2xl p-3 rounded-full transition-colors ${
              isPositive === false ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-red-600'
            }`}
            title="Negatywna ocena"
          >
            <ThumbsDown size={32} />
          </button>
        </div>
      )
    } else {
      // Statyczne wyświetlanie oceny
      return positive ? (
        <ThumbsUp className="text-green-600 w-6 h-6" />
      ) : (
        <ThumbsDown className="text-red-600 w-6 h-6" />
      )
    }
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
            {ratings.length > 0 && (
              <div className="bg-blue-50 p-4 rounded-md mb-6 flex justify-center">
                <div className="flex items-center justify-center">
                  <div className={`p-4 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                    {renderThumb(isPositive)}
                  </div>
                </div>
              </div>
            )}
            
            {/* Formularz dodawania oceny - wyświetl tylko jeśli transport może być oceniony */}
            {canBeRated ? (
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <h3 className="font-medium mb-3">Oceń transport</h3>
                <form onSubmit={handleSubmitRating}>
                  <div className="mb-3 flex justify-center">
                    {renderThumb(isPositive, true)}
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
                      disabled={submitting || isPositive === null}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {submitting ? 'Zapisywanie...' : 'Zapisz ocenę'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-blue-50 text-blue-700 p-4 rounded-md mb-6">
                <p>Ten transport został już oceniony i nie może być oceniony ponownie.</p>
                <p className="text-sm mt-2">Tylko pierwsza osoba może ocenić transport.</p>
              </div>
            )}
            
            {/* Lista ocen - zmieniony nagłówek */}
            <div>
              <h3 className="font-medium mb-3">
                {ratings.length > 0 ? "Ocena" : "Brak oceny"}
              </h3>
              
              {ratings.length === 0 ? (
                <div className="text-center text-gray-500 py-6">
                  Transport nie został jeszcze oceniony.
                  {canBeRated && " Bądź pierwszy i oceń!"}
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start">
                          <div className={`mr-3 p-1 rounded-full ${rating.is_positive ? 'bg-green-100' : 'bg-red-100'}`}>
                            {renderThumb(rating.is_positive)}
                          </div>
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
                          </div>
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
                        <div className="mt-2 text-gray-700 whitespace-pre-line ml-9">
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
