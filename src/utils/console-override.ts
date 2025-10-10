/**
 * 生产环境console重写
 * 在生产环境中禁用所有console输出
 */

// 检查是否为生产环境
const isProduction = import.meta.env.PROD || import.meta.env.NODE_ENV === 'production';

if (isProduction) {
    // 在生产环境中重写console方法
    const noop = () => { };

    // 重写所有console方法
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    console.error = noop;
    console.trace = noop;
    console.table = noop;
    console.group = noop;
    console.groupEnd = noop;
    console.groupCollapsed = noop;
    console.time = noop;
    console.timeEnd = noop;
    console.timeLog = noop;
    console.count = noop;
    console.countReset = noop;
    console.clear = noop;
    console.dir = noop;
    console.dirxml = noop;
    console.assert = noop;
}

export { };
