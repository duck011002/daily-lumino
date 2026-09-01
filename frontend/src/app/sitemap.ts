import { MetadataRoute } from 'next'

// 静态已知核心路由
const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: 'https://lovestory1314.fun',
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1.0,
  },
  {
    url: 'https://lovestory1314.fun/blog',
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    url: 'https://lovestory1314.fun/library',
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let blogRoutes: MetadataRoute.Sitemap = []
  try {
    const apiOrigin = process.env.LUMINO_API_ORIGIN || 'http://127.0.0.1:8000'
    const res = await fetch(`${apiOrigin}/api/blog/posts`, {
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const data = await res.json()
      const posts = Array.isArray(data) ? data : data.items || []
      blogRoutes = posts.map((post: any) => ({
        url: `https://lovestory1314.fun/blog/${post.slug || post.id}`,
        lastModified: new Date(post.updated_at || post.published_at || post.created_at || Date.now()),
        changeFrequency: 'monthly',
        priority: 0.7,
      }))
    }
  } catch (error) {
    console.warn('Failed to fetch dynamic sitemap posts, falling back to static routes.')
  }
  return [...staticRoutes, ...blogRoutes]
}
