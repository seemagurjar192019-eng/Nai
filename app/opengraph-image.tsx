import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'BolBahi — Voice Khata Ledger PWA';

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
          background: 'linear-gradient(135deg, #008037 0%, #005C27 100%)',
          color: '#FFFFFF',
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
              background: '#FFFFFF',
              color: '#008037',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              fontWeight: 800,
            }}
          >
            ₹
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              BolBahi
            </span>
            <span style={{ fontSize: '18px', opacity: 0.85 }}>
              Voice-First Digital Khata &amp; Munim
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '880px' }}>
          <div style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.15 }}>
            Bol ke Likho. Udhaar &amp; Vasooli in Seconds.
          </div>
          <div style={{ fontSize: '26px', opacity: 0.9, lineHeight: 1.4 }}>
            Offline Hinglish &amp; Hindi voice entries, GST bills, 58mm thermal slips, stock tracking, and 1-Click UPI reminders.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.22)',
            paddingTop: '24px',
            fontSize: '20px',
            fontWeight: 600,
            opacity: 0.92,
          }}
        >
          <span>100% Free Cloud Sync · Offline Ready PWA</span>
          <span>Made for Indian Dukandaars</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
