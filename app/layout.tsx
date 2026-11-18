import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Noto_Sans_Devanagari, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
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
  themeColor: '#008037',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_ORIGIN),
  applicationName: 'BolBahi',
  title: {
    default: 'BolBahi — Voice Khata',
    template: '%s | BolBahi',
  },
  description:
    'Voice-first offline Hinglish khata ledger PWA with cloud sync, GST billing, stock, and UPI collection for Indian shopkeepers.',
  keywords: [
    'BolBahi',
    'Voice Khata',
    'Udhaar Khata App',
    'Hinglish Ledger',
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
    title: 'BolBahi',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'BolBahi — Voice Khata',
    description:
      'Voice-first digital khata ledger, billing, stock & UPI collection PWA for Indian shopkeepers.',
    url: '/',
    siteName: 'BolBahi',
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BolBahi — Voice Khata',
    description:
      'Voice-first digital khata ledger, billing, stock & UPI collection PWA for Indian shopkeepers.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'BolBahi — Voice Khata',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Android, iOS, Web',
  inLanguage: ['en-IN', 'hi-IN'],
  description:
    'Voice-first offline Hinglish khata ledger PWA with cloud sync, GST billing, stock tracking, and UPI collection for Indian shopkeepers.',
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
      className={`${plusJakarta.variable} ${notoDevanagari.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen text-slate-900 dark:text-slate-100" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
