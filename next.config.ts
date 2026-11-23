import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

export default function createNextConfig(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    reactStrictMode: true,
    poweredByHeader: false,
    productionBrowserSourceMaps: false,
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      ignoreBuildErrors: false,
    },
    compiler: {
      removeConsole:
        process.env.NODE_ENV === 'production'
          ? { exclude: ['error', 'warn'] }
          : false,
    },
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/**',
        },
      ],
    },
    async headers() {
      const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
      const scriptSrc = [
        "'self'",
        "'unsafe-inline'",
        ...(isDevServer ? ["'unsafe-eval'"] : []),
        'https://apis.google.com',
        'https://www.gstatic.com',
        'https://www.google.com',
      ].join(' ');
      const csp = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https://*.googleusercontent.com https://picsum.photos",
        "font-src 'self' data: https://fonts.gstatic.com",
        "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com wss://*.firebaseio.com",
        "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://www.google.com",
        "frame-ancestors 'self' https://aistudio.google.com https://*.google.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');

      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            { key: 'X-DNS-Prefetch-Control', value: 'off' },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin-allow-popups',
            },
            {
              key: 'Cross-Origin-Resource-Policy',
              value: 'same-origin',
            },
            {
              key: 'Permissions-Policy',
              value:
                'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
            },
            { key: 'Content-Security-Policy', value: csp },
          ],
        },
      ];
    },
    output: 'standalone',
    transpilePackages: ['motion', 'framer-motion'],
    webpack: (config, { dev }) => {
      // HMR is disabled via DISABLE_HMR env var; file watching stays disabled during edits.
      if (dev && process.env.DISABLE_HMR === 'true') {
        config.watchOptions = {
          ignored: /.*/,
        };
      }
      return config;
    },
  };
}
