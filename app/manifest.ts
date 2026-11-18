import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'BolBahi — Voice Khata',
    short_name: 'BolBahi',
    description:
      'Voice-first digital khata ledger, GST billing, stock & UPI collection PWA for Indian shopkeepers.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    dir: 'ltr',
    background_color: '#F6F8F7',
    theme_color: '#008037',
    lang: 'en-IN',
    categories: ['business', 'finance', 'productivity'],
    prefer_related_applications: false,
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Voice Entry (Bol ke Likho)',
        short_name: 'Voice Entry',
        description: 'Speak Hinglish or Hindi to log udhaar or jama immediately',
        url: '/?action=voice',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Create Bill / Quote',
        short_name: 'New Bill',
        description: 'Generate GST invoice, 58mm thermal slip, or quote',
        url: '/?tab=bills',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
