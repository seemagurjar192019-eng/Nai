import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://ais-dev-b5572c6vlenhbxhdhwmdvx-303612259339.asia-east1.run.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/privacy', '/terms', '/delete-account'],
      disallow: ['/api/'],
    },
    sitemap: `${APP_ORIGIN.replace(/\/$/, '')}/sitemap.xml`,
  };
}
