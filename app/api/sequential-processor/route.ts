import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { outscraperService } from '@/lib/outscraperService';
import { validateGoogleMapsData, logValidationResults } from '@/lib/dataValidator';

interface ProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  notFound: number;
  validationFailed: number;
  idMismatch: number;
  startTime: Date;
  currentRecord?: {
    id: string;
    name: string;
    status: string;
  };
}

// Función para analizar errores específicos de Supabase
function analyzeSupabaseError(errorText: string, data: any, recordId: string) {
  console.log(`🔍 ANÁLISIS DE ERROR SUPABASE para registro ${recordId}:`);
  
  if (errorText.includes('invalid input syntax')) {
    console.log(`   🚨 ERROR: Sintaxis de entrada inválida`);
    if (errorText.includes('latitude')) {
      console.log(`   📍 Problema con latitude: "${data.latitude}" (tipo: ${typeof data.latitude})`);
    }
    if (errorText.includes('longitude')) {
      console.log(`   📍 Problema con longitude: "${data.longitude}" (tipo: ${typeof data.longitude})`);
    }
    if (errorText.includes('rating')) {
      console.log(`   ⭐ Problema con rating: "${data.rating}" (tipo: ${typeof data.rating})`);
    }
    if (errorText.includes('reviews')) {
      console.log(`   💬 Problema con reviews: "${data.reviews}" (tipo: ${typeof data.reviews})`);
    }
    if (errorText.includes('photos_count')) {
      console.log(`   📸 Problema con photos_count: "${data.photos_count}" (tipo: ${typeof data.photos_count})`);
    }
    if (errorText.includes('verified')) {
      console.log(`   ✅ Problema con verified: "${data.verified}" (tipo: ${typeof data.verified})`);
    }
  }
  
  if (errorText.includes('value too long')) {
    console.log(`   🚨 ERROR: Valor demasiado largo`);
    const longFields = Object.keys(data).filter(key => {
      const value = data[key];
      return typeof value === 'string' && value.length > 1000;
    });
    if (longFields.length > 0) {
      console.log(`   📏 Campos demasiado largos: ${longFields.join(', ')}`);
    }
  }
  
  if (errorText.includes('invalid json')) {
    console.log(`   🚨 ERROR: JSON inválido`);
    const jsonFields = ['reviews_per_score', 'working_hours', 'about', 'reservation_links', 'order_links'];
    jsonFields.forEach(field => {
      if (data[field]) {
        try {
          JSON.parse(data[field]);
        } catch (e) {
          console.log(`   📄 Campo JSON inválido: ${field} = "${data[field]}"`);
        }
      }
    });
  }
  
  if (errorText.includes('not-null constraint')) {
    console.log(`   🚨 ERROR: Restricción not-null`);
    console.log(`   🔍 Campos requeridos faltantes o nulos`);
  }
  
  if (errorText.includes('unique constraint')) {
    console.log(`   🚨 ERROR: Restricción de unicidad`);
    console.log(`   🔍 Posible duplicado en place_id: "${data.place_id}"`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      maxRecords = 50, 
      delayBetweenRecords = 2000, // 2 segundos entre registros
      stopOnError = false 
    } = await request.json();
    
    const baseUrl = config.supabase.url;
    const serviceKey = config.supabase.serviceRoleKey;

    console.log(`🚀 INICIANDO PROCESAMIENTO SECUENCIAL AUTOMÁTICO`);
    console.log(`📊 Configuración:`);
    console.log(`   • Máximo de registros: ${maxRecords}`);
    console.log(`   • Delay entre registros: ${delayBetweenRecords}ms`);
    console.log(`   • Parar en error: ${stopOnError}`);

    const stats: ProcessingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      notFound: 0,
      validationFailed: 0,
      idMismatch: 0,
      startTime: new Date()
    };

    const results = [];

    // Procesar registros uno por uno
    for (let i = 0; i < maxRecords; i++) {
      console.log(`\n🔄 PROCESANDO REGISTRO ${i + 1}/${maxRecords}`);
      
      try {
        // 1. Obtener UN registro pendiente
        const pendingUrl = `${baseUrl}/rest/v1/metabase?google_maps_processed=is.null&select=id,name,address,phone&limit=1`;
        const pendingResponse = await fetch(pendingUrl, {
          method: 'GET',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!pendingResponse.ok) {
          const errorText = await pendingResponse.text();
          console.error(`❌ Error obteniendo registro pendiente:`, errorText);
          throw new Error(`Error obteniendo registro pendiente: ${errorText}`);
        }

        const pendingRecords = await pendingResponse.json();
        
        if (pendingRecords.length === 0) {
          console.log(`✅ No hay más registros pendientes. Procesamiento completado.`);
          break;
        }

        const record = pendingRecords[0];
        stats.currentRecord = {
          id: record.id,
          name: record.name,
          status: 'processing'
        };

        console.log(`📋 Registro encontrado:`);
        console.log(`   🆔 ID: ${record.id}`);
        console.log(`   📝 Nombre: ${record.name}`);
        console.log(`   📍 Dirección: ${record.address}`);
        console.log(`   📞 Teléfono: ${record.phone || 'N/A'}`);

        // 2. Procesar con Outscraper (UNO por vez)
        const address = record.address || record.name;
        console.log(`📡 Enviando dirección a Outscraper: "${address}"`);
        
        const outscraperResults = await outscraperService.searchGoogleMaps([address]);
        const outscraperData = outscraperResults[0];
        
        if (!outscraperData) {
          console.log(`⚠️ No se encontraron datos de Outscraper para: "${address}"`);
          stats.notFound++;
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'not_found',
            error: 'No se encontraron datos de Outscraper',
            timestamp: new Date().toISOString()
          });
          
          // Marcar como procesado (aunque no se encontraron datos)
          await markAsProcessed(record.id, baseUrl, serviceKey);
          continue;
        }

        console.log(`✅ Datos de Outscraper obtenidos:`);
        console.log(`   📝 Nombre: ${outscraperData.name}`);
        console.log(`   📍 Place ID: ${outscraperData.place_id}`);
        console.log(`   ⭐ Rating: ${outscraperData.rating}`);
        console.log(`   💬 Reviews: ${outscraperData.reviews}`);

        // 3. Crear datos para Supabase
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

        // 4. Validar y sanitizar los datos
        console.log(`🔍 Validando datos para Metabase ID: ${record.id}...`);
        const validation = validateGoogleMapsData(updateData);
        logValidationResults(record.id, validation, updateData);
        
        if (!validation.isValid) {
          console.error(`❌ Datos inválidos para registro ${record.id}:`, validation.errors);
          stats.validationFailed++;
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'validation_failed',
            error: validation.errors.join(', '),
            timestamp: new Date().toISOString()
          });
          
          if (stopOnError) {
            throw new Error(`Validación fallida: ${validation.errors.join(', ')}`);
          }
          
          // Marcar como procesado (aunque falló la validación)
          await markAsProcessed(record.id, baseUrl, serviceKey);
          continue;
        }
        
        // Usar los datos sanitizados
        const sanitizedData = validation.sanitizedData;
        console.log(`✅ Datos validados y sanitizados para Metabase ID: ${record.id}`);

        // 5. Verificar que el Metabase ID coincida
        if (sanitizedData.metabase_id !== record.id) {
          console.error(`🚨 ERROR CRÍTICO: Metabase ID no coincide!`);
          console.error(`   📋 Esperado: ${record.id}`);
          console.error(`   📊 Encontrado: ${sanitizedData.metabase_id}`);
          stats.idMismatch++;
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'id_mismatch',
            error: `Metabase ID no coincide: esperado ${record.id}, encontrado ${sanitizedData.metabase_id}`,
            timestamp: new Date().toISOString()
          });
          
          if (stopOnError) {
            throw new Error(`Metabase ID no coincide: esperado ${record.id}, encontrado ${sanitizedData.metabase_id}`);
          }
          
          // Marcar como procesado (aunque falló la verificación)
          await markAsProcessed(record.id, baseUrl, serviceKey);
          continue;
        }

        // 6. Insertar en google_maps
        console.log(`📤 Insertando en google_maps con Metabase ID: ${record.id}...`);
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
          console.error(`❌ Error insertando registro ${record.id}:`, errorText);
          analyzeSupabaseError(errorText, sanitizedData, record.id);
          
          stats.failed++;
          results.push({
            recordId: record.id,
            name: record.name,
            status: 'failed',
            error: errorText,
            timestamp: new Date().toISOString()
          });
          
          if (stopOnError) {
            throw new Error(`Error insertando en Supabase: ${errorText}`);
          }
          
          // Marcar como procesado (aunque falló la inserción)
          await markAsProcessed(record.id, baseUrl, serviceKey);
          continue;
        }

        console.log(`✅ Registro ${record.id} insertado exitosamente en google_maps`);

        // 7. Marcar como procesado en Metabase
        await markAsProcessed(record.id, baseUrl, serviceKey);

        stats.successful++;
        results.push({
          recordId: record.id,
          name: record.name,
          status: 'success',
          placeId: outscraperData.place_id,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ Registro ${record.id} procesado exitosamente`);

        // 8. Delay entre registros (excepto en el último)
        if (i < maxRecords - 1) {
          console.log(`⏳ Esperando ${delayBetweenRecords}ms antes del siguiente registro...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenRecords));
        }

      } catch (error) {
        console.error(`💥 Error procesando registro ${i + 1}:`, error);
        stats.failed++;
        
        if (stats.currentRecord) {
          results.push({
            recordId: stats.currentRecord.id,
            name: stats.currentRecord.name,
            status: 'error',
            error: error instanceof Error ? error.message : 'Error desconocido',
            timestamp: new Date().toISOString()
          });
        }
        
        if (stopOnError) {
          throw error;
        }
      }
      
      stats.totalProcessed++;
    }

    // 9. Resumen final
    const endTime = new Date();
    const duration = endTime.getTime() - stats.startTime.getTime();
    const durationMinutes = Math.round(duration / 60000 * 100) / 100;

    console.log(`\n🎯 PROCESAMIENTO SECUENCIAL COMPLETADO`);
    console.log(`⏱️ Duración: ${durationMinutes} minutos`);
    console.log(`📊 Estadísticas finales:`);
    console.log(`   📋 Total procesados: ${stats.totalProcessed}`);
    console.log(`   ✅ Exitosos: ${stats.successful}`);
    console.log(`   ❌ Fallidos: ${stats.failed}`);
    console.log(`   ⚠️ No encontrados: ${stats.notFound}`);
    console.log(`   🔍 Validación fallida: ${stats.validationFailed}`);
    console.log(`   🚨 ID no coincide: ${stats.idMismatch}`);

    return NextResponse.json({
      success: true,
      message: `Procesamiento secuencial completado: ${stats.successful} exitosos, ${stats.failed} fallidos`,
      stats: {
        ...stats,
        endTime,
        duration: durationMinutes,
        successRate: stats.totalProcessed > 0 ? Math.round((stats.successful / stats.totalProcessed) * 100) : 0
      },
      results
    });

  } catch (error) {
    console.error('💥 Error en procesamiento secuencial:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// Función auxiliar para marcar como procesado
async function markAsProcessed(recordId: string, baseUrl: string, serviceKey: string) {
  try {
    const updateResponse = await fetch(`${baseUrl}/rest/v1/metabase?id=eq.${recordId}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ google_maps_processed: true }),
    });

    if (!updateResponse.ok) {
      console.error(`⚠️ Error marcando como procesado en Metabase: ${recordId}`);
    } else {
      console.log(`✅ Registro ${recordId} marcado como procesado en Metabase`);
    }
  } catch (error) {
    console.error(`💥 Error marcando como procesado: ${recordId}`, error);
  }
}
