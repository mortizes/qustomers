// Configuración centralizada de la aplicación

export const config = {
  metabase: {
    url: process.env.NEXT_PUBLIC_METABASE_URL || 'https://qamarero.metabaseapp.com',
    apiKey: 'mb_OyaI0ag9uGuwfNLl15pIl+H4H3DdJVTxfjUHLCxWsWg=',
    databaseName: 'customers-database',
    exampleCardId: 7391,
    defaultLimit: 1000,
    timeout: 300000, // 5 minutos (300 segundos)
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ukvxogczngixomfqzygl.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrdnhvZ2N6bmdpeG9tZnF6eWdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjcyNjQ5NywiZXhwIjoyMDcyMzAyNDk3fQ.uVzfT1U7uJ3czEsFK0PY7aii-qE4mJniX8oBTvnvLw4',
    tableName: 'metabase_customers',
  },
  app: {
    name: 'Visor de Datos de Metabase',
    version: '1.0.0',
    description: 'Aplicación para consultar y visualizar datos de Metabase',
  },
  outscraper: {
    apiKey: process.env.OUTSCRAPER_API_KEY || 'M2M3Yzk4NTIzNmRjNGMxN2JjZDFkNDU2M2M2MjU3ZTV8YjZmNmViNDY1MA',
    baseUrl: 'https://api.outscraper.cloud/maps/search-v3', // Corregida la URL según la documentación
    defaultLimit: 10, // Optimizado para respuestas rápidas
    language: 'es',
    region: 'ES',
  },
} as const;

// Validación de configuración
export const validateConfig = (): void => {
  if (!config.metabase.url) {
    throw new Error('NEXT_PUBLIC_METABASE_URL no está configurado');
  }
  
  if (!config.metabase.apiKey) {
    throw new Error('API Key de Metabase no está configurada');
  }
};

// Utilidad para construir URLs de la API
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = config.metabase.url.replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Headers estándar para peticiones a Metabase
export const getMetabaseHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'x-api-key': config.metabase.apiKey,
  };
};
