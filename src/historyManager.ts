import * as vscode from 'vscode';
import { HistoryRecord } from './types';
import { normalizeComment } from './commentUtils';

/**
 * 历史记录管理器
 * 负责历史记录的增删查改和持久化存储
 */
export class HistoryManager {
    private changeHistory: HistoryRecord[] = [];
    private extensionContext: vscode.ExtensionContext | null = null;
    private currentSessions: Map<string, string> = new Map(); // filePath -> sessionId

    constructor() {
    }

    /**
     * 初始化历史管理器
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.extensionContext = context;
        this.loadHistory();
    }    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 生成会话ID
     */
    private generateSessionId(): string {
        return 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2);
    }

    /**
     * 开始新的撒谎会话
     */
    public startLieSession(filePath: string): string {
        const sessionId = this.generateSessionId();
        this.currentSessions.set(filePath, sessionId);
        console.log(`[DEBUG] 开始新的撒谎会话: ${sessionId} for file: ${filePath}`);
        return sessionId;
    }    /**
     * 结束撒谎会话
     */
    public endLieSession(filePath: string): void {
        const sessionId = this.currentSessions.get(filePath);
        if (sessionId) {
            console.log(`[DEBUG] 结束撒谎会话: ${sessionId} for file: ${filePath}`);
            this.currentSessions.delete(filePath);
            // 保留历史记录，但标记会话为结束状态
            this.changeHistory.forEach(record => {
                if (record.sessionId === sessionId) {
                    record.isActive = false;
                    // 添加会话结束时间戳
                    record.sessionEndTime = Date.now();
                }
            });
            this.saveHistory();
        }
    }

    /**
     * 获取文件的当前活跃会话ID
     */
    public getCurrentSessionId(filePath: string): string | undefined {
        return this.currentSessions.get(filePath);
    }

    /**
     * 检查文件是否有活跃的撒谎会话
     */
    public hasActiveSession(filePath: string): boolean {
        return this.currentSessions.has(filePath);
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
        const sessionId = this.getCurrentSessionId(filePath);
        return {
            id: this.generateId(),
            filePath,
            originalText,
            newText,
            timestamp: Date.now(),
            type: type,
            startPosition: { line: range.start.line, character: range.start.character },
            endPosition: { line: range.end.line, character: range.end.character },
            sessionId: sessionId,
            isActive: sessionId !== undefined
        };
    }    /**
     * 添加历史记录
     */
    public async addRecord(record: HistoryRecord): Promise<void> {
        // 使用新的版本管理方法
        await this.addRecordWithVersioning(record);
    }

    /**
     * 添加历史记录（增强版本，支持版本管理）
     */
    public async addRecordWithVersioning(record: HistoryRecord): Promise<void> {
        // 如果记录没有会话ID，但文件有活跃会话，则分配当前会话ID
        if (!record.sessionId && this.hasActiveSession(record.filePath)) {
            record.sessionId = this.getCurrentSessionId(record.filePath);
            record.isActive = true;
        }

        // 检查是否有相同位置的历史记录，设置版本号
        const existingRecords = this.changeHistory.filter(existing =>
            existing.filePath === record.filePath &&
            existing.startPosition.line === record.startPosition.line &&
            existing.startPosition.character === record.startPosition.character &&
            existing.endPosition.line === record.endPosition.line &&
            existing.endPosition.character === record.endPosition.character
        );

        if (existingRecords.length > 0) {
            const maxVersion = Math.max(...existingRecords.map(r => r.versionNumber || 1));
            record.versionNumber = maxVersion + 1;
        } else {
            record.versionNumber = 1;
        }

        this.changeHistory.push(record);
        this.saveHistory();
        console.log(`[DEBUG] 添加历史记录: ${record.id}, 会话: ${record.sessionId}, 活跃: ${record.isActive}, 版本: ${record.versionNumber}`);
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
    }    /**
     * 永久清除指定文件的所有撒谎记录
     * 这将完全删除历史记录，无法恢复
     */
    public async clearRecordsForFile(documentUri: string): Promise<{ success: boolean; clearedCount: number }> {
        const recordsToRemove = this.getRecordsForFile(documentUri);
        const count = recordsToRemove.length;

        // 移除所有相关记录
        this.changeHistory = this.changeHistory.filter(record =>
            record.filePath !== documentUri &&
            record.filePath !== vscode.Uri.parse(documentUri).fsPath
        );

        // 同时清理该文件的会话信息
        const filePath = vscode.Uri.parse(documentUri).fsPath;
        this.currentSessions.delete(filePath);
        this.currentSessions.delete(documentUri);

        this.saveHistory();

        console.log(`[DEBUG] 永久清除文件 ${documentUri} 的 ${count} 条记录`);

        return {
            success: true,
            clearedCount: count
        };
    }

    /**
     * 清理老旧的非活跃记录（可选的维护操作）
     */
    public cleanupOldRecords(maxAge: number = 7 * 24 * 60 * 60 * 1000): number { // 默认7天
        const cutoffTime = Date.now() - maxAge;
        const initialCount = this.changeHistory.length;

        this.changeHistory = this.changeHistory.filter(record => {
            // 保留活跃记录，即使它们很老
            if (record.isActive === true) {
                return true;
            }
            // 保留较新的记录
            return record.timestamp > cutoffTime;
        });

        const cleanedCount = initialCount - this.changeHistory.length;
        if (cleanedCount > 0) {
            this.saveHistory();
            console.log(`[DEBUG] 清理了 ${cleanedCount} 条老旧记录`);
        }

        return cleanedCount;
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
                    (record.timestamp instanceof Date ? record.timestamp.getTime() : Date.now()),
                // 为老记录设置默认值
                sessionId: record.sessionId || undefined,
                isActive: record.isActive !== undefined ? record.isActive : false,
                sessionEndTime: record.sessionEndTime || undefined,
                versionNumber: record.versionNumber || 1
            }));

            // 重建会话映射（仅对活跃记录）
            this.currentSessions.clear();
            this.changeHistory.forEach(record => {
                if (record.isActive && record.sessionId) {
                    this.currentSessions.set(record.filePath, record.sessionId);
                }
            });

            console.log(`[DEBUG] 加载了 ${this.changeHistory.length} 条历史记录，重建了 ${this.currentSessions.size} 个活跃会话`);
        }
    }/**
     * 获取指定文件的历史记录 (使用URI字符串)
     */
    public getRecordsForFile(documentUri: string): HistoryRecord[] {
        // 支持文件路径和URI两种格式
        return this.changeHistory.filter(record =>
            record.filePath === documentUri ||
            record.filePath === vscode.Uri.parse(documentUri).fsPath
        );
    }

    /**
     * 获取指定文件的活跃会话记录（仅用于恢复操作）
     */
    public getActiveRecordsForFile(documentUri: string): HistoryRecord[] {
        const filePath = vscode.Uri.parse(documentUri).fsPath;
        const currentSessionId = this.getCurrentSessionId(filePath) || this.getCurrentSessionId(documentUri);

        const activeRecords = this.changeHistory.filter(record => {
            const matchesFile = record.filePath === documentUri || record.filePath === filePath;
            const isActive = record.isActive === true || (record.sessionId && record.sessionId === currentSessionId);
            return matchesFile && isActive;
        }); console.log(`[DEBUG] 获取文件 ${documentUri} 的活跃记录: 总记录数 ${this.changeHistory.length}, 文件匹配记录数 ${this.getRecordsForFile(documentUri).length}, 活跃记录数 ${activeRecords.length}`);
        console.log(`[DEBUG] 当前会话ID: ${currentSessionId}`);

        return activeRecords;
    }

    /**
     * 重新激活指定文件的历史记录
     */
    public reactivateRecordsForFile(documentUri: string, sessionId: string): void {
        const filePath = vscode.Uri.parse(documentUri).fsPath;
        let reactivatedCount = 0;

        this.changeHistory.forEach(record => {
            const matchesFile = record.filePath === documentUri || record.filePath === filePath;
            if (matchesFile && !record.isActive) {
                console.log(`[DEBUG] 重新激活记录: ${record.id}`);
                record.isActive = true;
                record.sessionId = sessionId;
                record.sessionEndTime = undefined; // 清除结束时间
                reactivatedCount++;
            }
        });

        console.log(`[DEBUG] 重新激活了 ${reactivatedCount} 条记录`);
        this.saveHistory();
    }    /**
     * 临时恢复指定文件的所有记录（用于切换显示，不删除历史记录）
     */
    public async temporaryRestoreAllForFile(documentUri: string): Promise<{ success: boolean; restoredCount: number; errorMessage?: string }> {
        try {
            console.log(`[DEBUG] 开始临时恢复文件 ${documentUri} 的活跃记录`);

            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            const editor = await vscode.window.showTextDocument(document);

            // 只获取活跃会话的记录
            const records = this.getActiveRecordsForFile(documentUri);
            console.log(`[DEBUG] 找到 ${records.length} 条活跃记录待临时恢复`);

            if (records.length === 0) {
                console.log(`[DEBUG] 没有找到活跃记录，可能该文件没有当前的撒谎会话`);
                return {
                    success: true,
                    restoredCount: 0
                };
            }

            // 按位置倒序排序，从文档末尾开始恢复，避免位置偏移
            records.sort((a, b) => {
                if (a.startPosition.line !== b.startPosition.line) {
                    return b.startPosition.line - a.startPosition.line;
                }
                return b.startPosition.character - a.startPosition.character;
            });

            console.log(`[DEBUG] 按位置倒序排序后的记录顺序:`);
            records.forEach((record, index) => {
                console.log(`[DEBUG] ${index}: ${record.id} at ${record.startPosition.line}:${record.startPosition.character}`);
            });

            // 收集所有需要恢复的编辑操作
            const editOperations: Array<{ range: vscode.Range; originalText: string; recordId: string }> = [];

            for (const record of records) {
                try {
                    console.log(`[DEBUG] 检查记录 ${record.id}: 位置 ${record.startPosition.line}:${record.startPosition.character} - ${record.endPosition.line}:${record.endPosition.character}`);

                    const range = new vscode.Range(
                        record.startPosition.line,
                        record.startPosition.character,
                        record.endPosition.line,
                        record.endPosition.character
                    );

                    // 验证范围是否有效
                    if (range.start.line < 0 || range.end.line >= document.lineCount) {
                        console.error(`[DEBUG] 记录 ${record.id} 范围无效: ${range.start.line}-${range.end.line}, 文档总行数: ${document.lineCount}`);
                        continue;
                    }

                    // 检查当前文本是否匹配记录中的新文本或原始文本(规范化比较)
                    const currentText = document.getText(range);
                    console.log(`[DEBUG] 记录 ${record.id} - 当前文本: "${currentText}", 期望文本: "${record.newText}", 恢复文本: "${record.originalText}"`);

                    const normalizedCurrent = normalizeComment(currentText);
                    const normalizedNew = normalizeComment(record.newText);
                    const normalizedOriginal = normalizeComment(record.originalText);

                    if (normalizedCurrent === normalizedNew) {
                        // 检查重叠
                        const hasOverlap = editOperations.some(existing => {
                            return range.intersection(existing.range) !== undefined;
                        });

                        if (hasOverlap) {
                            console.error(`[DEBUG] 记录 ${record.id} 检测到范围重叠，跳过`);
                            continue;
                        }

                        editOperations.push({ range, originalText: record.originalText, recordId: record.id });
                        console.log(`[DEBUG] 记录 ${record.id} 准备临时恢复`);
                    } else if (normalizedCurrent === normalizedOriginal) {
                        console.log(`[DEBUG] 记录 ${record.id} 已处于原始状态，跳过`);
                    } else {
                        console.log(`[DEBUG] 记录 ${record.id} 文本不匹配，跳过恢复`);
                    }
                } catch (error) {
                    console.error(`[DEBUG] 处理记录 ${record.id} 时发生错误:`, error);
                }
            }

            console.log(`[DEBUG] 准备执行 ${editOperations.length} 个临时恢复操作`);

            // 验证所有范围
            const ranges = editOperations.map(op => op.range);
            const validation = this.validateEditRanges(ranges, document);

            if (!validation.valid) {
                console.error(`[DEBUG] 临时恢复范围验证失败:`, validation.errors);
                return {
                    success: false,
                    restoredCount: 0,
                    errorMessage: `临时恢复范围验证失败: ${validation.errors.join('; ')}`
                };
            }

            // 一次性执行所有恢复操作
            if (editOperations.length > 0) {
                try {
                    const editSuccess = await editor.edit(editBuilder => {
                        editOperations.forEach(operation => {
                            console.log(`[DEBUG] 临时恢复记录: ${operation.recordId} at ${operation.range.start.line}:${operation.range.start.character}`);
                            editBuilder.replace(operation.range, operation.originalText);
                        });
                    });

                    if (!editSuccess) {
                        console.error(`[DEBUG] 临时恢复编辑操作失败`);
                        return {
                            success: false,
                            restoredCount: 0,
                            errorMessage: '临时恢复编辑操作执行失败'
                        };
                    }

                    console.log(`[DEBUG] 成功执行 ${editOperations.length} 个临时恢复操作`);
                } catch (error) {
                    console.error(`[DEBUG] 临时恢复编辑操作异常:`, error);
                    return {
                        success: false,
                        restoredCount: 0,
                        errorMessage: `临时恢复编辑操作异常: ${error}`
                    };
                }
            }

            // 注意：临时恢复不删除历史记录
            console.log(`[DEBUG] 临时恢复完成，共恢复 ${editOperations.length} 条记录，历史记录保持不变`);

            return {
                success: true,
                restoredCount: editOperations.length
            };

        } catch (error) {
            console.error(`[DEBUG] 临时恢复过程中发生异常:`, error);
            return {
                success: false,
                restoredCount: 0,
                errorMessage: `临时恢复失败: ${error}`
            };
        }
    }    /**
     * 恢复指定文件的所有记录（永久性恢复，会删除历史记录）
     */
    public async restoreAllForFile(documentUri: string): Promise<{ success: boolean; restoredCount: number; errorMessage?: string }> {
        try {
            console.log(`[DEBUG] 开始恢复文件 ${documentUri} 的活跃记录`);

            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            const editor = await vscode.window.showTextDocument(document);

            // 只获取活跃会话的记录
            const records = this.getActiveRecordsForFile(documentUri);
            console.log(`[DEBUG] 找到 ${records.length} 条活跃记录待恢复`);

            if (records.length === 0) {
                console.log(`[DEBUG] 没有找到活跃记录，可能该文件没有当前的撒谎会话`);
                return {
                    success: true,
                    restoredCount: 0
                };
            }

            // 按位置倒序排序，从文档末尾开始恢复，避免位置偏移
            records.sort((a, b) => {
                if (a.startPosition.line !== b.startPosition.line) {
                    return b.startPosition.line - a.startPosition.line;
                }
                return b.startPosition.character - a.startPosition.character;
            });

            console.log(`[DEBUG] 按位置倒序排序后的记录顺序:`);
            records.forEach((record, index) => {
                console.log(`[DEBUG] ${index}: ${record.id} at ${record.startPosition.line}:${record.startPosition.character}`);
            });

            // 收集所有需要恢复的编辑操作
            const editOperations: Array<{ range: vscode.Range; originalText: string; recordId: string }> = [];
            const recordsToRemove: string[] = [];

            for (const record of records) {
                try {
                    console.log(`[DEBUG] 检查记录 ${record.id}: 位置 ${record.startPosition.line}:${record.startPosition.character} - ${record.endPosition.line}:${record.endPosition.character}`);

                    const range = new vscode.Range(
                        record.startPosition.line,
                        record.startPosition.character,
                        record.endPosition.line,
                        record.endPosition.character
                    );

                    // 验证范围是否有效
                    if (range.start.line < 0 || range.end.line >= document.lineCount) {
                        console.error(`[DEBUG] 记录 ${record.id} 范围无效: ${range.start.line}-${range.end.line}, 文档总行数: ${document.lineCount}`);
                        continue;
                    }

                    // 检查当前文本是否匹配记录中的新文本或原始文本(规范化比较)
                    const currentText = document.getText(range);
                    console.log(`[DEBUG] 记录 ${record.id} - 当前文本: "${currentText}", 期望文本: "${record.newText}", 恢复文本: "${record.originalText}"`);

                    const normalizedCurrent = normalizeComment(currentText);
                    const normalizedNew = normalizeComment(record.newText);
                    const normalizedOriginal = normalizeComment(record.originalText);

                    if (normalizedCurrent === normalizedNew) {
                        // 检查重叠
                        const hasOverlap = editOperations.some(existing => {
                            return range.intersection(existing.range) !== undefined;
                        });

                        if (hasOverlap) {
                            console.error(`[DEBUG] 记录 ${record.id} 检测到范围重叠，跳过`);
                            continue;
                        }

                        editOperations.push({ range, originalText: record.originalText, recordId: record.id });
                        recordsToRemove.push(record.id);
                        console.log(`[DEBUG] 记录 ${record.id} 准备恢复`);
                    } else if (normalizedCurrent === normalizedOriginal) {
                        console.log(`[DEBUG] 记录 ${record.id} 已处于原始状态，跳过`);
                    } else {
                        console.log(`[DEBUG] 记录 ${record.id} 文本不匹配，跳过恢复`);
                    }
                } catch (error) {
                    console.error(`[DEBUG] 处理记录 ${record.id} 时发生错误:`, error);
                }
            } console.log(`[DEBUG] 准备执行 ${editOperations.length} 个恢复操作`);

            // 验证所有范围
            const ranges = editOperations.map(op => op.range);
            const validation = this.validateEditRanges(ranges, document);

            if (!validation.valid) {
                console.error(`[DEBUG] 恢复范围验证失败:`, validation.errors);
                return {
                    success: false,
                    restoredCount: 0,
                    errorMessage: `恢复范围验证失败: ${validation.errors.join('; ')}`
                };
            }

            // 一次性执行所有恢复操作
            if (editOperations.length > 0) {
                try {
                    const editSuccess = await editor.edit(editBuilder => {
                        editOperations.forEach(operation => {
                            console.log(`[DEBUG] 恢复记录: ${operation.recordId} at ${operation.range.start.line}:${operation.range.start.character}`);
                            editBuilder.replace(operation.range, operation.originalText);
                        });
                    });

                    if (!editSuccess) {
                        console.error(`[DEBUG] 恢复编辑操作失败`);
                        return {
                            success: false,
                            restoredCount: 0,
                            errorMessage: '恢复编辑操作执行失败'
                        };
                    }

                    console.log(`[DEBUG] 成功执行 ${editOperations.length} 个恢复操作`);
                } catch (error) {
                    console.error(`[DEBUG] 恢复编辑操作异常:`, error);
                    return {
                        success: false,
                        restoredCount: 0,
                        errorMessage: `恢复编辑操作异常: ${error}`
                    };
                }
            }

            // 移除已恢复的记录
            recordsToRemove.forEach(id => {
                console.log(`[DEBUG] 移除已恢复的记录: ${id}`);
                this.removeRecordById(id);
            });

            console.log(`[DEBUG] 恢复完成，共恢复 ${editOperations.length} 条记录`); return {
                success: true,
                restoredCount: editOperations.length
            };

        } catch (error) {
            console.error(`[DEBUG] 恢复过程中发生异常:`, error);
            return {
                success: false,
                restoredCount: 0,
                errorMessage: `恢复失败: ${error}`
            };
        }
    }

    /**
     * 验证编辑范围是否有效且不重叠
     */
    private validateEditRanges(ranges: vscode.Range[], document: vscode.TextDocument): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // 检查每个范围是否有效
        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];

            // 检查范围是否在文档内
            if (range.start.line < 0 || range.end.line >= document.lineCount) {
                errors.push(`范围 ${i} 超出文档边界: ${range.start.line}-${range.end.line}, 文档行数: ${document.lineCount}`);
                continue;
            }

            // 检查起始位置是否有效
            if (range.start.character < 0 || range.end.character < 0) {
                errors.push(`范围 ${i} 字符位置无效: ${range.start.character}-${range.end.character}`);
                continue;
            }

            // 检查范围是否有效（起始位置不能在结束位置之后）
            if (range.start.isAfter(range.end)) {
                errors.push(`范围 ${i} 起始位置在结束位置之后: ${range.start.line}:${range.start.character} > ${range.end.line}:${range.end.character}`);
                continue;
            }

            // 检查与其他范围是否重叠
            for (let j = i + 1; j < ranges.length; j++) {
                const otherRange = ranges[j];
                if (range.intersection(otherRange) !== undefined) {
                    errors.push(`范围 ${i} 与范围 ${j} 重叠: [${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}] vs [${otherRange.start.line}:${otherRange.start.character}-${otherRange.end.line}:${otherRange.end.character}]`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}
