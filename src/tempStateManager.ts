import * as vscode from 'vscode';
import { TempRestoreState, HistoryRecord } from './types';
import { HistoryManager } from './historyManager';
import { RestoreManager } from './restoreManager';

/**
 * 临时状态管理器
 * 负责管理临时还原状态
 */
export class TempStateManager {
    private tempRestoreStates: Map<string, TempRestoreState> = new Map();
    private historyManager: HistoryManager;
    private restoreManager: RestoreManager;

    constructor(historyManager: HistoryManager, restoreManager: RestoreManager) {
        this.historyManager = historyManager;
        this.restoreManager = restoreManager;
    }

    /**
     * 一键暂时还原当前文件的所有撒谎注释
     */
    public async temporarilyRestoreAllLies(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        const filePath = editor.document.uri.fsPath;

        // 检查是否已经临时还原
        if (this.isTemporarilyRestored(filePath)) {
            vscode.window.showInformationMessage('当前文件已经处于临时还原状态！');
            return;
        }

        // 获取当前文件的所有撒谎历史记录
        const fileHistory = this.historyManager.getFileRecords(filePath);

        if (fileHistory.length === 0) {
            vscode.window.showInformationMessage('当前文件没有撒谎历史记录');
            return;
        }        // 执行批量还原
        const result = await this.restoreManager.restoreMultipleRecords(fileHistory);

        if (result.success && result.restoredCount > 0) {
            // 保存临时还原状态 - 使用实际成功还原的记录
            this.tempRestoreStates.set(filePath, {
                filePath,
                restoredRecords: result.restoredRecords || [],
                isTemporarilyRestored: true
            });

            vscode.window.showInformationMessage(
                `✨ 已临时还原 ${result.restoredCount} 个撒谎注释！关闭文件后将自动恢复撒谎状态 😈`
            );
        } else {
            vscode.window.showErrorMessage(result.errorMessage || '还原失败');
        }
    }

    /**
     * 恢复文件的撒谎状态
     */
    public async restoreLieState(filePath: string): Promise<void> {
        const tempState = this.tempRestoreStates.get(filePath);
        if (!tempState || !tempState.isTemporarilyRestored) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
            const editor = await vscode.window.showTextDocument(document);

            let restoreCount = 0;

            // 按照原来的顺序恢复撒谎记录
            for (const record of tempState.restoredRecords) {
                try {
                    // 查找当前位置的文本是否为原始文本
                    const range = new vscode.Range(
                        record.startPosition.line,
                        record.startPosition.character,
                        record.endPosition.line,
                        record.endPosition.character
                    );

                    const currentText = editor.document.getText(range);
                    if (currentText === record.originalText) {
                        // 恢复为撒谎文本
                        await editor.edit(editBuilder => {
                            editBuilder.replace(range, record.newText);
                        });
                        restoreCount++;
                    }
                } catch (error) {
                    console.error('恢复撒谎状态失败:', error);
                }
            }

            // 清除临时还原状态
            this.clearTempState(filePath);

            if (restoreCount > 0) {
                vscode.window.showInformationMessage(
                    `😈 已恢复 ${restoreCount} 个撒谎注释！你的谎言又回来了~`
                );
            }

            // 自动关闭文件
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        } catch (error) {
            console.error('恢复撒谎状态时出错:', error);
            // 即使出错也要清除状态
            this.clearTempState(filePath);
        }
    }

    /**
     * 手动恢复撒谎状态
     */
    public async manuallyRestoreLies(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const tempState = this.tempRestoreStates.get(filePath);

        if (!tempState || !tempState.isTemporarilyRestored) {
            vscode.window.showInformationMessage('当前文件没有处于临时还原状态');
            return;
        }

        let restoreCount = 0;

        // 按照原来的顺序恢复撒谎记录
        for (const record of tempState.restoredRecords) {
            try {
                // 查找当前位置的文本是否为原始文本
                const range = new vscode.Range(
                    record.startPosition.line,
                    record.startPosition.character,
                    record.endPosition.line,
                    record.endPosition.character
                );

                const currentText = editor.document.getText(range);
                if (currentText === record.originalText) {
                    // 恢复为撒谎文本
                    await editor.edit(editBuilder => {
                        editBuilder.replace(range, record.newText);
                    });
                    restoreCount++;
                }
            } catch (error) {
                console.error('恢复撒谎状态失败:', error);
            }
        }

        // 清除临时还原状态
        this.clearTempState(filePath);

        if (restoreCount > 0) {
            vscode.window.showInformationMessage(
                `😈 已手动恢复 ${restoreCount} 个撒谎注释！你的谎言又回来了~`
            );
        } else {
            vscode.window.showWarningMessage('没有成功恢复任何撒谎记录');
        }
    }

    /**
     * 检查文件是否处于临时还原状态
     */
    public isTemporarilyRestored(filePath: string): boolean {
        const tempState = this.tempRestoreStates.get(filePath);
        return tempState?.isTemporarilyRestored || false;
    }

    /**
     * 获取临时状态
     */
    public getTempState(filePath: string): TempRestoreState | undefined {
        return this.tempRestoreStates.get(filePath);
    }

    /**
     * 清除临时状态
     */
    public clearTempState(filePath: string): void {
        this.tempRestoreStates.delete(filePath);
    }

    /**
     * 清除所有临时状态
     */
    public clearAllTempStates(): void {
        this.tempRestoreStates.clear();
    }

    /**
     * 处理文档关闭事件
     */
    public handleDocumentClose(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath;
        const tempState = this.tempRestoreStates.get(filePath);

        if (tempState && tempState.isTemporarilyRestored) {
            // 延迟恢复撒谎状态，给用户一点时间看到提示
            setTimeout(() => {
                this.restoreLieState(filePath);
            }, 1000);
        }
    }

    /**
     * 智能恢复单个撒谎记录
     */
    private async restoreSingleLieRecord(editor: vscode.TextEditor, record: HistoryRecord): Promise<boolean> {
        const document = editor.document;

        try {
            // 尝试通过精确位置恢复
            const range = new vscode.Range(
                record.startPosition.line,
                record.startPosition.character,
                record.endPosition.line,
                record.endPosition.character
            );

            // 检查当前位置的文本是否匹配原始文本
            const currentText = document.getText(range);
            if (currentText === record.originalText) {
                // 精确匹配，直接恢复为撒谎文本
                await editor.edit(editBuilder => {
                    editBuilder.replace(range, record.newText);
                });
                return true;
            }

            // 如果精确位置不匹配，尝试在附近行查找原始文本
            const searchStartLine = Math.max(0, record.startPosition.line - 2);
            const searchEndLine = Math.min(document.lineCount - 1, record.endPosition.line + 2);

            for (let i = searchStartLine; i <= searchEndLine; i++) {
                const line = document.lineAt(i);
                if (line.text.includes(record.originalText.trim())) {
                    const newRange = new vscode.Range(i, 0, i, line.text.length);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(newRange, record.newText);
                    });
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('恢复撒谎记录失败:', error);
            return false;
        }
    }
}
