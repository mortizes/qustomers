// Validador de datos para identificar problemas antes de enviar a Supabase

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData: any;
}

export function validateGoogleMapsData(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitizedData = { ...data };

  // Validaciones críticas
  if (!data.metabase_id) {
    errors.push('metabase_id es requerido');
  }

  if (!data.place_id) {
    errors.push('place_id es requerido');
  }

  // Validaciones de tipos de datos
  if (data.latitude !== null && data.latitude !== undefined) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push(`latitude inválida: ${data.latitude}`);
    } else {
      sanitizedData.latitude = lat;
    }
  }

  if (data.longitude !== null && data.longitude !== undefined) {
    const lng = parseFloat(data.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.push(`longitude inválida: ${data.longitude}`);
    } else {
      sanitizedData.longitude = lng;
    }
  }

  if (data.rating !== null && data.rating !== undefined) {
    const rating = parseFloat(data.rating);
    if (isNaN(rating) || rating < 0 || rating > 5) {
      errors.push(`rating inválido: ${data.rating}`);
    } else {
      sanitizedData.rating = rating;
    }
  }

  if (data.reviews !== null && data.reviews !== undefined) {
    const reviews = parseInt(data.reviews);
    if (isNaN(reviews) || reviews < 0) {
      errors.push(`reviews inválido: ${data.reviews}`);
    } else {
      sanitizedData.reviews = reviews;
    }
  }

  if (data.photos_count !== null && data.photos_count !== undefined) {
    const photosCount = parseInt(data.photos_count);
    if (isNaN(photosCount) || photosCount < 0) {
      errors.push(`photos_count inválido: ${data.photos_count}`);
    } else {
      sanitizedData.photos_count = photosCount;
    }
  }

  // Validaciones de strings
  const stringFields = ['name', 'site', 'subtypes', 'category', 'phone', 'full_address', 'borough', 'street', 'city', 'postal_code', 'state', 'country', 'photo', 'range', 'prices', 'description', 'typical_time_spent', 'booking_appointment_link', 'menu_link', 'location_link', 'place_id', 'google_id', 'cid', 'kgmid', 'reviews_id'];
  
  for (const field of stringFields) {
    if (data[field] !== null && data[field] !== undefined) {
      const value = String(data[field]);
      // Verificar si el string es demasiado largo (Supabase tiene límites)
      if (value.length > 1000) {
        warnings.push(`${field} es muy largo (${value.length} caracteres), truncando a 1000`);
        sanitizedData[field] = value.substring(0, 1000);
      } else {
        sanitizedData[field] = value;
      }
    }
  }

  // Validaciones de JSON
  const jsonFields = ['reviews_per_score', 'working_hours', 'about', 'reservation_links', 'order_links'];
  
  for (const field of jsonFields) {
    if (data[field] !== null && data[field] !== undefined) {
      try {
        if (typeof data[field] === 'string') {
          // Ya es un string JSON
          sanitizedData[field] = data[field];
        } else {
          // Convertir a JSON string
          const jsonString = JSON.stringify(data[field]);
          if (jsonString.length > 10000) {
            warnings.push(`${field} JSON es muy grande (${jsonString.length} caracteres), truncando`);
            sanitizedData[field] = jsonString.substring(0, 10000);
          } else {
            sanitizedData[field] = jsonString;
          }
        }
      } catch (error) {
        errors.push(`${field} no es JSON válido: ${error}`);
        sanitizedData[field] = null;
      }
    }
  }

  // Validaciones de boolean
  if (data.verified !== null && data.verified !== undefined) {
    sanitizedData.verified = Boolean(data.verified);
  }

  // Validación de fecha
  if (data.updated_at) {
    try {
      const date = new Date(data.updated_at);
      if (isNaN(date.getTime())) {
        errors.push(`updated_at inválida: ${data.updated_at}`);
      } else {
        sanitizedData.updated_at = date.toISOString();
      }
    } catch (error) {
      errors.push(`updated_at no es una fecha válida: ${error}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData
  };
}

export function logValidationResults(recordId: string, result: ValidationResult, originalData: any) {
  console.log(`🔍 Validación de datos para registro ${recordId}:`);
  console.log(`   ✅ Válido: ${result.isValid}`);
  
  if (result.errors.length > 0) {
    console.log(`   ❌ Errores (${result.errors.length}):`);
    result.errors.forEach(error => console.log(`      - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.log(`   ⚠️ Advertencias (${result.warnings.length}):`);
    result.warnings.forEach(warning => console.log(`      - ${warning}`));
  }

  // Mostrar diferencias entre datos originales y sanitizados
  const differences = findDataDifferences(originalData, result.sanitizedData);
  if (differences.length > 0) {
    console.log(`   🔧 Datos modificados (${differences.length}):`);
    differences.forEach(diff => console.log(`      - ${diff.field}: "${diff.original}" → "${diff.sanitized}"`));
  }

  // Log detallado para debugging
  if (!result.isValid) {
    console.log(`   🚨 DATOS ORIGINALES PROBLEMÁTICOS:`, JSON.stringify(originalData, null, 2));
    console.log(`   🔧 DATOS SANITIZADOS:`, JSON.stringify(result.sanitizedData, null, 2));
  }
}

function findDataDifferences(original: any, sanitized: any): Array<{field: string, original: any, sanitized: any}> {
  const differences: Array<{field: string, original: any, sanitized: any}> = [];
  
  for (const key in sanitized) {
    if (original[key] !== sanitized[key]) {
      differences.push({
        field: key,
        original: original[key],
        sanitized: sanitized[key]
      });
    }
  }
  
  return differences;
}
