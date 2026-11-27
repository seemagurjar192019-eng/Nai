import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const APP_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'https://ais-dev-b5572c6vlenhbxhdhwmdvx-303612259339.asia-east1.run.app'
).replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${APP_ORIGIN}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${APP_ORIGIN}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_ORIGIN}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${APP_ORIGIN}/delete-account`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
