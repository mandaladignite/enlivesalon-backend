/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  exclude: ['/admin/*', '/auth/*', '/api/*'],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/auth/', '/api/'],
      },
    ],
    additionalSitemaps: [
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/sitemap.xml`,
    ],
  },
  transform: async (config, path) => {
    // Custom transform for different page types
    const customConfig = {
      loc: path,
      changefreq: 'daily',
      priority: 0.7,
      lastmod: new Date().toISOString(),
    };

    // Homepage gets highest priority
    if (path === '/') {
      customConfig.priority = 1.0;
      customConfig.changefreq = 'daily';
    }

    // Service pages get high priority
    if (path.includes('/hair') || path.includes('/skin') || path.includes('/nail') || path.includes('/body')) {
      customConfig.priority = 0.9;
      customConfig.changefreq = 'weekly';
    }

    // Static pages get medium priority
    if (path.includes('/aboutus') || path.includes('/contact') || path.includes('/gallery')) {
      customConfig.priority = 0.8;
      customConfig.changefreq = 'monthly';
    }

    return customConfig;
  },
};
