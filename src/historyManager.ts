import * as vscode from 'vscode';
import { HistoryRecord } from './types';

/**
 * 历史记录管理器
 * 负责历史记录的增删查改和持久化存储
 */
export class HistoryManager {
    private changeHistory: HistoryRecord[] = [];
    private extensionContext: vscode.ExtensionContext | null = null;

    /**
     * 初始化历史管理器
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.extensionContext = context;
        this.loadHistory();
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }    /**
     * 创建历史记录
     */
    public createHistoryRecord(
        filePath: string,
        originalText: string,
        newText: string,
        range: vscode.Range,
        type: 'manual-replace' | 'dictionary-replace' | 'ai-replace' | 'ai-batch-replace' | 'ai-selective-replace' | 'hide-comment' = 'manual-replace'
    ): HistoryRecord {
        return {
            id: this.generateId(),
            filePath,
            originalText,
            newText,
            timestamp: Date.now(),
            type: type,
            startPosition: { line: range.start.line, character: range.start.character },
            endPosition: { line: range.end.line, character: range.end.character }
        };
    }

    /**
     * 添加历史记录
     */
    public addRecord(record: HistoryRecord): void {
        this.changeHistory.push(record);
        this.saveHistory();
    }

    /**
     * 获取所有历史记录
     */
    public getAllRecords(): HistoryRecord[] {
        return [...this.changeHistory];
    }

    /**
     * 获取指定文件的历史记录
     */
    public getFileRecords(filePath: string): HistoryRecord[] {
        return this.changeHistory.filter(record => record.filePath === filePath);
    }

    /**
     * 根据ID查找记录
     */
    public getRecordById(id: string): HistoryRecord | null {
        return this.changeHistory.find(record => record.id === id) || null;
    }

    /**
     * 根据ID移除记录
     */
    public removeRecordById(id: string): boolean {
        const index = this.changeHistory.findIndex(record => record.id === id);
        if (index !== -1) {
            this.changeHistory.splice(index, 1);
            this.saveHistory();
            return true;
        }
        return false;
    }

    /**
     * 清除所有历史记录
     */
    public clearAllRecords(): void {
        this.changeHistory = [];
        this.saveHistory();
    }

    /**
     * 获取记录总数
     */
    public getRecordCount(): number {
        return this.changeHistory.length;
    }

    /**
     * 保存历史记录到持久化存储
     */
    private saveHistory(): void {
        if (this.extensionContext) {
            this.extensionContext.globalState.update('changeHistory', this.changeHistory);
        }
    }    /**
     * 从持久化存储加载历史记录
     */
    private loadHistory(): void {
        if (this.extensionContext) {
            const savedHistory = this.extensionContext.globalState.get<any[]>('changeHistory', []);
            this.changeHistory = savedHistory.map(record => ({
                ...record,
                timestamp: typeof record.timestamp === 'number' ? record.timestamp :
                    (record.timestamp instanceof Date ? record.timestamp.getTime() : Date.now())
            }));
        }
    }
}
