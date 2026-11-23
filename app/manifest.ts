import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Ucred — Voice Ledger & Cashbook OS',
    short_name: 'Ucred',
    description:
      'Voice-first digital khata, receipt scanner, live cashbook, GST billing, stock & UPI collection PWA for Indian shopkeepers.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    dir: 'ltr',
    background_color: '#F6F7FB',
    theme_color: '#4F46E5',
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
        name: 'Voice & Counter Mode',
        short_name: 'Voice Entry',
        description: 'Speak Hinglish or Hindi to log udhaar, jama, or rush queue entries',
        url: '/?action=voice',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Scan Receipt',
        short_name: 'Scan Receipt',
        description: 'Snap a handwritten slip or bill photo to post khata or GST bill',
        url: '/?action=parchi',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Galla Cashbook',
        short_name: 'Galla Drawer',
        description: 'View live Cash Drawer, UPI collections, and Daily Profit Pulse',
        url: '/?tab=galla',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
