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
          background: 'linear-gradient(135deg, #161514 0%, #262320 65%, #161514 100%)',
          color: '#F6F2EC',
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
              background: '#F6F2EC',
              color: '#161514',
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
            <span style={{ fontSize: '18px', color: '#D6CEC2' }}>
              Smart Voice Khata · AI Parchi · Live Galla OS
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '900px' }}>
          <div style={{ fontSize: '54px', fontWeight: 800, lineHeight: 1.14, color: '#FFFFFF' }}>
            Hands-Free Counter Khata, AI Parchi &amp; Daily Galla Pulse.
          </div>
          <div style={{ fontSize: '25px', color: '#D6CEC2', lineHeight: 1.4 }}>
            Hybrid Hindi/Hinglish voice ledger, photo-to-bill scanner, customer trust scores, GST billing, and 1-Click UPI Vasooli.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(246,242,236,0.2)',
            paddingTop: '24px',
            fontSize: '20px',
            fontWeight: 600,
            color: '#EDE7DF',
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
