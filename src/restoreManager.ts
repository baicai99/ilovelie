import * as vscode from 'vscode';
import { HistoryRecord, RestoreResult } from './types';
import { HistoryManager } from './historyManager';

/**
 * 恢复管理器
 * 负责处理所有恢复相关的操作
 */
export class RestoreManager {
    public historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

    /**
     * 显示历史记录
     */
    public async showHistory(): Promise<void> {
        const allRecords = this.historyManager.getAllRecords();

        if (allRecords.length === 0) {
            vscode.window.showInformationMessage('还没有撒过谎呢！');
            return;
        } const items = allRecords.map((record, index) => ({
            label: `第${record.startPosition.line + 1}行 - ${new Date(record.timestamp).toLocaleString()}`,
            description: `${record.originalText.trim()} → ${record.newText.trim()}`,
            detail: record.filePath,
            index: index
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要查看的撒谎历史',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            vscode.window.showInformationMessage(
                `撒谎详情：\n原始：${allRecords[selected.index].originalText}\n撒谎：${allRecords[selected.index].newText}`
            );
        }
    }

    /**
     * 从历史中还原
     */
    public async restoreFromHistory(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        const allRecords = this.historyManager.getAllRecords();
        if (allRecords.length === 0) {
            vscode.window.showInformationMessage('没有可还原的历史记录');
            return;
        }

        // 只显示当前文件的历史记录
        const currentFilePath = editor.document.uri.fsPath;
        const fileHistory = this.historyManager.getFileRecords(currentFilePath);

        if (fileHistory.length === 0) {
            vscode.window.showInformationMessage('当前文件没有撒谎历史');
            return;
        } const items = fileHistory.map((record) => ({
            label: `第${record.startPosition.line + 1}行 - ${new Date(record.timestamp).toLocaleString()}`,
            description: `撒谎内容：${record.newText.trim()}`,
            detail: `原始内容：${record.originalText.trim()}`,
            record: record
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要还原的撒谎记录',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) {
            return;
        }

        const record = selected.record;        // 使用精确还原函数
        const success = await this.restoreSpecificChange(record);
        if (success) {
            // 从历史记录中移除
            this.historyManager.removeRecordById(record.id);
            vscode.window.showInformationMessage(`第${record.startPosition.line + 1}行已还原为原始内容 😇`);
        } else {
            vscode.window.showErrorMessage('还原失败，可能文件内容已被修改');
        }
    }

    /**
     * 清除所有历史记录
     */
    public async clearAllHistory(): Promise<void> {
        const recordCount = this.historyManager.getRecordCount();

        if (recordCount === 0) {
            vscode.window.showInformationMessage('没有历史记录需要清除');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `确定要清除所有 ${recordCount} 条撒谎历史记录吗？此操作不可撤销！`,
            '确定', '取消'
        );

        if (confirm === '确定') {
            this.historyManager.clearAllRecords();
            vscode.window.showInformationMessage('所有撒谎历史已清除 🗑️');
        }
    }

    /**
     * 精确还原特定的更改
     */
    public async restoreSpecificChange(record: HistoryRecord): Promise<boolean> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.fsPath !== record.filePath) {
            return false;
        }

        const document = editor.document;

        try {
            // 尝试通过精确位置还原
            const range = new vscode.Range(
                record.startPosition.line,
                record.startPosition.character,
                record.endPosition.line,
                record.endPosition.character
            );

            // 检查当前位置的文本是否匹配
            const currentText = document.getText(range);
            if (currentText === record.newText) {
                // 精确匹配，直接还原
                await editor.edit(editBuilder => {
                    editBuilder.replace(range, record.originalText);
                });
                return true;
            }

            // 如果精确位置不匹配，尝试在附近行查找
            const searchStartLine = Math.max(0, record.startPosition.line - 2);
            const searchEndLine = Math.min(document.lineCount - 1, record.endPosition.line + 2);

            for (let i = searchStartLine; i <= searchEndLine; i++) {
                const line = document.lineAt(i);
                if (line.text.includes(record.newText.trim())) {
                    const newRange = new vscode.Range(i, 0, i, line.text.length);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(newRange, record.originalText);
                    });
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('还原失败:', error);
            return false;
        }
    }    /**
     * 批量还原多个记录
     */
    public async restoreMultipleRecords(records: HistoryRecord[]): Promise<RestoreResult> {
        let restoredCount = 0;
        let restoredRecords: HistoryRecord[] = [];
        let errorMessage = '';

        try {
            // 按照时间倒序排列，确保后面的更改不会被前面的覆盖
            const sortedRecords = [...records].reverse();

            for (const record of sortedRecords) {
                const success = await this.restoreSpecificChange(record);
                if (success) {
                    restoredCount++;
                    restoredRecords.push(record);
                }
            }

            return {
                success: restoredCount > 0,
                restoredCount,
                restoredRecords,
                errorMessage: restoredCount === 0 ? '没有成功还原任何记录' : undefined
            };
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : '未知错误';
            return {
                success: false,
                restoredCount,
                restoredRecords,
                errorMessage
            };
        }
    }
}
