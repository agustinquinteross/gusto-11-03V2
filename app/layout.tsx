import type { Metadata } from "next";
import { Montserrat, Great_Vibes } from "next/font/google";
import "./globals.css";
// 1. IMPORTAMOS EL CEREBRO DEL CARRITO
import { CartProvider } from "../store/useCart"; 

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const greatVibes = Great_Vibes({
  weight: '400',
  variable: "--font-great-vibes",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Gustó - Donde nace el sabor',
  description: 'Pedí online y disfrutá del mejor sabor de Catamarca. Delivery rápido y retiro en local.',
  icons: {
    icon: '/logo.png'
  },
  openGraph: {
    title: 'Gustó - Donde nace el sabor',
    description: 'Pedí online y disfrutá del mejor sabor de Catamarca. Delivery rápido y retiro en local.',
    images: ['/logo.png'],
  },
}

import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${greatVibes.variable} antialiased bg-[#FAF7F2] text-[#4A3B32] font-sans`}
      >
        {/* 2. ENVOLVEMOS TODA LA APP CON EL PROVIDER */}
        <CartProvider>
            {children}
        </CartProvider>
        {/* Añadimos Analytics para Vercel */}
        <Analytics />
      </body>
    </html>
  );
}
