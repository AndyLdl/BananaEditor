/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      // BananaEditor 品牌色彩系统
      colors: {
        banana: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B', // 主色
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          // 语义化颜色
          primary: '#FFD700',      // 香蕉黄主色
          secondary: '#FFA500',    // 橙黄辅助色
          accent: '#FF6B35',       // 橙红强调色
          dark: '#2D1810',         // 深棕色
          light: '#FFF8DC',        // 浅黄背景
        },
        // Z-Image Dark Theme
        z: {
          bg: '#050505',
          surface: '#121212',
          surface_hover: '#1E1E1E',
          text: '#FFFFFF',
          text_muted: '#A1A1A1',
          border: '#333333',
        },
        orange: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // 辅助色
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12'
        }
      },

      // 字体系统
      fontFamily: {
        sans: [
          "Inter Variable",
          "Inter",
          ...defaultTheme.fontFamily.sans,
        ],
        display: [
          "Poppins",
          "Inter Variable",
          "Inter",
          ...defaultTheme.fontFamily.sans,
        ],
        mono: [
          "JetBrains Mono",
          "Consolas",
          ...defaultTheme.fontFamily.mono,
        ],
      },

      // 渐变色
      backgroundImage: {
        'banana-gradient': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
        'banana-light': 'linear-gradient(135deg, #FFF8DC 0%, #FFD700 100%)',
        'banana-hero': 'linear-gradient(135deg, #FFF8DC 0%, #FFFBEB 50%, #FEF3C7 100%)',
        'banana-accent': 'linear-gradient(135deg, #FFA500 0%, #FF6B35 100%)',
      },

      // 自定义阴影
      boxShadow: {
        'banana': '0 8px 32px rgba(245, 158, 11, 0.2)',
        'banana-lg': '0 12px 40px rgba(245, 158, 11, 0.3)',
      },

      // 动画
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/forms"),
  ],
};
