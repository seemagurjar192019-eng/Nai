import type { Metadata, Viewport } from 'next';
import {
  JetBrains_Mono,
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const plusJakartaDisplay = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://ais-dev-b5572c6vlenhbxhdhwmdvx-303612259339.asia-east1.run.app';

export const viewport: Viewport = {
  themeColor: '#1E3A8A',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_ORIGIN),
  applicationName: 'Ucred',
  title: {
    default: 'Ucred — Smart Voice Khata, AI Parchi & Galla OS',
    template: '%s | Ucred',
  },
  description:
    'Voice-first offline Hinglish khata, AI parchi scanner, live Galla cashbook, trust scores, GST billing, stock & UPI collection for Indian shopkeepers.',
  keywords: [
    'Ucred',
    'Voice Khata',
    'AI Parchi Scanner',
    'Galla Cashbook',
    'Udhaar Khata App',
    'Digital Bahi Khata',
    'Shopkeeper Billing PWA',
    'UPI Vasooli',
  ],
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ucred',
  },
  icons: {
    icon: '/pwa-192x192.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Ucred — Smart Voice Khata, AI Parchi & Galla OS',
    description:
      'Voice-first digital khata, AI receipt scanner, live Galla drawer, GST billing & UPI collection PWA for Indian shopkeepers.',
    url: '/',
    siteName: 'Ucred',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ucred — Smart Voice Khata, AI Parchi & Galla OS',
    description:
      'Voice-first digital khata, AI receipt scanner, live Galla drawer, GST billing & UPI collection PWA for Indian shopkeepers.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Ucred — Smart Voice Khata & Galla OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Android, iOS, Web',
  inLanguage: ['en-IN', 'hi-IN'],
  description:
    'Voice-first offline Hinglish khata ledger PWA with AI parchi scanner, live Galla cashbook, trust score predictor, GST billing, and UPI collection for Indian shopkeepers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'INR',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaDisplay.variable} ${plusJakarta.variable} ${notoDevanagari.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-[var(--outer-frame)] text-[var(--ink)]" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
