/**
 * 并发控制工具类
 * 用于限制同时执行的异步任务数量，防止 API 限流
 */
export class ConcurrencyLimiter {
    private queue: Array<() => Promise<any>> = [];
    private running = 0;

    constructor(private maxConcurrency: number = 3) { }

    /**
     * 执行异步任务，受并发数量限制
     * @param task 要执行的异步任务
     * @returns 任务的执行结果
     */
    async run<T>(task: () => Promise<T>): Promise<T> {
        while (this.running >= this.maxConcurrency) {
            // 等待有任务完成
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.running++;

        try {
            const result = await task();
            return result;
        } finally {
            this.running--;
        }
    }

    /**
     * 批量执行任务，带并发控制
     * @param tasks 任务数组
     * @returns 所有任务的结果
     */
    async runAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
        return Promise.all(tasks.map(task => this.run(task)));
    }

    /**
     * 智能延迟策略
     * 根据已处理的数量动态调整延迟时间
     * @param processedCount 已处理的数量
     * @param totalCount 总数量
     * @returns 延迟时间（毫秒）
     */
    static calculateDelay(processedCount: number, totalCount: number): number {
        // 前10个请求：无延迟
        if (processedCount < 10) {
            return 0;
        }

        // 10-50个请求：50ms 延迟
        if (processedCount < 50) {
            return 50;
        }

        // 50+个请求：渐进式延迟，最多500ms
        const progressRatio = processedCount / totalCount;
        return Math.min(500, 100 + progressRatio * 400);
    }
}
