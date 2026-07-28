import type {Config} from '@docusaurus/types';
import type {Options, ThemeConfig} from '@docusaurus/preset-classic';
import {themes as prismThemes} from 'prism-react-renderer';

const config: Config = {
  title: 'Arena Hero',
  tagline: 'Rules and API',
  favicon: 'img/favicon.svg',

  url: 'https://arena-hero.github.io',
  baseUrl: '/',
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
        docsRouteBasePath: '/',
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
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/arena-hero/arena-hero-doc/edit/main/',
          editLocalizedFiles: true,
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
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    metadata: [
      {
        name: 'description',
        content: 'Arena Hero rules and game API documentation.',
      },
    ],
    navbar: {
      title: 'Arena Hero',
      logo: {
        alt: 'Arena Hero',
        src: 'img/logo.svg',
      },
      items: [
        {type: 'localeDropdown', position: 'right'},
        {
          href: 'https://github.com/arena-hero/arena-hero-doc',
          label: 'GitHub',
          position: 'right',
        },
      ],
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
