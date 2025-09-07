import { NextRequest } from 'next/server';
import { config } from '@/lib/config';
import { outscraperService } from '@/lib/outscraperService';
import { validateGoogleMapsData, logValidationResults } from '@/lib/dataValidator';

// Función para analizar errores específicos de Supabase
function analyzeSupabaseError(errorText: string, data: any, recordId: string) {
  if (errorText.includes('invalid input syntax')) {
    if (errorText.includes('latitude')) {
      return `Problema con latitude: "${data.latitude}" (tipo: ${typeof data.latitude})`;
    }
    if (errorText.includes('longitude')) {
      return `Problema con longitude: "${data.longitude}" (tipo: ${typeof data.longitude})`;
    }
    if (errorText.includes('rating')) {
      return `Problema con rating: "${data.rating}" (tipo: ${typeof data.rating})`;
    }
    if (errorText.includes('reviews')) {
      return `Problema con reviews: "${data.reviews}" (tipo: ${typeof data.reviews})`;
    }
    if (errorText.includes('photos_count')) {
      return `Problema con photos_count: "${data.photos_count}" (tipo: ${typeof data.photos_count})`;
    }
    if (errorText.includes('verified')) {
      return `Problema con verified: "${data.verified}" (tipo: ${typeof data.verified})`;
    }
  }
  
  if (errorText.includes('value too long')) {
    return 'Valor demasiado largo';
  }
  
  if (errorText.includes('invalid json')) {
    return 'JSON inválido';
  }
  
  if (errorText.includes('not-null constraint')) {
    return 'Restricción not-null';
  }
  
  if (errorText.includes('unique constraint')) {
    return 'Restricción de unicidad';
  }
  
  return 'Error desconocido';
}

export async function POST(request: NextRequest) {
  const { 
    maxRecords = 50, 
    delayBetweenRecords = 2000,
    stopOnError = false 
  } = await request.json();
  
  const baseUrl = config.supabase.url;
  const serviceKey = config.supabase.serviceRoleKey;

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (type: string, data: any) => {
        const event = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
        controller.enqueue(encoder.encode(event));
      };

      try {
        sendEvent('start', { 
          message: 'Iniciando procesamiento secuencial',
          maxRecords,
          delayBetweenRecords,
          stopOnError
        });

        const stats = {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          notFound: 0,
          validationFailed: 0,
          idMismatch: 0,
          startTime: new Date().toISOString()
        };

        // Procesar registros uno por uno
        for (let i = 0; i < maxRecords; i++) {
          sendEvent('progress', {
            current: i + 1,
            total: maxRecords,
            stats: { ...stats }
          });

          try {
            // 1. Obtener UN registro pendiente (usando el endpoint que funciona)
            const baseUrlForApi = request.url.split('/api/')[0];
            const pendingUrl = `${baseUrlForApi}/api/google-maps-pending?onlyPending=true&limit=1`;
            const pendingResponse = await fetch(pendingUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (!pendingResponse.ok) {
              const errorText = await pendingResponse.text();
              throw new Error(`Error obteniendo registro pendiente: ${errorText}`);
            }

            const pendingData = await pendingResponse.json();
            
            if (!pendingData.success || !pendingData.data) {
              throw new Error('Error obteniendo registros pendientes');
            }
            
            const pendingRecords = pendingData.data;
            
            if (pendingRecords.length === 0) {
              sendEvent('complete', {
                message: 'No hay más registros pendientes',
                stats: { ...stats }
              });
              break;
            }

            const record = pendingRecords[0];
            
            // Verificar que tenga datos de customer (igual que el procesamiento manual)
            if (!record.customer_data || record.customer_data === null) {
              sendEvent('not_found', {
                recordId: record.id,
                name: record.name,
                error: 'No tiene datos de customer'
              });
              
              stats.notFound++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }
            
            // Extraer datos del customer_data (igual que el procesamiento manual)
            const customerData = record.customer_data;
            const customerName = customerData.name || record.name;
            const customerAddress = customerData.address || '';
            const customerCity = customerData.city || '';
            const customerPhone = customerData.phone;
            
            sendEvent('processing', {
              recordId: record.id,
              metabaseId: record.metabase_id,
              name: customerName,
              address: customerAddress,
              phone: customerPhone
            });

            // 2. Procesar con Outscraper (igual que el procesamiento manual)
            console.log(`🔍 Procesando lugar: "${customerName}"`);
            console.log(`📍 Dirección original: "${customerAddress}"`);
            console.log(`🏙️ Ciudad: "${customerCity}"`);
            
            // Mejorar la dirección: si no termina con la ciudad, añadirla (igual que el procesamiento manual)
            let finalAddress = customerAddress;
            if (customerCity && customerAddress && !customerAddress.toLowerCase().includes(customerCity.toLowerCase())) {
              finalAddress = `${customerAddress}, ${customerCity}`;
              console.log(`✅ Dirección mejorada: "${finalAddress}"`);
            } else {
              console.log(`ℹ️ Dirección ya incluye ciudad o no necesita mejora`);
            }
            
            // Evitar duplicación de ciudad en la query final
            const searchAddress = finalAddress.toLowerCase().includes(customerCity.toLowerCase()) ? finalAddress : `${finalAddress}, ${customerCity}`;
            console.log(`🎯 Dirección final: "${searchAddress}"`);
            
            const outscraperData = await outscraperService.searchSinglePlace(customerName, finalAddress, customerCity);
            
            if (!outscraperData) {
              sendEvent('not_found', {
                recordId: record.id,
                name: record.name,
                error: 'No se encontraron datos de Outscraper'
              });
              
              stats.notFound++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }

            // 3. Crear datos para Supabase (igual que el procesamiento manual)
            const updateData = {
              // IDs únicos - PRESERVAR metabase_id del registro original
              metabase_id: record.metabase_id,
              place_id: outscraperData.place_id || null,
              google_id: outscraperData.google_id || null,
              cid: outscraperData.cid || null,
              kgmid: outscraperData.kgmid || null,
              reviews_id: outscraperData.reviews_id || null,
              
              // Información básica
              name: outscraperData.name || customerName,
              phone: outscraperData.phone || customerPhone,
              site: outscraperData.site || null,
              
              // Categorías y tipos
              category: outscraperData.category || null,
              subtypes: outscraperData.subtypes || null,
              
              // Dirección completa
              full_address: outscraperData.full_address || customerAddress,
              borough: outscraperData.borough || null,
              street: outscraperData.street || null,
              city: outscraperData.city || customerCity,
              postal_code: outscraperData.postal_code || null,
              state: outscraperData.state || null,
              country: outscraperData.country || null,
              
              // Coordenadas
              latitude: outscraperData.latitude || null,
              longitude: outscraperData.longitude || null,
              
              // Ratings y reviews
              rating: outscraperData.rating || null,
              reviews: outscraperData.reviews || null,
              reviews_per_score: outscraperData.reviews_per_score ? JSON.stringify(outscraperData.reviews_per_score) : null,
              
              // Fotos
              photos_count: outscraperData.photos_count || null,
              photo: outscraperData.photo || null,
              
              // Horarios y servicios
              working_hours: outscraperData.working_hours ? JSON.stringify(outscraperData.working_hours) : null,
              about: outscraperData.about ? JSON.stringify(outscraperData.about) : null,
              
              // Precios y descripción
              range: outscraperData.range || null,
              prices: outscraperData.prices || null,
              description: outscraperData.description || null,
              typical_time_spent: outscraperData.typical_time_spent || null,
              
              // Estado y verificación
              verified: outscraperData.verified || false,
              
              // Enlaces
              reservation_links: outscraperData.reservation_links ? JSON.stringify(outscraperData.reservation_links) : null,
              booking_appointment_link: outscraperData.booking_appointment_link || null,
              menu_link: outscraperData.menu_link || null,
              order_links: outscraperData.order_links ? JSON.stringify(outscraperData.order_links) : null,
              location_link: outscraperData.location_link || null,
              
              // Metadata
              updated_at: new Date().toISOString(),
            };

            // 4. Validar datos
            const validation = validateGoogleMapsData(updateData);
            
            if (!validation.isValid) {
              sendEvent('validation_failed', {
                recordId: record.id,
                name: record.name,
                errors: validation.errors,
                warnings: validation.warnings
              });
              
              stats.validationFailed++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }
            
            const sanitizedData = validation.sanitizedData;

            // 5. Verificar Metabase ID
            if (sanitizedData.metabase_id !== record.metabase_id) {
              sendEvent('id_mismatch', {
                recordId: record.id,
                name: customerName,
                expected: record.metabase_id,
                found: sanitizedData.metabase_id
              });
              
              stats.idMismatch++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }

            // 6. Verificar si el registro existe en google_maps (igual que el procesamiento manual)
            console.log(`🔍 Verificando si existe registro en google_maps para metabase_id: ${record.metabase_id}...`);
            const checkResponse = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${record.metabase_id}&select=id,metabase_id,place_id`, {
              method: 'GET',
              headers: {
                'apikey': serviceKey,
                'Authorization': `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!checkResponse.ok) {
              console.error(`❌ Error verificando existencia del registro: ${checkResponse.status}`);
              sendEvent('failed', {
                recordId: record.id,
                name: record.name,
                error: `Error verificando existencia: ${checkResponse.status}`
              });
              
              stats.failed++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }
            
            const existingRecords = await checkResponse.json();
            console.log(`📊 Registros existentes para metabase_id ${record.metabase_id}: ${existingRecords.length}`);
            
            let response;
            if (existingRecords.length === 0) {
              console.log(`⚠️ No existe registro en google_maps para metabase_id: ${record.metabase_id}, creando nuevo registro...`);
              // Crear nuevo registro
              response = await fetch(`${baseUrl}/rest/v1/google_maps`, {
                method: 'POST',
                headers: {
                  'apikey': serviceKey,
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify(sanitizedData),
              });
            } else {
              console.log(`📝 Actualizando registro existente en google_maps para metabase_id: ${record.metabase_id}...`);
              // Actualizar registro existente
              response = await fetch(`${baseUrl}/rest/v1/google_maps?metabase_id=eq.${record.metabase_id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': serviceKey,
                  'Authorization': `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify(sanitizedData),
              });
            }

            if (!response.ok) {
              const errorText = await response.text();
              const errorAnalysis = analyzeSupabaseError(errorText, sanitizedData, record.id);
              
              sendEvent('failed', {
                recordId: record.id,
                name: record.name,
                error: errorText,
                analysis: errorAnalysis
              });
              
              stats.failed++;
              await markAsProcessed(record.id, baseUrl, serviceKey);
              continue;
            }

            // 7. Marcar como procesado
            await markAsProcessed(record.id, baseUrl, serviceKey);

            sendEvent('success', {
              recordId: record.id,
              name: record.name,
              placeId: outscraperData.place_id,
              rating: outscraperData.rating,
              reviews: outscraperData.reviews
            });

            stats.successful++;

            // 8. Delay entre registros
            if (i < maxRecords - 1) {
              sendEvent('delay', { 
                message: `Esperando ${delayBetweenRecords}ms antes del siguiente registro`,
                delay: delayBetweenRecords
              });
              await new Promise(resolve => setTimeout(resolve, delayBetweenRecords));
            }

          } catch (error) {
            sendEvent('error', {
              recordId: stats.totalProcessed.toString(),
              name: 'Error de procesamiento',
              error: error instanceof Error ? error.message : 'Error desconocido'
            });
            
            stats.failed++;
            
            if (stopOnError) {
              throw error;
            }
          }
          
          stats.totalProcessed++;
        }

        // 9. Resumen final
        const endTime = new Date();
        const duration = endTime.getTime() - new Date(stats.startTime).getTime();
        const durationMinutes = Math.round(duration / 60000 * 100) / 100;

        sendEvent('complete', {
          message: 'Procesamiento secuencial completado',
          stats: {
            ...stats,
            endTime: endTime.toISOString(),
            duration: durationMinutes,
            successRate: stats.totalProcessed > 0 ? Math.round((stats.successful / stats.totalProcessed) * 100) : 0
          }
        });

      } catch (error) {
        sendEvent('error', {
          recordId: 'system',
          name: 'Error del sistema',
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Función auxiliar para marcar como procesado
async function markAsProcessed(recordId: string, baseUrl: string, serviceKey: string) {
  try {
    // Marcar como procesado en google_maps_pending (usando place_id para indicar que está completado)
    const updateResponse = await fetch(`${baseUrl}/rest/v1/google_maps_pending?id=eq.${recordId}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ 
        place_id: 'PROCESSED_' + Date.now(), // Marcar como procesado
        updated_at: new Date().toISOString()
      }),
    });

    if (!updateResponse.ok) {
      console.error(`⚠️ Error marcando como procesado en google_maps_pending: ${recordId}`);
    }
  } catch (error) {
    console.error(`💥 Error marcando como procesado: ${recordId}`, error);
  }
}
