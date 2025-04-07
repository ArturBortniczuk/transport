// src/app/spedycja/components/SpedycjaForm.js
'use client'
import { useState, useEffect } from 'react'

export default function SpedycjaForm({ onSubmit, onCancel, initialData, isResponse }) {
  const [selectedLocation, setSelectedLocation] = useState(initialData?.location || '')
  const [userMpk, setUserMpk] = useState('')
  const [users, setUsers] = useState([])
  const [isForOtherUser, setIsForOtherUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [currentUser, setCurrentUser] = useState({
    email: '',
    name: ''
  })

  // Pobierz listę użytkowników i dane bieżącego użytkownika na początku
  useEffect(() => {
    // Pobierz dane bieżącego użytkownika
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.isAuthenticated && data.user) {
          setCurrentUser({
            email: data.user.email || '',
            name: data.user.name || '',
            mpk: data.user.mpk || ''
          });
          setUserMpk(data.user.mpk || '');
        }
      } catch (error) {
        console.error('Błąd pobierania danych użytkownika:', error);
      }
    };

    // Pobierz listę wszystkich użytkowników
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users/list');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Błąd pobierania listy użytkowników:', error);
      }
    };

    fetchCurrentUser();
    fetchUsers();
  }, []);

  // Klasy dla przycisków
  const buttonClasses = {
    primary: "px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors",
    outline: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors",
    selected: "px-4 py-2 bg-blue-500 text-white rounded-md",
    unselected: "px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
  }
  
  const handleSubmit = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    
    if (isResponse) {
      onSubmit(initialData.id, {
        driverName: formData.get('driverName'),
        driverSurname: formData.get('driverSurname'),
        driverPhone: formData.get('driverPhone'),
        vehicleNumber: formData.get('vehicleNumber'),
        deliveryPrice: Number(formData.get('deliveryPrice')),
        distanceKm: Number(formData.get('distanceKm') || 0),
        adminNotes: formData.get('adminNotes')
      })
    } else {
      const mpk = isForOtherUser && selectedUser 
        ? (users.find(u => u.email === selectedUser)?.mpk || '')
        : userMpk;
        
      const personResponsible = isForOtherUser && selectedUser
        ? (users.find(u => u.email === selectedUser)?.name || '')
        : currentUser.name;
        
      const responsibleEmail = isForOtherUser && selectedUser
        ? selectedUser
        : currentUser.email;
        
      const data = {
        location: selectedLocation,
        documents: formData.get('documents'),
        producerAddress: selectedLocation === 'Producent' ? {
          city: formData.get('producerCity'),
          postalCode: formData.get('producerPostalCode'),
          street: formData.get('producerStreet'),
          pinLocation: formData.get('producerPinLocation')
        } : null,
        delivery: {
          city: formData.get('deliveryCity'),
          postalCode: formData.get('deliveryPostalCode'),
          street: formData.get('deliveryStreet'),
          pinLocation: formData.get('deliveryPinLocation')
        },
        loadingContact: formData.get('loadingContact'),
        unloadingContact: formData.get('unloadingContact'),
        deliveryDate: formData.get('deliveryDate'),
        mpk: mpk,
        notes: formData.get('notes'),
        // Dodajemy informacje o użytkowniku dodającym i odpowiedzialnym
        createdBy: currentUser.name,
        createdByEmail: currentUser.email,
        responsiblePerson: personResponsible,
        responsibleEmail: responsibleEmail
      }
      onSubmit(data)
    }
    
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">
          {isResponse ? 'Odpowiedź na zamówienie spedycji' : 'Nowe zamówienie spedycji'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses.outline}
        >
          Anuluj
        </button>
      </div>

      {isResponse ? (
        // Formularz odpowiedzi
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Imię kierowcy</label>
              <input
                name="driverName"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nazwisko kierowcy</label>
              <input
                name="driverSurname"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefon do kierowcy</label>
              <input
                name="driverPhone"
                type="tel"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Numery auta</label>
              <input
                name="vehicleNumber"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cena transportu</label>
              <input
                name="deliveryPrice"
                type="number"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Odległość (km)</label>
              <input
                name="distanceKm"
                type="number"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Uwagi do transportu</label>
            <textarea
              name="adminNotes"
              className="w-full p-2 border rounded-md"
              rows={3}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Miejsce załadunku</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={selectedLocation === 'Magazyn Białystok' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Magazyn Białystok')}
              >
                Magazyn Białystok
              </button>
              <button
                type="button"
                className={selectedLocation === 'Magazyn Zielonka' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Magazyn Zielonka')}
              >
                Magazyn Zielonka
              </button>
              <button
                type="button"
                className={selectedLocation === 'Producent' ? buttonClasses.selected : buttonClasses.unselected}
                onClick={() => setSelectedLocation('Producent')}
              >
                Producent
              </button>
            </div>
          </div>

          {selectedLocation === 'Producent' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Adres producenta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Miasto</label>
                  <input
                    name="producerCity"
                    type="text"
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Kod pocztowy</label>
                  <input
                    name="producerPostalCode"
                    type="text"
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ulica i numer</label>
                <input
                  name="producerStreet"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Lokalizacja na mapie (opcjonalnie)
                </label>
                <input
                  name="producerPinLocation"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  placeholder="Link do pineski na mapie"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Numery dokumentów</label>
            <input
              name="documents"
              type="text"
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Adres dostawy</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Miasto</label>
                <input
                  name="deliveryCity"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kod pocztowy</label>
                <input
                  name="deliveryPostalCode"
                  type="text"
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ulica i numer</label>
              <input
                name="deliveryStreet"
                type="text"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Lokalizacja na mapie (opcjonalnie)
              </label>
              <input
                name="deliveryPinLocation"
                type="text"
                className="w-full p-2 border rounded-md"
                placeholder="Link do pineski na mapie"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Data dostawy</label>
            <input
              name="deliveryDate"
              type="date"
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Telefon na załadunek</label>
              <input
                name="loadingContact"
                type="tel"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefon na rozładunek</label>
              <input
                name="unloadingContact"
                type="tel"
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium mb-1">Numer MPK</label>
              <button
                type="button"
                onClick={() => setIsForOtherUser(!isForOtherUser)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {isForOtherUser ? 'Użyj mojego MPK' : 'To nie dla mnie'}
              </button>
            </div>
            
            {isForOtherUser ? (
              <div>
                <select
                  className="w-full p-2 border rounded-md"
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  required
                >
                  <option value="">Wybierz osobę odpowiedzialną</option>
                  {users.map(user => (
                    <option key={user.email} value={user.email}>
                      {user.name} {user.mpk ? `(MPK: ${user.mpk})` : ''}
                    </option>
                  ))}
                </select>
                {selectedUser && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                    <div className="text-sm">
                      <strong>Osoba odpowiedzialna:</strong> {users.find(u => u.email === selectedUser)?.name}
                    </div>
                    <div className="text-sm">
                      <strong>MPK:</strong> {users.find(u => u.email === selectedUser)?.mpk || 'Brak MPK'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <input
                  name="mpk"
                  type="text"
                  value={userMpk}
                  onChange={(e) => setUserMpk(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  readOnly
                />
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                  <div className="text-sm">
                    <strong>Osoba odpowiedzialna:</strong> {currentUser.name || 'Nie zalogowany'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Uwagi</label>
            <textarea
              name="notes"
              className="w-full p-2 border rounded-md"
              rows={3}
              placeholder="Dodatkowe informacje..."
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          className={buttonClasses.primary}
        >
          {isResponse ? 'Zapisz odpowiedź' : 'Dodaj zamówienie'}
        </button>
      </div>
    </form>
  )
}
