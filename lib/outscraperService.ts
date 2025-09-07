import { config } from './config';

interface OutscraperPlaceResult {
  query: string;
  name: string;
  site?: string;
  subtypes?: string;
  category?: string;
  phone?: string;
  full_address?: string;
  borough?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviews?: number;
  reviews_per_score?: Record<string, number>;
  photos_count?: number;
  photo?: string;
  working_hours?: Record<string, string>;
  about?: Record<string, any>;
  range?: string;
  prices?: any;
  description?: string;
  typical_time_spent?: string;
  verified?: boolean;
  reservation_links?: string[];
  booking_appointment_link?: string;
  menu_link?: string;
  order_links?: string[];
  location_link?: string;
  place_id?: string;
  google_id?: string;
  cid?: string;
  kgmid?: string;
  reviews_id?: string;
  // Campos adicionales que podrían venir
  formatted_address?: string;
  reviews_count?: number;
  website?: string;
  main_category?: string;
  business_status?: string;
  type?: string;
  price_level?: number;
  url?: string;
  photos_sample?: string[];
  reviews_link?: string;
  owner_id?: string;
  owner_link?: string;
  opening_hours?: string[];
}

export interface OutscraperSearchParams {
  query: string[];
  limit?: number;
  dropDuplicates?: boolean;
  totalLimit?: number;
  language?: string;
  region?: string;
  fields?: string;
  enrichment?: string[];
}

export interface OutscraperResponse {
  id?: string;
  status?: string;
  data: OutscraperPlaceResult[][];
  credits_used?: number;
  request_id?: string;
}

export class OutscraperService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.outscraper.apiKey;
    this.baseUrl = config.outscraper.baseUrl;
  }

  /**
   * Busca lugares en Google Maps usando la API de Outscraper
   */
  async searchPlaces(params: OutscraperSearchParams): Promise<OutscraperResponse> {
    try {
      console.log('🔍 Iniciando búsqueda en Outscraper:', params.query.length, 'queries');

      // Construir query params
      const queryParams = new URLSearchParams();
      
      // Añadir queries múltiples
      params.query.forEach(q => queryParams.append('query', q));
      
      // Parámetros opcionales
      if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());
      if (params.dropDuplicates !== undefined) queryParams.append('dropDuplicates', params.dropDuplicates.toString());
      if (params.totalLimit !== undefined) queryParams.append('totalLimit', params.totalLimit.toString());
      if (params.language) queryParams.append('language', params.language);
      if (params.region) queryParams.append('region', params.region);
      if (params.fields) queryParams.append('fields', params.fields);
      if (params.enrichment) {
        params.enrichment.forEach(e => queryParams.append('enrichment', e));
      }

      // Usar async=false para respuestas en tiempo real
      queryParams.append('async', 'false');

      const url = `${this.baseUrl}?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey, // Header correcto según la documentación
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error en Outscraper API: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Respuesta de Outscraper recibida');
      
      return data;
    } catch (error) {
      console.error('❌ Error en Outscraper:', error);
      throw error;
    }
  }

  /**
   * Busca un único lugar usando nombre y dirección
   */
  async searchSinglePlace(name: string, address: string, city: string): Promise<OutscraperPlaceResult | null> {
    try {
      // Construir query más específica: "nombre dirección" (sin duplicar ciudad)
      const finalAddress = address.toLowerCase().includes(city.toLowerCase()) 
        ? address 
        : `${address}, ${city}`;
      const query = `${name} ${finalAddress}`.trim();
      console.log(`🔍 Buscando en Outscraper: "${query}"`);
      
      const response = await this.searchPlaces({
        query: [query],
        limit: 1,
        dropDuplicates: true,
        totalLimit: 1,
        language: 'es',
        region: 'ES',
        fields: 'name,site,subtypes,category,phone,full_address,borough,street,city,postal_code,state,country,latitude,longitude,rating,reviews,reviews_per_score,photos_count,photo,working_hours,about,range,prices,description,typical_time_spent,verified,reservation_links,booking_appointment_link,menu_link,order_links,location_link,place_id,google_id,cid,kgmid,reviews_id',
      });

      // Contar resultados correctamente
      const resultCount = response.data?.[0] ? (Array.isArray(response.data[0]) ? response.data[0].length : 1) : 0;
      console.log(`📊 Respuesta de Outscraper para "${query}":`, resultCount, 'resultados');
      console.log(`📋 Estructura completa de la respuesta:`, JSON.stringify(response.data, null, 2));
      console.log(`📋 Datos del primer resultado:`, response.data?.[0]?.[0] ? JSON.stringify(response.data[0][0], null, 2) : 'No hay resultados');

      // Verificar si hay un resultado directo (objeto con name)
      if (response.data && response.data[0] && typeof response.data[0] === 'object' && response.data[0].name) {
        const result = response.data[0];
        console.log(`✅ Encontrado (resultado directo): "${result.name}" en ${result.city || result.full_address}`);
        return result;
      }

      // La respuesta viene como array de arrays
      if (response.data && response.data[0] && Array.isArray(response.data[0]) && response.data[0].length > 0) {
        const result = response.data[0][0];
        console.log(`✅ Encontrado (en array): "${result.name}" en ${result.city || result.full_address}`);
        return result;
      }

      console.log(`⚠️ No encontrado: "${query}"`);
      return null;
    } catch (error) {
      console.error(`❌ Error buscando lugar: ${name}`, error);
      return null;
    }
  }

  /**
   * Procesa múltiples lugares en lotes
   */
  async searchMultiplePlaces(
    places: Array<{ name: string; address: string; city: string; metabase_id?: string; record_id?: string }>,
    batchSize: number = 25
  ): Promise<Map<string, OutscraperPlaceResult>> {
    const results = new Map<string, OutscraperPlaceResult>();
    
    // Dividir en lotes para no sobrecargar la API
    for (let i = 0; i < places.length; i += batchSize) {
      const batch = places.slice(i, i + batchSize);
      const queries = batch.map(p => {
        // Usar la misma lógica que funciona en la prueba individual
        // Construir la query exactamente como en searchSinglePlace
        const finalAddress = p.address.toLowerCase().includes(p.city.toLowerCase()) 
          ? p.address 
          : `${p.address}, ${p.city}`;
        return `${p.name} ${finalAddress}`.trim();
      });
      
      console.log(`📦 Procesando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(places.length / batchSize)}`);
      console.log(`🔍 Queries del lote:`, queries.slice(0, 3)); // Mostrar solo las primeras 3 para no saturar el log
      
      try {
        const response = await this.searchPlaces({
          query: queries,
          limit: 1,
          dropDuplicates: true,
          totalLimit: queries.length,
          language: 'es',
          region: 'ES',
          fields: 'name,site,subtypes,category,phone,full_address,borough,street,city,postal_code,state,country,latitude,longitude,rating,reviews,reviews_per_score,photos_count,photo,working_hours,about,range,prices,description,typical_time_spent,verified,reservation_links,booking_appointment_link,menu_link,order_links,location_link,place_id,google_id,cid,kgmid,reviews_id',
        });

        console.log('✅ Respuesta de Outscraper recibida');
        console.log('📊 Estructura de la respuesta:', JSON.stringify(response.data, null, 2));
        console.log('📊 Número de resultados por query:', response.data.map(arr => arr ? arr.length : 0));

        // Asociar resultados con las queries originales
        console.log(`📊 Procesando ${response.data.length} resultados de Outscraper...`);
        response.data.forEach((resultArray, index) => {
          const place = batch[index];
          const query = queries[index];
          // Incluir metabase_id en la clave para evitar confusiones
          const key = place.metabase_id ? 
            `${place.metabase_id}_${place.name}_${place.address}_${place.city}` :
            `${place.name}_${place.address}_${place.city}`;
          
          console.log(`🔍 [${index + 1}/${response.data.length}] Procesando resultado para: "${place.name}"`);
          console.log(`🔑 Metabase ID: ${place.metabase_id || 'N/A'}`);
          console.log(`🔍 Query enviada: "${query}"`);
          console.log(`🔍 Tipo de resultado:`, typeof resultArray, Array.isArray(resultArray) ? 'array' : 'objeto');
          console.log(`🔍 Longitud del resultado:`, Array.isArray(resultArray) ? resultArray.length : 'N/A');
          
          // Verificar si hay resultados (puede ser array o objeto directo)
          let hasResults = false;
          let result = null;
          
          if (Array.isArray(resultArray) && resultArray.length > 0) {
            hasResults = true;
            result = resultArray[0];
            console.log(`✅ Resultado encontrado en array: "${result.name || 'Sin nombre'}"`);
          } else if (resultArray && typeof resultArray === 'object' && resultArray.name) {
            // Si es un objeto directo con datos
            hasResults = true;
            result = resultArray;
            console.log(`✅ Resultado encontrado como objeto: "${result.name}"`);
          } else {
            console.log(`⚠️ No hay resultados válidos para esta query`);
          }
          
          if (hasResults && result) {
            // Validación adicional: verificar que el nombre coincida aproximadamente
            const nameMatch = place.name.toLowerCase().includes(result.name.toLowerCase()) || 
                             result.name.toLowerCase().includes(place.name.toLowerCase());
            
            if (!nameMatch) {
              console.log(`⚠️ ADVERTENCIA: Posible asignación incorrecta en Outscraper`);
              console.log(`   📝 Nombre esperado: "${place.name}"`);
              console.log(`   📝 Nombre encontrado: "${result.name}"`);
              console.log(`   🔍 Coincidencia de nombre: ${nameMatch}`);
            }
            
            results.set(key, result);
            console.log(`✅ [${index + 1}/${response.data.length}] ÉXITO: "${result.name}" para "${place.name}"`);
            console.log(`🔑 Clave guardada: "${key}"`);
          } else {
            console.log(`⚠️ [${index + 1}/${response.data.length}] FALLO: No encontrado "${query}"`);
            console.log(`🔑 Clave que no encontró resultado: "${key}"`);
          }
        });

        // Esperar un poco entre lotes para no saturar la API
        if (i + batchSize < places.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Error en lote ${Math.floor(i / batchSize) + 1}:`, error);
      }
    }

    console.log(`✅ Procesados ${results.size} lugares de ${places.length} totales`);
    return results;
  }
}

// Exportar instancia singleton
export const outscraperService = new OutscraperService();
