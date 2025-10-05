/**
 * Vitest测试配置
 * 配置测试环境和测试选项
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        // 测试环境
        environment: 'jsdom',

        // 全局设置文件
        setupFiles: ['./tests/setup.ts'],

        // 测试文件匹配模式
        include: [
            'tests/**/*.test.ts',
            'tests/**/*.spec.ts'
        ],

        // 排除的文件
        exclude: [
            'node_modules',
            'dist',
            '.astro'
        ],

        // 全局变量
        globals: true,

        // 测试超时时间
        testTimeout: 10000,

        // 钩子超时时间
        hookTimeout: 10000,

        // 覆盖率配置
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage',
            exclude: [
                'node_modules/',
                'tests/',
                'dist/',
                '.astro/',
                '**/*.d.ts',
                '**/*.config.*',
                '**/coverage/**'
            ],
            thresholds: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80
                }
            }
        },

        // 并行执行
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: false,
                maxThreads: 4,
                minThreads: 1
            }
        },

        // 报告器
        reporter: ['verbose', 'json', 'html'],

        // 输出目录
        outputFile: {
            json: './test-results/results.json',
            html: './test-results/index.html'
        },

        // 监听模式配置
        watch: false,

        // 失败时停止
        bail: 0,

        // 重试次数
        retry: 2,

        // 慢测试阈值
        slowTestThreshold: 5000,

        // 测试序列化
        sequence: {
            shuffle: false,
            concurrent: true
        }
    },

    // 路径解析
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@tests': resolve(__dirname, './tests')
        }
    },

    // 定义全局变量
    define: {
        __TEST__: true
    },

    // 优化依赖
    optimizeDeps: {
        include: ['vitest/globals']
    }
});