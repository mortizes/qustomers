import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { outscraperService } from '@/lib/outscraperService';
import { validateGoogleMapsData, logValidationResults } from '@/lib/dataValidator';

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 10 } = await request.json();
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log(`🚀 Procesando lote pequeño de ${batchSize} registros...`);

    // 1. Obtener registros pendientes
    console.log(`🔍 Obteniendo registros pendientes de Metabase...`);
    const pendingUrl = `${baseUrl}/rest/v1/metabase_customers?google_maps_processed=is.null&select=id,name,address,phone&limit=${batchSize}`;
    console.log(`📡 URL de consulta: ${pendingUrl}`);
    
    const pendingResponse = await fetch(pendingUrl, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 Respuesta de Metabase:`, {
      status: pendingResponse.status,
      statusText: pendingResponse.statusText,
      ok: pendingResponse.ok
    });

    if (!pendingResponse.ok) {
      const errorText = await pendingResponse.text();
      console.error(`❌ Error obteniendo registros pendientes:`, errorText);
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo registros pendientes',
        details: { 
          status: pendingResponse.status, 
          statusText: pendingResponse.statusText,
          body: errorText,
          url: pendingUrl
        }
      }, { status: 500 });
    }

    const pendingRecords = await pendingResponse.json();
    console.log(`📋 Registros pendientes obtenidos: ${pendingRecords.length}`);

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay registros pendientes para procesar',
        results: []
      });
    }

    // 2. Procesar con Outscraper
    const addresses = pendingRecords.map(record => record.address || record.name);
    console.log(`📡 Enviando ${addresses.length} direcciones a Outscraper...`);
    
    const outscraperResults = await outscraperService.searchGoogleMaps(addresses);
    console.log(`📊 Resultados de Outscraper: ${outscraperResults.length} registros`);

    // 3. Procesar cada registro
    const results = [];
    
    for (let i = 0; i < pendingRecords.length; i++) {
      const record = pendingRecords[i];
      const outscraperData = outscraperResults[i];
      
      console.log(`\n🔄 Procesando registro ${i + 1}/${pendingRecords.length}:`);
      console.log(`   📋 Metabase ID: ${record.id}`);
      console.log(`   📝 Nombre: ${record.name}`);
      console.log(`   📍 Dirección: ${record.address}`);
      
      try {
        if (!outscraperData) {
          console.log(`   ⚠️ No se encontraron datos de Outscraper para este registro`);
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'not_found',
            error: 'No se encontraron datos de Outscraper'
          });
          continue;
        }

        // Crear datos para Supabase
        const updateData = {
          metabase_id: record.id, // ¡CRÍTICO: Usar el ID de Metabase correcto!
          name: outscraperData.name || record.name,
          site: outscraperData.site,
          subtypes: outscraperData.subtypes,
          category: outscraperData.category,
          phone: outscraperData.phone || record.phone,
          full_address: outscraperData.full_address || record.address,
          borough: outscraperData.borough,
          street: outscraperData.street,
          city: outscraperData.city,
          postal_code: outscraperData.postal_code,
          state: outscraperData.state,
          country: outscraperData.country,
          latitude: outscraperData.latitude,
          longitude: outscraperData.longitude,
          rating: outscraperData.rating,
          reviews: outscraperData.reviews,
          reviews_per_score: outscraperData.reviews_per_score,
          photos_count: outscraperData.photos_count,
          photo: outscraperData.photo,
          working_hours: outscraperData.working_hours,
          about: outscraperData.about,
          range: outscraperData.range,
          prices: outscraperData.prices,
          description: outscraperData.description,
          typical_time_spent: outscraperData.typical_time_spent,
          verified: outscraperData.verified,
          reservation_links: outscraperData.reservation_links,
          booking_appointment_link: outscraperData.booking_appointment_link,
          menu_link: outscraperData.menu_link,
          order_links: outscraperData.order_links,
          location_link: outscraperData.location_link,
          place_id: outscraperData.place_id,
          google_id: outscraperData.google_id,
          cid: outscraperData.cid,
          kgmid: outscraperData.kgmid,
          reviews_id: outscraperData.reviews_id,
          updated_at: new Date().toISOString()
        };

        console.log(`   🔍 Validando datos para Metabase ID: ${record.id}...`);
        
        // Validar y sanitizar los datos
        const validation = validateGoogleMapsData(updateData);
        logValidationResults(record.id, validation, updateData);
        
        if (!validation.isValid) {
          console.error(`   ❌ Datos inválidos para registro ${record.id}:`, validation.errors);
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'validation_failed',
            error: validation.errors.join(', ')
          });
          continue;
        }
        
        // Usar los datos sanitizados
        const sanitizedData = validation.sanitizedData;
        console.log(`   ✅ Datos validados y sanitizados para Metabase ID: ${record.id}`);

        // Verificar que el Metabase ID coincida
        if (sanitizedData.metabase_id !== record.id) {
          console.error(`   🚨 ERROR CRÍTICO: Metabase ID no coincide!`);
          console.error(`   📋 Esperado: ${record.id}`);
          console.error(`   📊 Encontrado: ${sanitizedData.metabase_id}`);
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'id_mismatch',
            error: `Metabase ID no coincide: esperado ${record.id}, encontrado ${sanitizedData.metabase_id}`
          });
          continue;
        }

        // Insertar en google_maps
        console.log(`   📤 Insertando en google_maps con Metabase ID: ${record.id}...`);
        const createResponse = await fetch(`${baseUrl}/rest/v1/google_maps`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(sanitizedData),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error(`   ❌ Error insertando registro ${record.id}:`, errorText);
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'failed',
            error: errorText
          });
          continue;
        }

        console.log(`   ✅ Registro ${record.id} insertado exitosamente en google_maps`);

        // Marcar como procesado en Metabase
        const updateMetabaseResponse = await fetch(`${baseUrl}/rest/v1/metabase_customers?id=eq.${record.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ google_maps_processed: true }),
        });

        if (!updateMetabaseResponse.ok) {
          console.error(`   ⚠️ Error marcando como procesado en Metabase: ${record.id}`);
        } else {
          console.log(`   ✅ Registro ${record.id} marcado como procesado en Metabase`);
        }

        results.push({
          recordId: record.id,
          name: record.name,
          status: 'success',
          placeId: outscraperData.place_id
        });

      } catch (error) {
        console.error(`   💥 Error procesando registro ${record.id}:`, error);
        results.push({
          recordId: record.id,
          name: record.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // 4. Resumen de resultados
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const notFoundCount = results.filter(r => r.status === 'not_found').length;
    const validationFailedCount = results.filter(r => r.status === 'validation_failed').length;
    const idMismatchCount = results.filter(r => r.status === 'id_mismatch').length;

    console.log(`\n📊 RESUMEN DEL LOTE PEQUEÑO:`);
    console.log(`   📋 Total procesados: ${results.length}`);
    console.log(`   ✅ Exitosos: ${successCount}`);
    console.log(`   ❌ Fallidos: ${failedCount}`);
    console.log(`   ⚠️ No encontrados: ${notFoundCount}`);
    console.log(`   🔍 Validación fallida: ${validationFailedCount}`);
    console.log(`   🚨 ID no coincide: ${idMismatchCount}`);

    return NextResponse.json({
      success: true,
      message: `Lote pequeño procesado: ${successCount} exitosos, ${failedCount} fallidos`,
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: failedCount,
        notFound: notFoundCount,
        validationFailed: validationFailedCount,
        idMismatch: idMismatchCount
      }
    });

  } catch (error) {
    console.error('💥 Error procesando lote pequeño:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
