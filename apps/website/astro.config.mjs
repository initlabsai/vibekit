import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://getvibekit.ai',
  integrations: [
    starlight({
      title: 'VibeKit',
      description: 'The agentic stack for Algorand builders.',
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
      },
      customCss: ['./src/styles/docs.css'],
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/initlabsai/vibekit' }],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Your first project', slug: 'docs/tutorials/first-project' },
            { label: 'Explore with VibeKit', slug: 'docs/tutorials/explore-with-vibekit' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Add VibeKit to a project', slug: 'docs/guides/add-to-an-existing-project' },
            { label: 'Create a VibeKit plugin', slug: 'docs/guides/create-a-vibekit-plugin' },
            { label: 'Create a custom MCP', slug: 'docs/guides/create-a-custom-mcp' },
            { label: 'Add a companion', slug: 'docs/guides/add-a-companion' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Installation', slug: 'docs/reference/installation' },
            { label: 'Configuration', slug: 'docs/reference/configuration' },
            { label: 'How VibeKit works', slug: 'docs/explanation/how-vibekit-works' },
          ],
        },
      ],
      head: [
        { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500&display=swap' } },
        { tag: 'meta', attrs: { property: 'og:site_name', content: 'VibeKit' } },
        { tag: 'meta', attrs: { property: 'og:image', content: 'https://getvibekit.ai/og-image.png' } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://getvibekit.ai/og-image.png' } },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#0a0b0e' } },
      ],
    }),
  ],
})
