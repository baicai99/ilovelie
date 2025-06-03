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
    }    /**
     * 永久清除指定文件的所有撒谎记录
     * 这将完全删除历史记录，无法恢复
     */
    public clearRecordsForFile(documentUri: string): { success: boolean; clearedCount: number } {
        const recordsToRemove = this.getRecordsForFile(documentUri);
        const count = recordsToRemove.length;

        // 移除所有相关记录
        this.changeHistory = this.changeHistory.filter(record =>
            record.filePath !== documentUri &&
            record.filePath !== vscode.Uri.parse(documentUri).fsPath
        );

        this.saveHistory();

        console.log(`[DEBUG] 永久清除文件 ${documentUri} 的 ${count} 条记录`);

        return {
            success: true,
            clearedCount: count
        };
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

    /**
     * 获取指定文件的历史记录 (使用URI字符串)
     */
    public getRecordsForFile(documentUri: string): HistoryRecord[] {
        // 支持文件路径和URI两种格式
        return this.changeHistory.filter(record =>
            record.filePath === documentUri ||
            record.filePath === vscode.Uri.parse(documentUri).fsPath
        );
    }    /**
     * 临时恢复指定文件的所有记录（用于切换显示，不删除历史记录）
     */
    public async temporaryRestoreAllForFile(documentUri: string): Promise<{ success: boolean; restoredCount: number; errorMessage?: string }> {
        try {
            console.log(`[DEBUG] 开始临时恢复文件 ${documentUri} 的所有记录`);

            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            const editor = await vscode.window.showTextDocument(document);

            const records = this.getRecordsForFile(documentUri);
            console.log(`[DEBUG] 找到 ${records.length} 条记录待临时恢复`);

            if (records.length === 0) {
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

                    // 检查当前文本是否匹配记录中的新文本
                    const currentText = document.getText(range);
                    console.log(`[DEBUG] 记录 ${record.id} - 当前文本: "${currentText}", 期望文本: "${record.newText}", 恢复文本: "${record.originalText}"`);

                    if (currentText === record.newText) {
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
    }

    /**
     * 恢复指定文件的所有记录（永久性恢复，会删除历史记录）
     */
    public async restoreAllForFile(documentUri: string): Promise<{ success: boolean; restoredCount: number; errorMessage?: string }> {
        try {
            console.log(`[DEBUG] 开始恢复文件 ${documentUri} 的所有记录`);

            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            const editor = await vscode.window.showTextDocument(document);

            const records = this.getRecordsForFile(documentUri);
            console.log(`[DEBUG] 找到 ${records.length} 条记录待恢复`);

            if (records.length === 0) {
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

                    // 检查当前文本是否匹配记录中的新文本
                    const currentText = document.getText(range);
                    console.log(`[DEBUG] 记录 ${record.id} - 当前文本: "${currentText}", 期望文本: "${record.newText}", 恢复文本: "${record.originalText}"`);

                    if (currentText === record.newText) {
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

            console.log(`[DEBUG] 恢复完成，共恢复 ${editOperations.length} 条记录`);

            return {
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
