import { ImageResponse } from 'next/og';
import { SITE_ENVIRONMENT_LABEL, SITE_NETWORK_LABEL, SITE_NETWORK_TOPOLOGY, SITE_PUBLIC_LAUNCH_STATUS, SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL, SITE_VERSION } from '@/lib/site';

export const alt = `ZION Blockchain ${SITE_RELEASE_LABEL}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0533 30%, #0d1b2a 60%, #0a0a0a 100%)',
          fontFamily: 'Inter, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow circles */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            right: '-100px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Version badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.3em',
            textTransform: 'uppercase' as const,
            marginBottom: '24px',
          }}
        >
          Test Mainnet Rehearsal · {SITE_VERSION}
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '80px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #fbbf24, #9333ea, #06b6d4)',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}
        >
          ZION
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 600,
            marginBottom: '8px',
          }}
        >
          TerraNova Blockchain
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            maxWidth: '600px',
            textAlign: 'center' as const,
            lineHeight: '1.6',
            marginBottom: '32px',
          }}
        >
          {`${SITE_NETWORK_LABEL} · ${SITE_PUBLIC_LAUNCH_STATUS} · runtime ${SITE_RUNTIME_LABEL} · Native Rust L1`}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
          }}
        >
          {[
            { label: 'Environment', value: SITE_ENVIRONMENT_LABEL },
            { label: 'Public Hosts', value: '3' },
            { label: 'Topology', value: SITE_NETWORK_TOPOLOGY },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px 24px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ fontSize: stat.label === 'Topology' ? '15px' : '22px', fontWeight: 700, color: '#fbbf24', textAlign: 'center' as const }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.15em', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.2em',
          }}
        >
          zionterranova.com
        </div>
      </div>
    ),
    { ...size }
  );
}
