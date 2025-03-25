import React, { useState } from 'react';
import * as XLSX from 'xlsx';

const ImportUsers = () => {
  const [importStatus, setImportStatus] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      // Pomijamy wiersz nagłówkowy
      const users = jsonData.slice(1).map(row => ({
        name: row[0],
        position: row[1],
        email: row[2],
        phone: row[3],
        password: row[4],
        role: mapPositionToRole(row[1]) // Funkcja mapująca stanowisko na rolę
      }));

      const response = await fetch('/api/users/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users })
      });

      const result = await response.json();
      if (result.success) {
        setImportStatus('Import zakończony sukcesem');
      } else {
        setImportStatus('Błąd podczas importu: ' + result.error);
      }
    } catch (error) {
      console.error('Error importing users:', error);
      setImportStatus('Wystąpił błąd podczas importu');
    }
  };

  const mapPositionToRole = (position) => {
    position = position.toLowerCase();
    if (position.includes('magazyn białystok')) return 'magazyn';
    if (position.includes('magazyn zielonka')) return 'magazyn';
    if (position.includes('handlowiec')) return 'handlowiec';
    return 'user'; // domyślna rola
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Import użytkowników</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Wybierz plik Excel
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="mt-1 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>
        {importStatus && (
          <div className={`mt-4 p-4 rounded-md ${
            importStatus.includes('sukces') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportUsers;