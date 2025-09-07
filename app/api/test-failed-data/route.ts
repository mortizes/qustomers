import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { validateGoogleMapsData } from '@/lib/dataValidator';

export async function POST(request: NextRequest) {
  try {
    const { recordId, name, placeId, errorDetails } = await request.json();
    
    if (!recordId || !placeId) {
      return NextResponse.json({ error: 'recordId y placeId son requeridos' }, { status: 400 });
    }

    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    // Simular datos de Outscraper basados en los que fallaron
    const mockOutscraperData = {
      name: name || 'Test Restaurant',
      site: 'https://example.com',
      subtypes: 'restaurant',
      category: 'restaurants',
      phone: '+34 123 456 789',
      full_address: 'Test Address 123, Test City',
      borough: 'Test Borough',
      street: 'Test Street',
      city: 'Test City',
      postal_code: '12345',
      state: 'Test State',
      country: 'Spain',
      latitude: 40.4168,
      longitude: -3.7038,
      rating: 4.5,
      reviews: 100,
      reviews_per_score: { 5: 80, 4: 15, 3: 3, 2: 1, 1: 1 },
      photos_count: 25,
      photo: 'https://example.com/photo.jpg',
      working_hours: { monday: '9:00-22:00', tuesday: '9:00-22:00' },
      about: 'Test restaurant description',
      range: '€€',
      prices: 'Moderate',
      description: 'Test restaurant description',
      typical_time_spent: '1-2 hours',
      verified: true,
      reservation_links: ['https://example.com/reserve'],
      booking_appointment_link: 'https://example.com/book',
      menu_link: 'https://example.com/menu',
      order_links: ['https://example.com/order'],
      location_link: 'https://maps.google.com/test',
      place_id: placeId,
      google_id: 'test_google_id',
      cid: 'test_cid',
      kgmid: 'test_kgmid',
      reviews_id: 'test_reviews_id'
    };

    console.log('🧪 Probando datos fallidos con validación...');
    console.log('📊 Datos originales:', mockOutscraperData);

    // Validar los datos
    const validation = validateGoogleMapsData({
      metabase_id: 'test_metabase_id',
      ...mockOutscraperData,
      updated_at: new Date().toISOString()
    });

    console.log('🔍 Resultado de validación:', {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    });

    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Datos inválidos después de validación',
        details: {
          errors: validation.errors,
          warnings: validation.warnings,
          originalData: mockOutscraperData,
          sanitizedData: validation.sanitizedData
        }
      }, { status: 400 });
    }

    // Intentar insertar en Supabase con datos sanitizados
    const testData = {
      metabase_id: 'test_metabase_id_' + Date.now(),
      ...validation.sanitizedData
    };

    console.log('📤 Enviando datos sanitizados a Supabase:', testData);

    const createResponse = await fetch(`${baseUrl}/rest/v1/google_maps`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(testData),
    });

    console.log('📊 Respuesta de Supabase:');
    console.log('  Status:', createResponse.status);
    console.log('  StatusText:', createResponse.statusText);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Error response body:', errorText);
      
      return NextResponse.json({
        success: false,
        error: 'Error en Supabase con datos sanitizados',
        details: {
          status: createResponse.status,
          statusText: createResponse.statusText,
          body: errorText,
          sanitizedData: testData,
          validation: {
            errors: validation.errors,
            warnings: validation.warnings
          }
        }
      }, { status: 500 });
    }

    // Si llegamos aquí, la inserción fue exitosa
    console.log('✅ Inserción exitosa con datos sanitizados');
    
    // Limpiar el registro de prueba
    const deleteResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${testData.metabase_id}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    });

    console.log('🧹 Limpieza:', deleteResponse.ok ? 'Exitosa' : 'Fallida');

    return NextResponse.json({
      success: true,
      message: 'Test exitoso - Los datos se pueden procesar correctamente después de la validación',
      details: {
        validation: {
          errors: validation.errors,
          warnings: validation.warnings
        },
        sanitizedData: testData
      }
    });

  } catch (error) {
    console.error('💥 Error en test de datos fallidos:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
