import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Visor de Tablas Metabase',
  description: 'Aplicación para consultar y visualizar datos de tablas de Metabase',
  keywords: ['metabase', 'datos', 'tablas', 'api', 'visualización'],
  authors: [{ name: 'Equipo de Desarrollo' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}
