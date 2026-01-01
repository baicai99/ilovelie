import * as vscode from 'vscode';
import { HistoryRecord, ReplaceResult } from '../types';
import { CommentDetector } from '../comment/commentDetector';
import { CommentScanner } from '../comment/commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { ToggleManager } from '../manager/toggleManager';
import { CommentFormatter } from '../utils/commentFormatter';

/**
 * 注释替换器
 * 负责执行注释替换操作
 * 现在使用 CommentScanner 作为核心扫描器
 */
export class CommentReplacer {
    private commentDetector: CommentDetector;
    private commentScanner: CommentScanner;
    private historyManager: HistoryManager;
    private toggleManager?: ToggleManager;

    constructor(
        commentDetector: CommentDetector,
        historyManager: HistoryManager,
        toggleManager: ToggleManager | undefined,
        commentScanner: CommentScanner
    ) {
        this.commentDetector = commentDetector;
        this.commentScanner = commentScanner;
        this.historyManager = historyManager;
        this.toggleManager = toggleManager;
    }

    /**
     * 打开文本输入面板，支持多行输入
     */
    private async showReplacementInput(initial: string): Promise<string | undefined> {
        const panel = vscode.window.createWebviewPanel(
            'ilovelieReplaceInput',
            '编辑替换内容',
            vscode.ViewColumn.Active,
            { enableScripts: true }
        );

        panel.webview.html = this.getInputHtml(initial);

        return new Promise(resolve => {
            const listener = panel.webview.onDidReceiveMessage(msg => {
                if (msg.command === 'confirm') {
                    resolve(msg.text as string);
                    panel.dispose();
                } else if (msg.command === 'cancel') {
                    resolve(undefined);
                    panel.dispose();
                }
            });

            panel.onDidDispose(() => {
                listener.dispose();
                resolve(undefined);
            });
        });
    }

    /** 获取输入面板HTML */
    private getInputHtml(text: string): string {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: var(--vscode-font-family); padding: 10px; }
        textarea { width: 100%; height: 70vh; }
        button { margin-right: 8px; }
    </style>
</head>
<body>
    <textarea id="input">${escaped}</textarea>
    <br />
    <button id="confirm">Confirm</button>
    <button id="cancel">Cancel</button>

    <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('confirm').addEventListener('click', () => {
            vscode.postMessage({ command: 'confirm', text: document.getElementById('input').value });
        });
        document.getElementById('cancel').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
    </script>
</body>
</html>`;
    }

    /**
     * 手动替换注释功能 - 使用扫描器优先获取数据
     */
    public async replaceComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 启动新的撒谎会话
        const filePath = editor.document.uri.fsPath;
        const sessionId = this.historyManager.startLieSession(filePath, editor.document.getText());
        console.log(`[CommentReplacer] 开始新的手动替换会话: ${sessionId}`);

        try {
            // 首先使用 CommentScanner 扫描文档获取所有注释
            const scanResult = await this.commentScanner.scanDocument(editor.document);

            if (!scanResult.success) {
                await this.historyManager.endLieSession(filePath);
                vscode.window.showErrorMessage(`扫描注释失败: ${scanResult.errorMessage}`);
                return;
            }

            if (scanResult.totalComments === 0) {
                await this.historyManager.endLieSession(filePath);
                vscode.window.showInformationMessage('当前文档中没有找到注释！');
                return;
            }

            // 让用户选择要替换的注释
            const quickPickItems = scanResult.comments.map((comment, index) => ({
                label: `第 ${comment.lineNumber + 1} 行`,
                description: comment.cleanText.substring(0, 50) + (comment.cleanText.length > 50 ? '...' : ''),
                detail: `格式: ${comment.format} | 原文: ${comment.cleanText}`,
                comment: comment
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `选择要替换的注释 (共找到 ${scanResult.totalComments} 条注释)`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (!selectedItem) {
                await this.historyManager.endLieSession(filePath);
                return;
            }

            const newComment = await this.showReplacementInput(selectedItem.comment.cleanText);

            if (!newComment) {
                await this.historyManager.endLieSession(filePath);
                return;
            }

            // 使用 CommentFormatter 构建新的注释文本
            const originalComment = selectedItem.comment;
            const newCommentText = CommentFormatter.formatComment(originalComment, newComment);

            // 执行替换
            const success = await editor.edit(editBuilder => {
                editBuilder.replace(originalComment.range, newCommentText);
            });

            if (success) {
                // 记录历史
                const record = this.historyManager.createHistoryRecord(
                    editor.document.uri.fsPath,
                    originalComment.content,
                    newCommentText,
                    originalComment.range,
                    'manual-replace'
                );
                await this.historyManager.addRecord(record);

                // 通知状态管理器有新的撒谎记录
                if (this.toggleManager) {
                    this.toggleManager.notifyLiesAdded(editor.document.uri.fsPath);
                }

                vscode.window.showInformationMessage('注释替换成功！你已经成功撒谎了 😈');
                console.log(`[CommentReplacer] 手动替换会话保持活跃`);
            } else {
                // 替换失败，结束会话
                this.historyManager.endLieSession(filePath);
                console.log(`[CommentReplacer] 手动替换会话已结束，因为替换失败`);
                vscode.window.showErrorMessage('注释替换失败！');
            }

        } catch (error: any) {
            // 出现异常时结束会话
            this.historyManager.endLieSession(filePath);
            console.log(`[CommentReplacer] 手动替换会话已结束，因为出现异常: ${error.message}`);
            vscode.window.showErrorMessage(`手动替换失败：${error.message}`);
        }
    }

    /**
     * 替换选中的注释
     */
    public async replaceSelectedComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 启动新的撒谎会话
        const filePath = editor.document.uri.fsPath;
        const sessionId = this.historyManager.startLieSession(filePath, editor.document.getText());
        console.log(`[CommentReplacer] 开始新的选中替换会话: ${sessionId}`);

        try {
            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                await this.historyManager.endLieSession(filePath);
                vscode.window.showErrorMessage('请先选中一段文本！');
                return;
            }

            const languageId = editor.document.languageId;

            const scanResult = await this.commentScanner.scanDocument(editor.document);
            if (!scanResult.success) {
                await this.historyManager.endLieSession(filePath);
                vscode.window.showErrorMessage(scanResult.errorMessage || '扫描注释失败，请重试。');
                return;
            }

            const selectedComment = scanResult.comments.find(comment =>
                comment.range.contains(selection) || selection.contains(comment.range)
            );

            // 检查选中的文本是否为注释
            if (!selectedComment) {
                await this.historyManager.endLieSession(filePath);
                vscode.window.showErrorMessage('选中的文本不是注释！');
                return;
            }

            const newComment = await vscode.window.showInputBox({
                prompt: '请输入新的撒谎注释内容',
                placeHolder: '例如：这个函数用来播放音乐',
                value: this.commentDetector.extractCommentContent(selectedComment.content, languageId)
            });

            if (!newComment) {
                await this.historyManager.endLieSession(filePath);
                return;
            }

            const newCommentText = this.commentDetector.replaceCommentContent(selectedComment.content, newComment, languageId);

            const success = await editor.edit(editBuilder => {
                editBuilder.replace(selectedComment.range, newCommentText);
            });

            if (success) {
                // 记录历史
                const record = this.historyManager.createHistoryRecord(
                    editor.document.uri.fsPath,
                    selectedComment.content,
                    newCommentText,
                    selectedComment.range
                );
                await this.historyManager.addRecord(record);

                // 通知状态管理器有新的撒谎记录
                if (this.toggleManager) {
                    this.toggleManager.notifyLiesAdded(editor.document.uri.fsPath);
                }

                vscode.window.showInformationMessage('注释替换成功！你已经成功撒谎了 😈');
                console.log(`[CommentReplacer] 选中替换会话保持活跃`);
            } else {
                // 替换失败，结束会话
                this.historyManager.endLieSession(filePath);
                console.log(`[CommentReplacer] 选中替换会话已结束，因为替换失败`);
                vscode.window.showErrorMessage('注释替换失败！');
            }

        } catch (error: any) {
            // 出现异常时结束会话
            this.historyManager.endLieSession(filePath);
            console.log(`[CommentReplacer] 选中替换会话已结束，因为出现异常: ${error.message}`);
            vscode.window.showErrorMessage(`选中替换失败：${error.message}`);
        }
    }
}
