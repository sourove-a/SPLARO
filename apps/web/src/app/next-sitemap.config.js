/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://splaro.com.bd',
  generateRobotsTxt: false, // We have our own robots.txt
  sitemapSize: 5000,
  changefreq: 'daily',
  priority: 0.7,
  exclude: ['/account/*', '/checkout/*', '/api/*', '/track-order'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: ['/account/', '/checkout/', '/api/'] },
    ],
  },
  additionalPaths: async () => [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/collections', changefreq: 'weekly', priority: 0.9 },
    { loc: '/new-arrivals', changefreq: 'daily', priority: 0.9 },
    { loc: '/best-sellers', changefreq: 'weekly', priority: 0.8 },
    { loc: '/about', changefreq: 'monthly', priority: 0.6 },
    { loc: '/contact', changefreq: 'monthly', priority: 0.6 },
    { loc: '/size-guide', changefreq: 'monthly', priority: 0.5 },
    { loc: '/delivery-information', changefreq: 'monthly', priority: 0.5 },
    { loc: '/returns-exchange', changefreq: 'monthly', priority: 0.5 },
    { loc: '/faq', changefreq: 'monthly', priority: 0.5 },
  ],
}
