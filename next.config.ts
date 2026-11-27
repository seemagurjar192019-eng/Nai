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
      unoptimized: true,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
          port: '',
          pathname: '/**',
        },
      ],
    },
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
