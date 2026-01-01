import * as vscode from 'vscode';
import { CommentDetector } from './commentDetector';
import { CommentScanner, ScannedComment, ScanResult } from './commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { HistoryRecord } from '../types';

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
        // 记录快照以便后续恢复
        this.historyManager.startLieSession(filePath, editor.document.getText());

        // 使用CommentScanner扫描当前文件中的所有注释
        const scanResult = await this.commentScanner.scanDocument(editor.document);

        if (!scanResult.success || scanResult.comments.length === 0) {
            await this.historyManager.endLieSession(filePath);
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
            await this.historyManager.endLieSession(filePath);
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

        // 查找会话快照进行整体恢复
        const sessionId = this.historyManager.getCurrentSessionId(filePath);
        const records = this.historyManager.getRecordsForFile(filePath);
        const snapshot = records.find(r => r.sessionId === sessionId && r.fileSnapshot)?.fileSnapshot;

        if (!snapshot) {
            vscode.window.showErrorMessage('无法找到原始快照，无法恢复注释');
            return;
        }

        const success = await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                new vscode.Position(0, 0),
                editor.document.lineAt(editor.document.lineCount - 1).range.end
            );
            editBuilder.replace(fullRange, snapshot);
        });

        if (success) {
            this.hiddenCommentsMap.delete(filePath);
            this.historyManager.endLieSession(filePath);
            vscode.window.showInformationMessage('已显示隐藏的注释！');
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
