# Visor de Tablas de Metabase

Una aplicación Next.js que permite consultar y visualizar datos de tablas de Metabase usando la API.

## Características

- 🔍 Consulta datos de cualquier tabla usando su ID
- 📊 Visualización de datos en formato tabla
- 📥 Descarga de datos en formato CSV
- 📱 Diseño responsive y accesible
- ⚡ Manejo de estados de carga y errores
- 🎨 Interfaz moderna con TailwindCSS

## Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Copia `.env.local.example` a `.env.local`
   - La URL ya está configurada para: `https://qamarero.metabaseapp.com`

3. **Credenciales incluidas:**
   - **API Key**: `GYM4tju.adc!auf1ctd`
   - **Base de datos**: `customers-database`
   - **Card de ejemplo**: ID 7391

## Uso

1. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

2. **Abrir en el navegador:**
   - Ve a `http://localhost:3000`
   - **Opción 1 (Recomendada)**: Usa "Acceso Rápido" para consultar el Card ID 7391
   - **Opción 2**: Selecciona "Card" e ingresa cualquier Card ID
   - **Opción 3**: Selecciona "Tabla" e ingresa cualquier Table ID
   - Haz clic en "Consultar" para obtener los datos

### 🚀 **Acceso Rápido Incluido**
La aplicación incluye un botón de acceso rápido para consultar directamente el Card ID 7391 que tienes configurado en tu instancia.

## API Endpoints

### 📊 Cards (Recomendado)

#### GET/POST `/api/metabase/card/[cardId]`
Obtiene datos de un card específico usando API key.

**Ejemplo de uso:**
```bash
curl -X POST https://qamarero.metabaseapp.com/api/card/7391/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: GYM4tju.adc!auf1ctd" \
  -d '{"constraints": {"max-results": 1000}}'
```

**Parámetros:**
- `cardId`: ID del card en Metabase (ej: 7391)
- `limit` (query): Límite de filas (por defecto: 1000)

#### GET `/api/metabase/cards`
Lista todos los cards disponibles.

### 🗃️ Tablas

#### GET `/api/metabase/[tableId]`
Obtiene todos los datos de una tabla específica.

**Parámetros:**
- `tableId`: ID de la tabla en Metabase
- `limit` (query): Límite de filas (por defecto: 1000)

#### GET `/api/metabase/tables`
Lista todas las tablas disponibles en la base de datos.

**Respuesta común:**
```json
{
  "columns": ["columna1", "columna2", ...],
  "rows": [["valor1", "valor2", ...], ...],
  "metadata": {
    "table": {
      "id": 7391,
      "name": "card_7391",
      "display_name": "Card 7391",
      ...
    },
    "total_rows": 500
  }
}
```

## Estructura del Proyecto

```
├── app/
│   ├── api/metabase/          # Endpoints de la API
│   ├── globals.css            # Estilos globales
│   ├── layout.tsx             # Layout principal
│   └── page.tsx               # Página principal
├── components/
│   └── TableViewer.tsx        # Componente principal
├── lib/
│   └── metabase.ts           # Servicio de API de Metabase
└── ...
```

## Tecnologías Utilizadas

- **Next.js 14** - Framework React con App Router
- **TypeScript** - Tipado estático
- **TailwindCSS** - Framework de CSS utilitario
- **Lucide React** - Iconos
- **Metabase API** - Conexión con Metabase

## Funcionalidades Principales

### 🔐 Autenticación
- Autenticación automática con API key
- Manejo de tokens de sesión
- Reautenticación automática cuando expira el token

### 📊 Visualización de Datos
- Tabla responsive con scroll horizontal
- Paginación automática
- Manejo de valores null/undefined
- Información de metadatos de la tabla

### 📱 Accesibilidad
- Navegación por teclado
- Etiquetas ARIA apropiadas
- Contraste de colores WCAG 2.1 AA
- Diseño responsive

### ⚡ Performance
- Lazy loading de componentes
- Optimización de imágenes
- Código splitting automático
- Estados de carga optimizados

## Personalización

Para personalizar la aplicación:

1. **Colores:** Modifica la paleta en `tailwind.config.js`
2. **API:** Ajusta la configuración en `lib/metabase.ts`
3. **Componentes:** Personaliza `components/TableViewer.tsx`

## Problemas Comunes

### Error de Autenticación
- Verifica que la API key sea correcta
- Asegúrate de que la URL de Metabase sea accesible
- Revisa que el usuario tenga permisos para acceder a las tablas

### Tabla No Encontrada
- Verifica que el ID de la tabla existe
- Confirma que tienes permisos para acceder a esa tabla
- Revisa que la base de datos esté conectada en Metabase

## Contribuir

1. Fork del repositorio
2. Crear una rama para tu feature
3. Commit de tus cambios
4. Push a la rama
5. Crear un Pull Request
