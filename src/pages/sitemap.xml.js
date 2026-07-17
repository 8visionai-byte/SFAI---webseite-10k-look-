import { services } from '../data/services.js';

const staticPages = ['/', '/uslugi/', '/realizacje/', '/jak-pracujemy/', '/wiedza/', '/o-nas/', '/kontakt/'];

export async function GET() {
  const paths = [...staticPages, ...services.map((service) => `/uslugi/${service.slug}/`)];
  const urls = paths.map((path) => `<url><loc>https://www.simplefast.ai${path}</loc><changefreq>${path === '/' ? 'weekly' : 'monthly'}</changefreq><priority>${path === '/' ? '1.0' : path.startsWith('/uslugi/') ? '0.8' : '0.7'}</priority></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
