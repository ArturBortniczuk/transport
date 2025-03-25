import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  try {
    // Ścieżka do pliku Excel
    const filePath = path.join(process.cwd(), 'public', 'users.xlsx');
    
    // Wczytaj plik Excel
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, {
      range: 1,
      header: ['name', 'position', 'email', 'phone', 'password']
    });
    
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}