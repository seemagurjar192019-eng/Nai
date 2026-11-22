import type { Metadata, Viewport } from 'next';
import {
  JetBrains_Mono,
  Noto_Sans_Devanagari,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-devanagari',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const DEFAULT_APP_ORIGIN = 'https://ais-dev-b5572c6vlenhbxhdhwmdvx-303612259339.asia-east1.run.app';

function resolveMetadataBase(): URL {
  const candidates = [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL, DEFAULT_APP_ORIGIN];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed;
      }
    } catch {
      // Ignore malformed env values such as auth tokens and fall back safely
    }
  }
  return new URL(DEFAULT_APP_ORIGIN);
}

export const viewport: Viewport = {
  themeColor: '#4F46E5',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
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
      className={`${plusJakarta.variable} ${notoDevanagari.variable} ${jetbrainsMono.variable}`}
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
