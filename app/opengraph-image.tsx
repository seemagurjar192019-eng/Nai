import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Ucred — Smart Voice Khata, AI Parchi & Galla OS';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          background: 'linear-gradient(135deg, #09090B 0%, #1E3A8A 65%, #0F172A 100%)',
          color: '#F8FAFC',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #4F46E5, #06B6D4)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '38px',
              fontWeight: 800,
            }}
          >
            U
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Ucred
            </span>
            <span style={{ fontSize: '18px', color: '#CBD5E1' }}>
              Smart Voice Khata · AI Parchi · Live Galla OS
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
          <div style={{ fontSize: '54px', fontWeight: 800, lineHeight: 1.14, color: '#FFFFFF' }}>
            Hands-Free Counter Khata, AI Parchi &amp; Daily Galla Pulse.
          </div>
          <div style={{ fontSize: '25px', color: '#CBD5E1', lineHeight: 1.4 }}>
            Hybrid Hindi/Hinglish voice ledger, photo-to-bill scanner, customer trust scores, GST billing, and 1-Click UPI Vasooli.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(248,250,252,0.2)',
            paddingTop: '24px',
            fontSize: '20px',
            fontWeight: 600,
            color: '#E2E8F0',
          }}
        >
          <span>Offline-First Cloud Sync · PWA &amp; Android Ready</span>
          <span>Built for Indian Dukandaars</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
