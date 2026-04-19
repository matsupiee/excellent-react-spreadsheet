import { defineConfig } from 'vitepress';

const GITHUB_URL = 'https://github.com/matsupiee/excellent-react-spreadsheet';

export default defineConfig({
  title: 'excellent-react-spreadsheet',
  description:
    'Headless, controlled, TypeScript-first spreadsheet for React. Ships under 30 kB gzipped with built-in undo/redo, copy/paste, and virtualization.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['**/README.md'],
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'excellent-react-spreadsheet' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Headless, controlled, TypeScript-first spreadsheet for React — under 30 kB gzipped.',
      },
    ],
    ['meta', { name: 'theme-color', content: '#0ea5e9' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'excellent-react-spreadsheet',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
      { text: 'API', link: '/api/', activeMatch: '^/api/' },
      { text: 'Playground', link: '/playground' },
      { text: 'Comparison', link: '/comparison' },
      { text: 'Roadmap', link: '/roadmap' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Columns', link: '/guide/columns' },
            { text: 'Undo / Redo', link: '/guide/undo-redo' },
            { text: 'Copy & Paste', link: '/guide/copy-paste' },
            { text: 'Virtualization', link: '/guide/virtualization' },
            { text: 'Styling', link: '/guide/styling' },
          ],
        },
        {
          text: 'Recipes',
          items: [{ text: 'Common patterns', link: '/guide/recipes' }],
        },
      ],
      '/api/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'useSpreadsheet', link: '/api/use-spreadsheet' },
            { text: 'Spreadsheet props', link: '/api/spreadsheet' },
            { text: 'Column factories', link: '/api/columns' },
            { text: 'History engine', link: '/api/history' },
            { text: 'Clipboard helpers', link: '/api/clipboard' },
            { text: 'Row virtualizer', link: '/api/virtualizer' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: GITHUB_URL }],
    search: { provider: 'local' },
    editLink: {
      pattern: `${GITHUB_URL}/edit/main/apps/site/:path`,
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: `Copyright © ${new Date().getFullYear()} matsupiee`,
    },
    outline: { level: [2, 3] },
  },
});
