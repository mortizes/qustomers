import { NextRequest, NextResponse } from 'next/server';
import { outscraperService } from '@/lib/outscraperService';
import { config } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, address, city } = body;
    
    if (!name || !address || !city) {
      return NextResponse.json({
        success: false,
        error: 'Se requieren name, address y city para la prueba',
      }, { status: 400 });
    }
    
    console.log(`🧪 === PRUEBA DE OUTSCRAPER ===`);
    console.log(`🔑 API Key configurada: ${config.outscraper.apiKey ? 'SÍ' : 'NO'}`);
    console.log(`🔑 API Key (primeros 10 chars): ${config.outscraper.apiKey?.substring(0, 10)}...`);
    console.log(`🌐 Base URL: ${config.outscraper.baseUrl}`);
    
    // Probar con la query exacta que funciona
    const testQuery = "Can Ramiro Coffe & Bakery Avinguda dels Pins, 52 Illes Balears, Porto Cristo";
    console.log(`🔍 Query a probar: "${testQuery}"`);
    
    // Usar searchPlaces directamente con la query que sabemos que funciona
    const response = await outscraperService.searchPlaces({
      query: [testQuery],
      limit: 1,
      language: config.outscraper.language,
      region: config.outscraper.region,
      fields: 'name,site,subtypes,category,phone,full_address,borough,street,city,postal_code,state,country,latitude,longitude,rating,reviews,reviews_per_score,photos_count,photo,working_hours,about,range,prices,description,typical_time_spent,verified,reservation_links,booking_appointment_link,menu_link,order_links,location_link,place_id,google_id,cid,kgmid,reviews_id',
    });
    
    const result = response.data && response.data[0] && response.data[0].length > 0 ? response.data[0][0] : null;
    
    console.log(`📊 Resultado:`, result ? 'ENCONTRADO' : 'NO ENCONTRADO');
    if (result) {
      console.log(`✅ Datos encontrados:`, {
        name: result.name,
        place_id: result.place_id,
        google_id: result.google_id,
        full_address: result.full_address,
        city: result.city,
        rating: result.rating,
        reviews: result.reviews
      });
    }
    
    return NextResponse.json({
      success: true,
      query: testQuery,
      result: result,
      found: result !== null,
      debug: {
        apiKeyConfigured: !!config.outscraper.apiKey,
        apiKeyLength: config.outscraper.apiKey?.length || 0,
        baseUrl: config.outscraper.baseUrl,
        language: config.outscraper.language,
        region: config.outscraper.region,
      }
    });
    
  } catch (error) {
    console.error('💥 Error en prueba de Outscraper:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
