// touch-gestures.ts - 移动端触摸手势处理工具
// 提供触摸友好的交互功能，包括拖拽、缩放、旋转等手势

export interface TouchPoint {
    x: number;
    y: number;
    id: number;
}

export interface GestureEvent {
    type: 'tap' | 'pan' | 'pinch' | 'rotate' | 'swipe';
    touches: TouchPoint[];
    deltaX?: number;
    deltaY?: number;
    scale?: number;
    rotation?: number;
    velocity?: number;
    direction?: 'left' | 'right' | 'up' | 'down';
}

export class TouchGestureHandler {
    private element: HTMLElement;
    private callbacks: Map<string, Function[]> = new Map();
    private touches: Map<number, TouchPoint> = new Map();
    private initialDistance: number = 0;
    private initialAngle: number = 0;
    private initialScale: number = 1;
    private lastTouchTime: number = 0;
    private tapTimeout: number | null = null;
    private panStartTime: number = 0;
    private panStartPoint: TouchPoint | null = null;

    constructor(element: HTMLElement) {
        this.element = element;
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // 触摸事件
        this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });

        // 鼠标事件（用于桌面端测试）
        this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    private handleTouchStart(e: TouchEvent): void {
        e.preventDefault();

        const currentTime = Date.now();
        const touches = Array.from(e.touches);

        // 更新触摸点
        this.touches.clear();
        touches.forEach(touch => {
            this.touches.set(touch.identifier, {
                x: touch.clientX,
                y: touch.clientY,
                id: touch.identifier
            });
        });

        if (touches.length === 1) {
            // 单指触摸 - 可能是点击或拖拽
            const touch = touches[0];
            this.panStartPoint = {
                x: touch.clientX,
                y: touch.clientY,
                id: touch.identifier
            };
            this.panStartTime = currentTime;

            // 检测双击
            if (currentTime - this.lastTouchTime < 300) {
                this.emit('tap', {
                    type: 'tap',
                    touches: Array.from(this.touches.values())
                });
                if (this.tapTimeout) {
                    clearTimeout(this.tapTimeout);
                    this.tapTimeout = null;
                }
            } else {
                // 延迟触发单击事件
                this.tapTimeout = window.setTimeout(() => {
                    this.emit('tap', {
                        type: 'tap',
                        touches: Array.from(this.touches.values())
                    });
                    this.tapTimeout = null;
                }, 300);
            }

            this.lastTouchTime = currentTime;
        } else if (touches.length === 2) {
            // 双指触摸 - 缩放或旋转
            const touch1 = touches[0];
            const touch2 = touches[1];

            this.initialDistance = this.getDistance(touch1, touch2);
            this.initialAngle = this.getAngle(touch1, touch2);

            // 取消单击事件
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
                this.tapTimeout = null;
            }
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        e.preventDefault();

        const touches = Array.from(e.touches);

        if (touches.length === 1 && this.panStartPoint) {
            // 单指拖拽
            const touch = touches[0];
            const deltaX = touch.clientX - this.panStartPoint.x;
            const deltaY = touch.clientY - this.panStartPoint.y;

            // 只有移动距离超过阈值才触发拖拽
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                // 取消点击事件
                if (this.tapTimeout) {
                    clearTimeout(this.tapTimeout);
                    this.tapTimeout = null;
                }

                this.emit('pan', {
                    type: 'pan',
                    touches: [{
                        x: touch.clientX,
                        y: touch.clientY,
                        id: touch.identifier
                    }],
                    deltaX,
                    deltaY
                });
            }
        } else if (touches.length === 2) {
            // 双指缩放和旋转
            const touch1 = touches[0];
            const touch2 = touches[1];

            const currentDistance = this.getDistance(touch1, touch2);
            const currentAngle = this.getAngle(touch1, touch2);

            const scale = currentDistance / this.initialDistance;
            const rotation = currentAngle - this.initialAngle;

            this.emit('pinch', {
                type: 'pinch',
                touches: [
                    { x: touch1.clientX, y: touch1.clientY, id: touch1.identifier },
                    { x: touch2.clientX, y: touch2.clientY, id: touch2.identifier }
                ],
                scale
            });

            if (Math.abs(rotation) > 5) {
                this.emit('rotate', {
                    type: 'rotate',
                    touches: [
                        { x: touch1.clientX, y: touch1.clientY, id: touch1.identifier },
                        { x: touch2.clientX, y: touch2.clientY, id: touch2.identifier }
                    ],
                    rotation
                });
            }
        }
    }

    private handleTouchEnd(e: TouchEvent): void {
        const currentTime = Date.now();

        // 检测滑动手势
        if (this.panStartPoint && this.panStartTime) {
            const duration = currentTime - this.panStartTime;
            const remainingTouches = Array.from(e.touches);

            if (remainingTouches.length === 0 && duration < 500) {
                // 计算滑动速度和方向
                const lastTouch = Array.from(e.changedTouches)[0];
                if (lastTouch) {
                    const deltaX = lastTouch.clientX - this.panStartPoint.x;
                    const deltaY = lastTouch.clientY - this.panStartPoint.y;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    const velocity = distance / duration;

                    if (velocity > 0.5 && distance > 50) {
                        let direction: 'left' | 'right' | 'up' | 'down';

                        if (Math.abs(deltaX) > Math.abs(deltaY)) {
                            direction = deltaX > 0 ? 'right' : 'left';
                        } else {
                            direction = deltaY > 0 ? 'down' : 'up';
                        }

                        this.emit('swipe', {
                            type: 'swipe',
                            touches: [],
                            deltaX,
                            deltaY,
                            velocity,
                            direction
                        });
                    }
                }
            }
        }

        // 清理状态
        if (e.touches.length === 0) {
            this.touches.clear();
            this.panStartPoint = null;
            this.panStartTime = 0;
        }
    }

    private handleTouchCancel(e: TouchEvent): void {
        this.touches.clear();
        this.panStartPoint = null;
        this.panStartTime = 0;

        if (this.tapTimeout) {
            clearTimeout(this.tapTimeout);
            this.tapTimeout = null;
        }
    }

    // 鼠标事件处理（用于桌面端测试）
    private handleMouseDown(e: MouseEvent): void {
        if (e.button === 0) { // 左键
            this.panStartPoint = { x: e.clientX, y: e.clientY, id: 0 };
            this.panStartTime = Date.now();
        }
    }

    private handleMouseMove(e: MouseEvent): void {
        if (this.panStartPoint && e.buttons === 1) {
            const deltaX = e.clientX - this.panStartPoint.x;
            const deltaY = e.clientY - this.panStartPoint.y;

            this.emit('pan', {
                type: 'pan',
                touches: [{ x: e.clientX, y: e.clientY, id: 0 }],
                deltaX,
                deltaY
            });
        }
    }

    private handleMouseUp(e: MouseEvent): void {
        if (this.panStartPoint) {
            const currentTime = Date.now();
            const duration = currentTime - this.panStartTime;

            if (duration < 200) {
                this.emit('tap', {
                    type: 'tap',
                    touches: [{ x: e.clientX, y: e.clientY, id: 0 }]
                });
            }

            this.panStartPoint = null;
            this.panStartTime = 0;
        }
    }

    private getDistance(touch1: Touch, touch2: Touch): number {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private getAngle(touch1: Touch, touch2: Touch): number {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.atan2(dy, dx) * 180 / Math.PI;
    }

    private emit(eventType: string, event: GestureEvent): void {
        const callbacks = this.callbacks.get(eventType);
        if (callbacks) {
            callbacks.forEach(callback => callback(event));
        }
    }

    // 公共方法
    public on(eventType: string, callback: Function): void {
        if (!this.callbacks.has(eventType)) {
            this.callbacks.set(eventType, []);
        }
        this.callbacks.get(eventType)!.push(callback);
    }

    public off(eventType: string, callback?: Function): void {
        if (!callback) {
            this.callbacks.delete(eventType);
        } else {
            const callbacks = this.callbacks.get(eventType);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        }
    }

    public destroy(): void {
        this.callbacks.clear();
        this.touches.clear();

        if (this.tapTimeout) {
            clearTimeout(this.tapTimeout);
            this.tapTimeout = null;
        }
    }
}

// 工具函数
export function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function getViewportSize(): { width: number; height: number } {
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}

export function isMobileDevice(): boolean {
    return window.innerWidth <= 768 || isTouchDevice();
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = window.setTimeout(() => {
            func(...args);
            timeout = null;
        }, wait);
    };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}