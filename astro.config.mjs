import {
  defineConfig
} from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://zimagestudio.com",
  output: 'static', // 使用静态输出，API 路由在客户端调用云函数
  integrations: [
    react(),
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
      include: [
        '@astrojs/tailwind',
        '@astrojs/react',
        'react',
        'react-dom',
        'react/jsx-runtime',
        'tslib'
      ],
      exclude: [
        'debug', // 排除 debug 包，避免 ESM/CommonJS 兼容性问题
        'fsevents' // 排除原生模块，避免 esbuild 处理 .node 文件
      ],
      force: false, // 设置为 true 可以强制重新预构建，但通常不需要
      esbuildOptions: {
        // 配置 esbuild 以排除原生模块
        plugins: [],
        external: ['fsevents'],
        platform: 'node',
        target: 'node18'
      }
    },
    ssr: {
      // SSR 模式下排除原生模块
      noExternal: [],
      external: ['fsevents']
    },
    // 构建配置
    build: {
      minify: 'terser', // 使用 terser 而不是 esbuild
      terserOptions: {
        compress: {
          drop_console: true, // 生产环境移除 console 语句
          drop_debugger: true, // 生产环境移除 debugger 语句
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'] // 移除特定的console函数
        }
      },
      rollupOptions: {
        external: ['fsevents'], // 排除原生模块
        output: {
          manualChunks: undefined
        }
      },
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
        exclude: ['fsevents'] // 排除原生模块
      }
    },
    resolve: {
      alias: {
        tslib: 'tslib'
      },
      // 排除原生模块
      conditions: ['import', 'module', 'browser', 'default']
    },
  }
});