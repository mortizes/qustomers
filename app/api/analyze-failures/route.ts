import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const { recordIds } = await request.json();
    
    if (!recordIds || !Array.isArray(recordIds)) {
      return NextResponse.json({ error: 'recordIds es requerido como array' }, { status: 400 });
    }

    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log(`🔍 Analizando ${recordIds.length} registros fallidos...`);

    const analysis = {
      totalRecords: recordIds.length,
      foundRecords: 0,
      notFoundRecords: 0,
      dataIssues: [],
      commonProblems: {
        missingFields: [],
        invalidTypes: [],
        longStrings: [],
        invalidJson: []
      }
    };

    // Analizar cada registro fallido
    for (const recordId of recordIds) {
      try {
        // Obtener datos de Metabase
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
          analysis.notFoundRecords++;
          continue;
        }

        const metabaseData = await metabaseResponse.json();
        if (metabaseData.length === 0) {
          analysis.notFoundRecords++;
          continue;
        }

        analysis.foundRecords++;
        const record = metabaseData[0];

        // Simular datos de Outscraper (como los que están fallando)
        const outscraperData = {
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
          latitude: '40.4168', // String problemático
          longitude: '-3.7038', // String problemático
          rating: '4.5', // String problemático
          reviews: '100', // String problemático
          reviews_per_score: { 5: 80, 4: 15, 3: 3, 2: 1, 1: 1 },
          photos_count: '25', // String problemático
          photo: 'https://example.com/photo.jpg',
          working_hours: { monday: '9:00-22:00', tuesday: '9:00-22:00' },
          about: 'Test restaurant description',
          range: '€€',
          prices: 'Moderate',
          description: 'Test restaurant description',
          typical_time_spent: '1-2 hours',
          verified: 'true', // String problemático
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

        // Crear datos para Supabase
        const updateData = {
          metabase_id: recordId,
          ...outscraperData,
          updated_at: new Date().toISOString()
        };

        // Intentar insertar y capturar el error específico
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

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          
          const dataIssue = {
            recordId,
            name: record.name,
            status: createResponse.status,
            error: errorText,
            problematicFields: identifyProblematicFields(updateData, errorText)
          };

          analysis.dataIssues.push(dataIssue);

          // Categorizar problemas comunes
          if (errorText.includes('invalid input syntax')) {
            analysis.commonProblems.invalidTypes.push(recordId);
          }
          if (errorText.includes('value too long')) {
            analysis.commonProblems.longStrings.push(recordId);
          }
          if (errorText.includes('invalid json')) {
            analysis.commonProblems.invalidJson.push(recordId);
          }
          if (errorText.includes('not-null constraint')) {
            analysis.commonProblems.missingFields.push(recordId);
          }
        } else {
          // Si funciona, limpiar
          await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${recordId}`, {
            method: 'DELETE',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
          });
        }

      } catch (error) {
        console.error(`Error analizando registro ${recordId}:`, error);
      }
    }

    console.log(`📊 Análisis completado:`, analysis);

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('💥 Error en análisis de fallos:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}

function identifyProblematicFields(data: any, errorText: string): string[] {
  const problematicFields: string[] = [];
  
  // Buscar campos problemáticos en el error
  if (errorText.includes('latitude')) problematicFields.push('latitude');
  if (errorText.includes('longitude')) problematicFields.push('longitude');
  if (errorText.includes('rating')) problematicFields.push('rating');
  if (errorText.includes('reviews')) problematicFields.push('reviews');
  if (errorText.includes('photos_count')) problematicFields.push('photos_count');
  if (errorText.includes('verified')) problematicFields.push('verified');
  if (errorText.includes('reviews_per_score')) problematicFields.push('reviews_per_score');
  if (errorText.includes('working_hours')) problematicFields.push('working_hours');
  if (errorText.includes('about')) problematicFields.push('about');
  if (errorText.includes('prices')) problematicFields.push('prices');
  if (errorText.includes('reservation_links')) problematicFields.push('reservation_links');
  if (errorText.includes('order_links')) problematicFields.push('order_links');
  
  return problematicFields;
}
