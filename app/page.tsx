import Card7391Importer from '@/components/Card7391Importer'
import SupabaseAnalytics from '@/components/SupabaseAnalytics'
import GoogleMapsPendingProcessor from '@/components/GoogleMapsPendingProcessor'

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-4xl font-bold text-gray-900">
          Panel de Gestión de Datos
        </h1>
        <p className="text-lg text-gray-600">
          Análisis y sincronización de datos de clientes
        </p>
      </div>

      <div className="space-y-12">
        {/* Sección de Supabase */}
        <section className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              📊 Analytics de Supabase
            </h2>
            <p className="text-gray-600">
              Estadísticas generales de la base de datos
            </p>
          </div>
          <SupabaseAnalytics />
        </section>

        {/* Sección de Procesamiento de Pendientes */}
        <section className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              🔄 Procesamiento Manual de Registros Pendientes
            </h2>
            <p className="text-gray-600">
              Completar información de Google Maps usando datos de clientes (modo manual)
            </p>
          </div>
          <GoogleMapsPendingProcessor />
        </section>

        {/* Sección de Importación */}
        <section className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
              📥 Importación de Datos
            </h2>
            <p className="text-gray-600">
              Herramientas para importar y gestionar datos
            </p>
          </div>
          <Card7391Importer />
        </section>
      </div>
    </main>
  );
}