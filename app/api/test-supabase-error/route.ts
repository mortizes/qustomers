import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const { metabaseId } = await request.json();
    
    if (!metabaseId) {
      return NextResponse.json({ error: 'metabaseId es requerido' }, { status: 400 });
    }

    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    // Datos de prueba simplificados
    const testData = {
      metabase_id: metabaseId,
      name: 'Test Restaurant',
      place_id: 'test_place_id_123',
      full_address: 'Test Address 123',
      city: 'Test City',
      latitude: 40.4168,
      longitude: -3.7038,
      rating: 4.5,
      reviews: 100,
      updated_at: new Date().toISOString(),
    };

    console.log('🧪 Probando inserción en Supabase con datos:', testData);

    // Intentar crear un registro de prueba
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
    console.log('  Headers:', Object.fromEntries(createResponse.headers.entries()));

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Error response body:', errorText);
      
      return NextResponse.json({
        success: false,
        error: 'Error en Supabase',
        details: {
          status: createResponse.status,
          statusText: createResponse.statusText,
          body: errorText,
          headers: Object.fromEntries(createResponse.headers.entries())
        }
      }, { status: 500 });
    }

    // Si llegamos aquí, la inserción fue exitosa
    console.log('✅ Inserción exitosa');
    
    // Limpiar el registro de prueba
    const deleteResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${metabaseId}`, {
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
      message: 'Test exitoso - Supabase funciona correctamente'
    });

  } catch (error) {
    console.error('💥 Error en test de Supabase:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
