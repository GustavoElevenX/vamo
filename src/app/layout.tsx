import type { Metadata } from 'next'
import { DM_Sans, Geist_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vamo - Plataforma de Desempenho Comercial',
  description: 'Engaje sua equipe, acelere resultados e transforme metas em conquistas com gamificação inteligente.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
