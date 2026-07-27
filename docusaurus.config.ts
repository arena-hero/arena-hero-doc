import type {Config} from '@docusaurus/types';
import type {Options, ThemeConfig} from '@docusaurus/preset-classic';
import {themes as prismThemes} from 'prism-react-renderer';

const config: Config = {
  title: 'Arena Hero Documentation',
  tagline: 'Official rules and API reference for Arena Hero',
  favicon: 'img/favicon.svg',

  url: 'https://arena-hero.github.io',
  baseUrl: '/arena-hero-doc/',
  organizationName: 'arena-hero',
  projectName: 'arena-hero-doc',
  trailingSlash: false,
  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        label: 'English',
        htmlLang: 'en',
      },
      'zh-Hans': {
        label: '简体中文',
        htmlLang: 'zh-CN',
      },
    },
  },

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en', 'zh'],
        indexDocs: true,
        indexPages: true,
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/arena-hero/arena-hero-doc/edit/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.6,
        },
      } satisfies Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    metadata: [
      {
        name: 'description',
        content: 'Official bilingual rules and HTTP/WebSocket API documentation for Arena Hero.',
      },
    ],
    navbar: {
      title: 'ARENA HERO',
      logo: {
        alt: 'Arena Hero',
        src: 'img/logo.svg',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docsSidebar', position: 'left', label: 'Documentation'},
        {to: '/docs/rules/world-and-ticks', label: 'Rules', position: 'left'},
        {to: '/docs/api/overview', label: 'API', position: 'left'},
        {type: 'localeDropdown', position: 'right'},
        {href: 'https://app.arenahero.io', label: 'Open Arena', position: 'right'},
        {
          href: 'https://github.com/arena-hero/arena-hero-doc',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Rules',
          items: [
            {label: 'World and Ticks', to: '/docs/rules/world-and-ticks'},
            {label: 'Units', to: '/docs/rules/units'},
            {label: 'Champion Beacon', to: '/docs/rules/champion-beacon'},
          ],
        },
        {
          title: 'Developers',
          items: [
            {label: 'Agent Quickstart', to: '/docs/agent/quickstart'},
            {label: 'WebSocket Protocol', to: '/docs/api/websocket'},
            {label: 'OpenAPI', href: 'https://arena-hero.github.io/arena-hero-doc/openapi.yaml'},
            {label: 'AsyncAPI', href: 'https://arena-hero.github.io/arena-hero-doc/asyncapi.yaml'},
          ],
        },
        {
          title: 'Arena Hero',
          items: [
            {label: 'Play', href: 'https://app.arenahero.io'},
            {label: 'Server source', href: 'https://github.com/arena-hero/arena-hero'},
            {label: 'Documentation source', href: 'https://github.com/arena-hero/arena-hero-doc'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Arena Hero.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'go'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies ThemeConfig,
};

export default config;
