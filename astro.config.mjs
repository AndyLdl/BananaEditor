import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  site: "https://bananaeditor.com",
  integrations: [
    tailwind({
      applyBaseStyles: false, // 使用自定义全局样式
    }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          zh: 'zh-CN',
          es: 'es',
          fr: 'fr',
        },
      },
    }),
    icon()
  ],

  // 多语言配置
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'es', 'fr'],
    routing: {
      prefixDefaultLocale: false
    }
  },

  // 构建优化
  build: {
    inlineStylesheets: 'auto',
  },

  // 开发服务器配置
  server: {
    port: 3000,
    host: true
  },

  // 实验性功能 - 移除过时的配置

  // Vite配置
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@import "src/styles/globals.css";`
        }
      }
    },
    optimizeDeps: {
      include: ['@astrojs/tailwind']
    }
  }
});
