// src/app/api/kurier/migrate/route.js
// 🔧 PROSTY ENDPOINT MIGRACJI - Dodaje kolumny do tabeli kuriers

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { default: db } = await import('@/database/db')
    
    console.log('🔧 Rozpoczynam prostą migrację tabeli kuriers...')
    
    // Sprawdź czy tabela istnieje
    const tableExists = await db.schema.hasTable('kuriers')
    if (!tableExists) {
      return NextResponse.json({
        success: false,
        error: 'Tabela kuriers nie istnieje'
      }, { status: 404 })
    }

    // Lista kolumn do dodania
    const columnsToAdd = [
      'order_type VARCHAR(50)',
      'sender_name VARCHAR(255)',
      'sender_street VARCHAR(255)', 
      'sender_house_number VARCHAR(20)',
      'sender_apartment_number VARCHAR(20)',
      'sender_city VARCHAR(100)',
      'sender_postcode VARCHAR(10)',
      'sender_country VARCHAR(2) DEFAULT \'PL\'',
      'sender_phone VARCHAR(20)',
      'sender_email VARCHAR(255)',
      'sender_contact_person VARCHAR(255)',
      'sender_company VARCHAR(255)',
      'recipient_street VARCHAR(255)',
      'recipient_house_number VARCHAR(20)', 
      'recipient_apartment_number VARCHAR(20)',
      'recipient_city VARCHAR(100)',
      'recipient_postcode VARCHAR(10)',
      'recipient_country VARCHAR(2) DEFAULT \'PL\'',
      'recipient_email VARCHAR(255)',
      'recipient_contact_person VARCHAR(255)',
      'recipient_company VARCHAR(255)',
      'package_contents TEXT',
      'mpk VARCHAR(50)',
      'notes_general TEXT',
      'package_weight DECIMAL(8,2)',
      'package_length INTEGER',
      'package_width INTEGER', 
      'package_height INTEGER',
      'package_type VARCHAR(50) DEFAULT \'PACKAGE\'',
      'package_quantity INTEGER DEFAULT 1',
      'package_non_standard BOOLEAN DEFAULT FALSE',
      'service_type VARCHAR(10) DEFAULT \'AH\'',
      'insurance_requested BOOLEAN DEFAULT FALSE',
      'insurance_amount DECIMAL(10,2)',
      'cod_requested BOOLEAN DEFAULT FALSE',
      'cod_amount DECIMAL(10,2)',
      'saturday_delivery BOOLEAN DEFAULT FALSE',
      'evening_delivery BOOLEAN DEFAULT FALSE',
      'is_international BOOLEAN DEFAULT FALSE',
      'customs_type VARCHAR(10)',
      'customs_value DECIMAL(10,2)',
      'estimated_cost DECIMAL(10,2)',
      'pricing_data TEXT',
      'packages_details TEXT',
      'postal_services_data TEXT',
      'updated_at TIMESTAMP DEFAULT NOW()'
    ]

    let addedColumns = []
    let skippedColumns = []

    // Sprawdź istniejące kolumny
    const existingColumns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kuriers' 
      AND table_schema = 'public'
    `)
    
    const existingColumnNames = existingColumns.rows.map(row => row.column_name)
    console.log('📋 Istniejące kolumny:', existingColumnNames)

    // Dodaj każdą kolumnę pojedynczo
    for (const columnDef of columnsToAdd) {
      const columnName = columnDef.split(' ')[0]
      
      if (existingColumnNames.includes(columnName)) {
        skippedColumns.push(columnName)
        continue
      }

      try {
        await db.raw(`ALTER TABLE kuriers ADD COLUMN ${columnDef}`)
        addedColumns.push(columnName)
        console.log(`✅ Dodano kolumnę: ${columnName}`)
      } catch (columnError) {
        console.error(`❌ Błąd dodawania kolumny ${columnName}:`, columnError.message)
      }
    }

    // Sprawdź czy wszystko się udało
    const finalColumns = await db.raw(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'kuriers' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `)

    return NextResponse.json({
      success: true,
      message: 'Migracja tabeli kuriers zakończona',
      results: {
        addedColumns: addedColumns.length,
        skippedColumns: skippedColumns.length,
        totalColumns: finalColumns.rows.length,
        added: addedColumns,
        skipped: skippedColumns,
        finalStructure: finalColumns.rows.map(r => r.column_name)
      }
    })

  } catch (error) {
    console.error('❌ Błąd migracji:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Błąd migracji: ' + error.message,
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
