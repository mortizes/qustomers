import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const { recordId } = await request.json();
    
    if (!recordId) {
      return NextResponse.json({ error: 'recordId es requerido' }, { status: 400 });
    }

    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log(`🔍 Debugging registro fallido: ${recordId}`);

    // 1. Obtener el registro de Metabase
    const metabaseUrl = `${baseUrl}/rest/v1/metabase_customers?id=eq.${recordId}&select=*`;
    const metabaseResponse = await fetch(metabaseUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!metabaseResponse.ok) {
      const errorText = await metabaseResponse.text();
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos de Metabase',
        details: { status: metabaseResponse.status, body: errorText }
      }, { status: 500 });
    }

    const metabaseData = await metabaseResponse.json();
    console.log(`📊 Datos de Metabase:`, metabaseData);

    if (metabaseData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Registro no encontrado en Metabase',
        details: { recordId }
      }, { status: 404 });
    }

    const record = metabaseData[0];
    console.log(`📋 Registro encontrado:`, {
      id: record.id,
      name: record.name,
      address: record.address,
      phone: record.phone
    });

    // 2. Simular datos de Outscraper (datos problemáticos típicos)
    const problematicData = {
      name: record.name || 'Test Restaurant',
      site: 'https://example.com',
      subtypes: 'restaurant',
      category: 'restaurants',
      phone: record.phone || '+34 123 456 789',
      full_address: record.address || 'Test Address 123, Test City',
      borough: 'Test Borough',
      street: 'Test Street',
      city: 'Test City',
      postal_code: '12345',
      state: 'Test State',
      country: 'Spain',
      latitude: '40.4168', // String en lugar de number
      longitude: '-3.7038', // String en lugar de number
      rating: '4.5', // String en lugar de number
      reviews: '100', // String en lugar de number
      reviews_per_score: { 5: 80, 4: 15, 3: 3, 2: 1, 1: 1 },
      photos_count: '25', // String en lugar de number
      photo: 'https://example.com/photo.jpg',
      working_hours: { monday: '9:00-22:00', tuesday: '9:00-22:00' },
      about: 'Test restaurant description',
      range: '€€',
      prices: 'Moderate',
      description: 'Test restaurant description',
      typical_time_spent: '1-2 hours',
      verified: 'true', // String en lugar de boolean
      reservation_links: ['https://example.com/reserve'],
      booking_appointment_link: 'https://example.com/book',
      menu_link: 'https://example.com/menu',
      order_links: ['https://example.com/order'],
      location_link: 'https://maps.google.com/test',
      place_id: 'test_place_id_' + Date.now(),
      google_id: 'test_google_id',
      cid: 'test_cid',
      kgmid: 'test_kgmid',
      reviews_id: 'test_reviews_id'
    };

    console.log(`🧪 Datos problemáticos simulados:`, problematicData);

    // 3. Crear datos para Supabase
    const updateData = {
      metabase_id: recordId,
      ...problematicData,
      updated_at: new Date().toISOString()
    };

    console.log(`📤 Datos para Supabase:`, updateData);

    // 4. Intentar insertar directamente (sin validación)
    const createResponse = await fetch(`${baseUrl}/rest/v1/google_maps`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(updateData),
    });

    console.log(`📊 Respuesta de Supabase:`, {
      status: createResponse.status,
      statusText: createResponse.statusText
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log(`❌ Error de Supabase:`, errorText);
      
      return NextResponse.json({
        success: false,
        error: 'Error en Supabase',
        details: {
          status: createResponse.status,
          statusText: createResponse.statusText,
          body: errorText,
          data: updateData
        }
      }, { status: 500 });
    }

    // 5. Limpiar el registro de prueba
    const deleteResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${recordId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
    });

    console.log(`🧹 Limpieza:`, deleteResponse.ok ? 'Exitosa' : 'Fallida');

    return NextResponse.json({
      success: true,
      message: 'Test exitoso - Los datos se insertaron correctamente',
      details: {
        metabaseData: record,
        testData: updateData
      }
    });

  } catch (error) {
    console.error('💥 Error en debug de datos fallidos:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
