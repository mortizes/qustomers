// Mapeo de datos del Card 7391 de Metabase a la tabla de Supabase

export interface MetabaseCardRow {
  [key: string]: any;
}

/**
 * Genera un UUID válido a partir de cualquier valor
 */
const generateValidUUID = (value: any): string => {
  // Si ya es un UUID válido, usarlo
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return value;
  }
  
  // Si es un número, convertirlo a UUID determinístico
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const num = Number(value);
    const hex = num.toString(16).padStart(8, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(2, 5)}-${hex.slice(0, 4)}${hex.slice(0, 8)}`;
  }
  
  // Para cualquier otro valor, generar UUID basado en hash simple
  const str = String(value);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(2, 5)}-${hex.slice(0, 4)}${hex.slice(0, 8)}`;
};

export interface SupabaseCustomerRecord {
  id: string;
  name: string;
  created_week: string;
  order_count: number;
  pos_count: number;
  waiter_count: number;
  takeaway_count: number;
  delivery_count: number;
  selfservice_count: number;
  reservas_count: number | null;
  horario_count: number | null;
  subscription_status: string | null;
  address: string | null;
  city: string | null;
  facturacion_total_historico: number | null;
  facturacion_ultimos_30_dias: number | null;
  modulos: number;
  modulos_con_uso: number;
  score_cliente: number;
  estado_clientes: string | null;
  created_at?: string;
  updated_at?: string;
}

// Interfaz optimizada para actualizaciones (solo campos seleccionados)
export interface SupabaseUpdateRecord {
  id: string; // Necesario para identificar el registro
  name: string; // Obligatorio - NOT NULL constraint
  created_week: string; // Obligatorio - NOT NULL constraint
  order_count: number;
  pos_count: number;
  waiter_count: number;
  takeaway_count: number;
  delivery_count: number;
  selfservice_count: number;
  reservas_count: number | null;
  horario_count: number | null;
  facturacion_total_historico: number | null;
  facturacion_ultimos_30_dias: number | null;
  modulos: number; // Mantener como number según la interfaz principal
  modulos_con_uso: number; // Mantener como number según la interfaz principal
  score_cliente: number; // Mantener como number según la interfaz principal
  estado_clientes: string | null;
  updated_at: string;
}

/**
 * Crea un registro optimizado para actualización con solo los campos seleccionados
 */
export const createUpdateRecord = (fullRecord: SupabaseCustomerRecord): SupabaseUpdateRecord => {
  try {
    return {
      id: fullRecord.id,
      name: fullRecord.name, // Incluir campo obligatorio
      created_week: fullRecord.created_week, // Incluir campo obligatorio
      order_count: fullRecord.order_count || 0,
      pos_count: fullRecord.pos_count || 0,
      waiter_count: fullRecord.waiter_count || 0,
      takeaway_count: fullRecord.takeaway_count || 0,
      delivery_count: fullRecord.delivery_count || 0,
      selfservice_count: fullRecord.selfservice_count || 0,
      reservas_count: fullRecord.reservas_count,
      horario_count: fullRecord.horario_count,
      facturacion_total_historico: fullRecord.facturacion_total_historico,
      facturacion_ultimos_30_dias: fullRecord.facturacion_ultimos_30_dias,
      modulos: fullRecord.modulos || 0,
      modulos_con_uso: fullRecord.modulos_con_uso || 0,
      score_cliente: fullRecord.score_cliente || 0,
      estado_clientes: fullRecord.estado_clientes,
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error creando registro de actualización:', error, fullRecord);
    throw error;
  }
};

/**
 * Mapea los datos del Card 7391 de Metabase a la estructura de Supabase
 */
export const mapMetabaseToSupabase = (
  columns: string[],
  rows: any[][]
): SupabaseCustomerRecord[] => {
  const mappedData: SupabaseCustomerRecord[] = [];

  // Crear un mapa de índices de columnas para facilitar el acceso
  const columnIndexMap: Record<string, number> = {};
  columns.forEach((column, index) => {
    columnIndexMap[column] = index;
  });

  console.log('📋 Columnas disponibles:', columns);
  console.log('🗺️ Mapa de índices:', columnIndexMap);

  rows.forEach((row, rowIndex) => {
    try {
      const record: SupabaseCustomerRecord = {
        // Campos obligatorios - usar UUID directo si está disponible
        id: String(row[columnIndexMap['ID']] || generateValidUUID(rowIndex)),
        name: String(row[columnIndexMap['Name']] || ''),
        
        // Fecha de creación
        created_week: row[columnIndexMap['Created: Semana']] || new Date().toISOString(),
        
        // Contadores de funcionalidades (con valores por defecto)
        order_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # Order']] || '0') || 0,
        pos_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # POS']] || '0') || 0,
        waiter_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # WAITER']] || '0') || 0,
        takeaway_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # Take Away']] || '0') || 0,
        delivery_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # Delivery']] || '0') || 0,
        selfservice_count: parseInt(row[columnIndexMap['Restaurantes - Comandas por Funcionalidad → # Self Service']] || '0') || 0,
        
        // Contadores adicionales (pueden ser null)
        reservas_count: row[columnIndexMap['Panel AM - Reservas - Restaurante → Contar']] ? 
          parseInt(row[columnIndexMap['Panel AM - Reservas - Restaurante → Contar']]) : null,
        horario_count: row[columnIndexMap['Panel AM - Control horario por Restaurante → Count']] ? 
          parseInt(row[columnIndexMap['Panel AM - Control horario por Restaurante → Count']]) : null,
        
        // Información del cliente
        subscription_status: row[columnIndexMap['Subscription Status']] || null,
        address: row[columnIndexMap['Address']] || null,
        city: row[columnIndexMap['City']] || null,
        
        // Facturación
        facturacion_total_historico: row[columnIndexMap['Facturación - Total Histórico → Suma de Amount']] ? 
          parseFloat(row[columnIndexMap['Facturación - Total Histórico → Suma de Amount']]) : null,
        facturacion_ultimos_30_dias: row[columnIndexMap['Facturación - Ultimos 30 días por Restaurante (Pagos) → Sum']] ? 
          parseFloat(row[columnIndexMap['Facturación - Ultimos 30 días por Restaurante (Pagos) → Sum']]) : null,
        
        // Módulos y scoring
        modulos: parseInt(row[columnIndexMap['Modulos']] || '0') || 0,
        modulos_con_uso: parseInt(row[columnIndexMap['Modulos con Uso']] || '0') || 0,
        score_cliente: parseInt(row[columnIndexMap['Score Cliente']] || '0') || 0,
        estado_clientes: row[columnIndexMap['Estado Clientes']] || null,
      };

      // Validar que los campos obligatorios no estén vacíos
      if (!record.id || !record.name) {
        console.warn(`⚠️ Registro ${rowIndex} omitido: faltan campos obligatorios`, {
          id: record.id,
          name: record.name
        });
        return;
      }

      mappedData.push(record);
    } catch (error) {
      console.error(`❌ Error mapeando fila ${rowIndex}:`, error, row);
    }
  });

  console.log(`✅ Mapeados ${mappedData.length} registros de ${rows.length} filas`);
  return mappedData;
};

/**
 * Valida que un registro tenga la estructura correcta
 */
export const validateRecord = (record: SupabaseCustomerRecord): boolean => {
  // Campos obligatorios
  if (!record.id || !record.name) {
    return false;
  }

  // Validar tipos de datos numéricos
  const numericFields = [
    'order_count', 'pos_count', 'waiter_count', 'takeaway_count',
    'delivery_count', 'selfservice_count', 'modulos', 'modulos_con_uso', 'score_cliente'
  ];

  for (const field of numericFields) {
    const value = record[field as keyof SupabaseCustomerRecord];
    if (typeof value !== 'number' || isNaN(value)) {
      console.warn(`⚠️ Campo numérico inválido: ${field} = ${value}`);
      return false;
    }
  }

  return true;
};

/**
 * Prepara los datos para inserción en Supabase (añade timestamps)
 */
export const prepareForSupabase = (records: SupabaseCustomerRecord[]): SupabaseCustomerRecord[] => {
  const now = new Date().toISOString();
  
  return records.map(record => ({
    ...record,
    created_at: now,
    updated_at: now,
  }));
};
