import type { Metadata } from 'next'
import BlogPostClient, { BlogPost, getEnhancedAlt } from './BlogPostClient'

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const apiOrigin = process.env.LUMINO_API_ORIGIN || 'http://127.0.0.1:8000'
    const encodedSlug = encodeURIComponent(slug)
    const res = await fetch(`${apiOrigin}/api/public/blog/posts/${encodedSlug}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) {
    return {
      title: '文章详情',
      alternates: {
        canonical: `/blog/${params.slug}`,
      },
    }
  }

  const title = post.title
  const description = post.excerpt || post.title
  const coverImage = post.cover_url || '/i/2026/08/27/6a90081e86845.png'

  return {
    title,
    description,
    alternates: {
      canonical: `/blog/${params.slug}`,
    },
    openGraph: {
      title: `${title} | Lumino 数字花园`,
      description,
      type: 'article',
      url: `https://lovestory1314.fun/blog/${params.slug}`,
      images: [
        {
          url: coverImage,
          alt: getEnhancedAlt(coverImage, title),
        },
      ],
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string }
}) {
  const post = await getPost(params.slug)

  const schemaArticle = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || post.title,
        image: post.cover_url ? [post.cover_url] : undefined,
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author: {
          '@type': 'Person',
          name: post.author?.display_name || post.author?.username || 'Lumino',
        },
      }
    : null

  return (
    <>
      {schemaArticle && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaArticle) }}
        />
      )}
      <BlogPostClient slug={params.slug} initialPost={post} />
    </>
  )
}
