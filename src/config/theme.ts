/**
 * BananaEditor 品牌主题配置
 * 定义整个应用的色彩系统、字体和视觉风格
 */

export const bananaTheme = {
    // 主色彩系统
    colors: {
        // 香蕉黄主色调
        primary: {
            50: '#FFFBEB',
            100: '#FEF3C7',
            200: '#FDE68A',
            300: '#FCD34D',
            400: '#FBBF24',
            500: '#F59E0B', // 主色
            600: '#D97706',
            700: '#B45309',
            800: '#92400E',
            900: '#78350F'
        },

        // 香蕉渐变色
        secondary: {
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
        },

        // 强调色 - 橙红色
        accent: {
            50: '#FEF2F2',
            100: '#FEE2E2',
            200: '#FECACA',
            300: '#FCA5A5',
            400: '#F87171',
            500: '#EF4444',
            600: '#DC2626',
            700: '#B91C1C',
            800: '#991B1B',
            900: '#7F1D1D'
        },

        // 中性色
        neutral: {
            50: '#FAFAF9',
            100: '#F5F5F4',
            200: '#E7E5E4',
            300: '#D6D3D1',
            400: '#A8A29E',
            500: '#78716C',
            600: '#57534E',
            700: '#44403C',
            800: '#292524',
            900: '#1C1917'
        },

        // 语义化颜色
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6'
    },

    // 渐变色定义
    gradients: {
        primary: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
        secondary: 'linear-gradient(135deg, #FCD34D 0%, #FB923C 100%)',
        accent: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
        hero: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)'
    },

    // 字体系统
    fonts: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Poppins', 'Inter', 'system-ui', 'sans-serif']
    },

    // 字体大小
    fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem'
    },

    // 间距系统
    spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem'
    },

    // 圆角
    borderRadius: {
        none: '0',
        sm: '0.125rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px'
    },

    // 阴影
    shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        banana: '0 8px 32px rgba(245, 158, 11, 0.2)'
    }
} as const;

// 导出类型定义
export type BananaTheme = typeof bananaTheme;
export type ThemeColors = typeof bananaTheme.colors;