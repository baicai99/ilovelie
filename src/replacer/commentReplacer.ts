import * as vscode from 'vscode';
import { HistoryRecord, ReplaceResult } from '../types';
import { CommentDetector } from '../comment/commentDetector';
import { CommentScanner } from '../comment/commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { ToggleManager } from '../manager/toggleManager';

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

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager, toggleManager?: ToggleManager) {
        this.commentDetector = commentDetector;
        this.commentScanner = new CommentScanner();
        this.historyManager = historyManager;
        this.toggleManager = toggleManager;
    }    /**
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
                vscode.window.showErrorMessage(`扫描注释失败: ${scanResult.errorMessage}`);
                return;
            }

            if (scanResult.totalComments === 0) {
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
                return;
            }

            const newComment = await vscode.window.showInputBox({
                prompt: '请输入新的撒谎注释内容',
                placeHolder: '例如：这个函数用来播放音乐',
                value: selectedItem.comment.cleanText
            });

            if (!newComment) {
                return;
            }

            // 构建新的注释文本，保持原有格式
            let newCommentText = '';
            const originalComment = selectedItem.comment;

            switch (originalComment.format) {
                case 'single-line-slash':
                    newCommentText = `${originalComment.indentation}// ${newComment}`;
                    break;
                case 'single-line-hash':
                    newCommentText = `${originalComment.indentation}# ${newComment}`;
                    break;
                case 'multi-line-star':
                    if (originalComment.multiLinePosition === 'single') {
                        newCommentText = `${originalComment.indentation}/* ${newComment} */`;
                    } else {
                        // 对于多行注释的各个部分，保持原有结构
                        newCommentText = originalComment.content.replace(originalComment.cleanText, newComment);
                    }
                    break;
                case 'html-comment':
                    newCommentText = `${originalComment.indentation}<!-- ${newComment} -->`;
                    break;
                default:
                    newCommentText = `${originalComment.indentation}// ${newComment}`;
            }

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
                vscode.window.showErrorMessage('请先选中一段文本！');
                return;
            }

            const languageId = editor.document.languageId;

            // 检查选中的文本是否为注释
            if (!this.commentDetector.isComment(selectedText, languageId)) {
                vscode.window.showErrorMessage('选中的文本不是注释！');
                return;
            }

            const newComment = await vscode.window.showInputBox({
                prompt: '请输入新的撒谎注释内容',
                placeHolder: '例如：这个函数用来播放音乐',
                value: this.commentDetector.extractCommentContent(selectedText, languageId)
            });

            if (!newComment) {
                return;
            }

            const newCommentText = this.commentDetector.replaceCommentContent(selectedText, newComment, languageId);

            const success = await editor.edit(editBuilder => {
                editBuilder.replace(selection, newCommentText);
            });

            if (success) {
                // 记录历史
                const record = this.historyManager.createHistoryRecord(
                    editor.document.uri.fsPath,
                    selectedText,
                    newCommentText,
                    selection
                );
                this.historyManager.addRecord(record);

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

    /**
     * 使用扫描器进行智能注释替换
     */
    public async smartReplaceComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 启动新的撒谎会话
        const filePath = editor.document.uri.fsPath;
        const sessionId = this.historyManager.startLieSession(filePath, editor.document.getText());
        console.log(`[CommentReplacer] 开始新的智能替换会话: ${sessionId}`);

        try {
            // 使用CommentScanner扫描所有注释
            const scanResult = await this.commentScanner.scanActiveDocument();

            if (!scanResult.success) {
                vscode.window.showErrorMessage(`扫描注释失败: ${scanResult.errorMessage}`);
                return;
            }

            if (scanResult.totalComments === 0) {
                vscode.window.showInformationMessage('当前文档中没有找到注释');
                return;
            }

            // 创建快速选择项
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
                return;
            }

            const newComment = await vscode.window.showInputBox({
                prompt: '请输入新的撒谎注释内容',
                placeHolder: '例如：这个函数用来播放音乐',
                value: selectedItem.comment.cleanText
            });

            if (!newComment) {
                return;
            }

            // 构建新的注释文本，保持原有格式
            let newCommentText = '';
            const originalComment = selectedItem.comment;

            switch (originalComment.format) {
                case 'single-line-slash':
                    newCommentText = `${originalComment.indentation}// ${newComment}`;
                    break;
                case 'single-line-hash':
                    newCommentText = `${originalComment.indentation}# ${newComment}`;
                    break;
                case 'multi-line-star':
                    if (originalComment.multiLinePosition === 'single') {
                        newCommentText = `${originalComment.indentation}/* ${newComment} */`;
                    } else {
                        // 对于多行注释的各个部分，保持原有结构
                        newCommentText = originalComment.content.replace(originalComment.cleanText, newComment);
                    }
                    break;
                case 'html-comment':
                    newCommentText = `${originalComment.indentation}<!-- ${newComment} -->`;
                    break;
                default:
                    newCommentText = `${originalComment.indentation}// ${newComment}`;
            }

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
                console.log(`[CommentReplacer] 智能替换会话保持活跃`);
            } else {
                // 替换失败，结束会话
                this.historyManager.endLieSession(filePath);
                console.log(`[CommentReplacer] 智能替换会话已结束，因为替换失败`);
                vscode.window.showErrorMessage('注释替换失败！');
            }

        } catch (error: any) {
            // 出现异常时结束会话
            this.historyManager.endLieSession(filePath);
            console.log(`[CommentReplacer] 智能替换会话已结束，因为出现异常: ${error.message}`);
            vscode.window.showErrorMessage(`智能替换失败: ${error.message}`);
        }
    }
}
