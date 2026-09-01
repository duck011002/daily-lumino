import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/courtyard', '/admin', '/login', '/register'],
      },
    ],
    sitemap: 'https://lovestory1314.fun/sitemap.xml',
  }
}
