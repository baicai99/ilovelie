/**
 * .fake 文件管理器集成助手
 * 为现有替换器提供 .fake 文件同步支持
 */
import { HistoryManager } from './historyManager';
import { HistoryRecord } from './types';

export class FakeFileIntegrator {
    private historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

    /**
     * 添加历史记录并同步到 .fake 文件
     */
    public async addRecordWithFakeSync(record: HistoryRecord): Promise<void> {
        await this.historyManager.addRecord(record);
    }

    /**
     * 批量添加历史记录并同步到 .fake 文件
     */
    public async addRecordsWithFakeSync(records: HistoryRecord[]): Promise<void> {
        for (const record of records) {
            await this.historyManager.addRecord(record);
        }
    }
}
