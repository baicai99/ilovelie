import * as vscode from 'vscode';
import { HistoryRecord, ReplaceResult } from './types';
import { CommentDetector } from './commentDetector';
import { CommentScanner } from './commentScanner';
import { HistoryManager } from './historyManager';

/**
 * 注释替换器
 * 负责执行注释替换操作
 */
export class CommentReplacer {
    private commentDetector: CommentDetector;
    private commentScanner: CommentScanner;
    private historyManager: HistoryManager;

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager) {
        this.commentDetector = commentDetector;
        this.commentScanner = new CommentScanner();
        this.historyManager = historyManager;
    }

    /**
     * 手动替换注释功能
     */
    public async replaceComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 获取用户输入的原始注释和新注释
        const originalComment = await vscode.window.showInputBox({
            prompt: '请输入要替换的原始注释内容',
            placeHolder: '例如：这是一个计算函数'
        });

        if (!originalComment) {
            return;
        }

        const newComment = await vscode.window.showInputBox({
            prompt: '请输入新的撒谎注释内容',
            placeHolder: '例如：这个函数用来播放音乐'
        });

        if (!newComment) {
            return;
        }

        const result = await this.executeReplacement(editor, originalComment, newComment);
        this.showReplacementResult(result);
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

        await editor.edit(editBuilder => {
            editBuilder.replace(selection, newCommentText);
        });

        // 记录历史
        const record = this.historyManager.createHistoryRecord(
            editor.document.uri.fsPath,
            selectedText,
            newCommentText,
            selection
        );
        this.historyManager.addRecord(record);

        vscode.window.showInformationMessage('注释替换成功！你已经成功撒谎了 😈');
    }

    /**
     * 执行替换操作
     */
    private async executeReplacement(
        editor: vscode.TextEditor,
        originalComment: string,
        newComment: string
    ): Promise<ReplaceResult> {
        const document = editor.document;
        const languageId = document.languageId;
        let replacements = 0;

        try {
            // 遍历文档的每一行
            await editor.edit(editBuilder => {
                for (let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    const lineText = line.text;

                    // 检查这一行是否包含要替换的注释
                    if (this.commentDetector.isComment(lineText, languageId) && lineText.includes(originalComment)) {
                        const newLineText = lineText.replace(originalComment, newComment);
                        editBuilder.replace(line.range, newLineText);
                        replacements++;

                        // 记录历史
                        const record = this.historyManager.createHistoryRecord(
                            document.uri.fsPath,
                            lineText,
                            newLineText,
                            line.range
                        );
                        this.historyManager.addRecord(record);
                    }
                }
            });

            return {
                success: true,
                replacedCount: replacements
            };
        } catch (error) {
            return {
                success: false,
                replacedCount: 0,
                errorMessage: error instanceof Error ? error.message : '未知错误'
            };
        }
    }

    /**
     * 显示替换结果
     */
    private showReplacementResult(result: ReplaceResult): void {
        if (result.success) {
            if (result.replacedCount > 0) {
                vscode.window.showInformationMessage(`成功替换了 ${result.replacedCount} 个注释！你已经成功撒谎了 😈`);
            } else {
                vscode.window.showWarningMessage('没有找到匹配的注释内容');
            }
        } else {
            vscode.window.showErrorMessage(`替换失败：${result.errorMessage || '未知错误'}`);
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
            await editor.edit(editBuilder => {
                editBuilder.replace(originalComment.range, newCommentText);
            });            // 记录历史
            const record = this.historyManager.createHistoryRecord(
                editor.document.uri.fsPath,
                originalComment.content,
                newCommentText,
                originalComment.range,
                'manual-replace'
            );

            await this.historyManager.addRecord(record);

            vscode.window.showInformationMessage(
                `注释替换成功！第 ${originalComment.lineNumber + 1} 行`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`智能替换注释时发生错误: ${error}`);
        }
    }
}
