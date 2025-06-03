import * as vscode from 'vscode';
import { CommentDetector } from './commentDetector';
import { CommentScanner, ScannedComment, ScanResult } from './commentScanner';
import { HistoryManager } from './historyManager';
import { HistoryRecord } from './types';

/**
 * 注释隐藏管理器
 * 负责隐藏和显示注释的功能
 */
export class CommentHider {
    private commentDetector: CommentDetector;
    private commentScanner: CommentScanner;
    private historyManager: HistoryManager;
    private hiddenCommentsMap: Map<string, Map<number, HistoryRecord>>;

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager) {
        this.commentDetector = commentDetector;
        this.commentScanner = new CommentScanner();
        this.historyManager = historyManager;
        this.hiddenCommentsMap = new Map();
    }

    /**
     * 切换注释的显示/隐藏状态
     */
    public async toggleCommentVisibility(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        const filePath = editor.document.uri.fsPath;
        const fileHiddenComments = this.hiddenCommentsMap.get(filePath);

        if (fileHiddenComments && fileHiddenComments.size > 0) {
            // 如果有隐藏的注释，则显示它们
            await this.showComments(editor, filePath);
        } else {
            // 如果没有隐藏的注释，则隐藏它们
            await this.hideComments(editor, filePath);
        }
    }    /**
     * 隐藏当前文件的所有注释
     */
    private async hideComments(editor: vscode.TextEditor, filePath: string): Promise<void> {
        // 使用CommentScanner扫描当前文件中的所有注释
        const scanResult = await this.commentScanner.scanDocument(editor.document);

        if (!scanResult.success || scanResult.comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }

        const hiddenComments = new Map<number, HistoryRecord>();
        let hiddenCount = 0;

        // 从后往前处理，避免行号变化的问题
        const sortedComments = scanResult.comments.sort((a, b) => b.range.start.line - a.range.start.line);

        const success = await editor.edit(editBuilder => {
            for (const comment of sortedComments) {
                // 创建空行替换注释
                const range = new vscode.Range(
                    new vscode.Position(comment.range.start.line, comment.range.start.character),
                    new vscode.Position(comment.range.end.line, comment.range.end.character)
                );

                // 隐藏注释（用空字符串替换）
                editBuilder.replace(range, '');                // 记录隐藏的注释
                const hiddenRecord: HistoryRecord = {
                    id: this.generateId(),
                    filePath: filePath,
                    originalText: comment.content,
                    newText: '',
                    timestamp: Date.now(),
                    type: 'hide-comment',
                    startPosition: {
                        line: comment.range.start.line,
                        character: comment.range.start.character
                    }, endPosition: {
                        line: comment.range.end.line,
                        character: comment.range.end.character
                    }
                }; hiddenComments.set(comment.range.start.line, hiddenRecord);
                hiddenCount++;
            }
        });

        if (success && hiddenCount > 0) {
            this.hiddenCommentsMap.set(filePath, hiddenComments);
            vscode.window.showInformationMessage(`已隐藏 ${hiddenCount} 个注释！现在代码看起来更"干净"了 😈`);
        } else {
            vscode.window.showErrorMessage('隐藏注释操作失败！');
        }
    }

    /**
     * 显示当前文件的所有隐藏注释
     */
    private async showComments(editor: vscode.TextEditor, filePath: string): Promise<void> {
        const fileHiddenComments = this.hiddenCommentsMap.get(filePath);
        if (!fileHiddenComments || fileHiddenComments.size === 0) {
            vscode.window.showInformationMessage('当前文件没有隐藏的注释！');
            return;
        }

        let restoredCount = 0;

        // 按行号排序，从前往后恢复
        const sortedRecords = Array.from(fileHiddenComments.entries())
            .sort(([lineA], [lineB]) => lineA - lineB); const success = await editor.edit(editBuilder => {
                for (const [lineNumber, record] of sortedRecords) {
                    try {
                        // 查找当前行的位置（可能由于之前的编辑而改变）
                        const position = this.findInsertPosition(editor.document, record.startPosition.line);

                        if (position !== null) {
                            // 在找到的位置插入原始注释
                            editBuilder.insert(position, record.originalText);
                            restoredCount++;
                        }
                    } catch (error) {
                        console.error('恢复注释时出错:', error);
                    }
                }
            });

        if (success && restoredCount > 0) {
            // 清除隐藏记录
            this.hiddenCommentsMap.delete(filePath);
            vscode.window.showInformationMessage(`已显示 ${restoredCount} 个隐藏的注释！`);
        } else {
            vscode.window.showErrorMessage('显示注释操作失败！');
        }
    }

    /**
     * 查找插入位置
     */
    private findInsertPosition(document: vscode.TextDocument, originalLineNumber: number): vscode.Position | null {
        // 如果原始行号仍在文档范围内，在该行开头插入
        if (originalLineNumber < document.lineCount) {
            const line = document.lineAt(originalLineNumber);
            return new vscode.Position(originalLineNumber, line.firstNonWhitespaceCharacterIndex);
        }

        // 如果原始行号超出范围，在文档末尾插入
        if (document.lineCount > 0) {
            const lastLine = document.lineAt(document.lineCount - 1);
            return new vscode.Position(document.lineCount - 1, lastLine.text.length);
        }

        // 如果是空文档，在开头插入
        return new vscode.Position(0, 0);
    }

    /**
     * 获取当前文件的隐藏状态
     */
    public getHideStatus(filePath: string): { isHidden: boolean; hiddenCount: number } {
        const fileHiddenComments = this.hiddenCommentsMap.get(filePath);
        return {
            isHidden: fileHiddenComments ? fileHiddenComments.size > 0 : false,
            hiddenCount: fileHiddenComments ? fileHiddenComments.size : 0
        };
    }

    /**
     * 清除指定文件的隐藏记录
     */
    public clearHiddenComments(filePath: string): void {
        this.hiddenCommentsMap.delete(filePath);
    }

    /**
     * 文档关闭时清理
     */
    public handleDocumentClose(document: vscode.TextDocument): void {
        const filePath = document.uri.fsPath;
        this.clearHiddenComments(filePath);
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
