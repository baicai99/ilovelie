import * as vscode from 'vscode';
import { HistoryRecord, SingleReplaceResult } from './types';
import { CommentDetector } from './commentDetector';
import { HistoryManager } from './historyManager';
import { createLiesDictionary, getRandomLie, findMatchingLie } from './liesDictionary';

/**
 * 字典替换器
 * 根据预设字典替换注释内容，如果没有匹配的关键词则使用随机替换
 */
export class DictionaryReplacer {
    private commentDetector: CommentDetector;
    private historyManager: HistoryManager;

    // 撒谎字典：关键词 -> 撒谎内容
    private liesDictionary: Map<string, string[]>;

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager) {
        this.commentDetector = commentDetector;
        this.historyManager = historyManager;
        // 初始化字典
        this.liesDictionary = createLiesDictionary();
    }

    /**
     * 字典替换注释功能
     * 检测注释中的关键词并进行替换，如果没有关键词则随机替换
     */
    public async dictionaryReplaceComments(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 检测当前文件中的所有注释
        const comments = this.commentDetector.detectComments(editor.document);

        if (comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        } let replacedCount = 0;
        const results: SingleReplaceResult[] = [];

        // 开始编辑操作
        const success = await editor.edit(editBuilder => {
            for (const comment of comments) {
                const lieText = this.generateLieForComment(comment.text);

                if (lieText) {                    // 创建替换范围
                    const range = new vscode.Range(
                        new vscode.Position(comment.range.start.line, comment.range.start.character),
                        new vscode.Position(comment.range.end.line, comment.range.end.character)
                    );

                    // 保持注释格式，只替换内容
                    const formattedLie = this.formatCommentWithLie(comment.text, lieText, comment.type);

                    editBuilder.replace(range, formattedLie);

                    // 记录历史
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        lineNumber: comment.range.start.line,
                        originalText: comment.text,
                        newText: formattedLie,
                        timestamp: new Date(),
                        startPosition: {
                            line: comment.range.start.line,
                            character: comment.range.start.character
                        },
                        endPosition: {
                            line: comment.range.end.line,
                            character: comment.range.end.character
                        }
                    };

                    this.historyManager.addRecord(historyRecord);
                    results.push({
                        success: true,
                        originalText: comment.text,
                        newText: formattedLie,
                        lineNumber: comment.range.start.line + 1
                    });

                    replacedCount++;
                }
            }
        });

        if (success && replacedCount > 0) {
            vscode.window.showInformationMessage(
                `字典替换完成！共替换了 ${replacedCount} 个注释。`
            );
        } else if (replacedCount === 0) {
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
        } else {
            vscode.window.showErrorMessage('替换操作失败！');
        }
    }    /**
     * 为注释生成撒谎内容
     * 优先查找字典关键词，没有匹配则使用随机内容
     */
    private generateLieForComment(commentText: string): string | null {
        // 移除注释符号，获取纯文本内容
        const cleanText = this.extractCommentContent(commentText);

        if (!cleanText.trim()) {
            return null;
        }

        // 检查是否包含字典中的关键词
        const matchingLie = findMatchingLie(cleanText, this.liesDictionary);
        if (matchingLie) {
            return matchingLie;
        }

        // 如果没有匹配的关键词，使用随机撒谎内容
        return getRandomLie();
    }/**
     * 提取注释的纯文本内容（移除注释符号）
     */
    private extractCommentContent(commentText: string): string {
        return commentText
            .replace(/^\/\*+/, '')  // 移除 /* 开头
            .replace(/\*+\/$/, '')  // 移除 */ 结尾
            .replace(/^\/\/+/, '')  // 移除 // 开头
            .replace(/^\s*\*+/gm, '') // 移除每行开头的 * (全局多行模式)
            .replace(/<!--/, '')    // 移除 HTML 注释开头
            .replace(/-->/, '')     // 移除 HTML 注释结尾
            .replace(/^#+/, '')     // 移除 # 开头（markdown等）
            .replace(/\n/g, ' ')    // 将换行符替换为空格
            .replace(/\s+/g, ' ')   // 将多个空格合并为一个
            .trim();
    }    /**
     * 格式化注释，保持原有格式只替换内容
     */
    private formatCommentWithLie(originalComment: string, lieText: string, commentType: string): string {
        switch (commentType) {
            case 'line':
                if (originalComment.trim().startsWith('//')) {
                    return `// ${lieText}`;
                }
                break;
            case 'block':
                return `/* ${lieText} */`;
            case 'documentation':
                return `/** ${lieText} */`;
            case 'html':
                return `<!-- ${lieText} -->`;
            default:
                // 尝试保持原格式
                const trimmed = originalComment.trim();
                if (trimmed.startsWith('//')) {
                    return `// ${lieText}`;
                } else if (trimmed.startsWith('/**')) {
                    return `/** ${lieText} */`;
                } else if (trimmed.startsWith('/*')) {
                    return `/* ${lieText} */`;
                } else if (trimmed.startsWith('<!--')) {
                    return `<!-- ${lieText} -->`;
                }
        }

        // 默认返回行注释格式
        return `// ${lieText}`;
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 添加自定义关键词和对应的撒谎内容
     */
    public addCustomDictionaryEntry(keyword: string, lies: string[]): void {
        this.liesDictionary.set(keyword, lies);
    }

    /**
     * 获取当前字典内容（用于配置管理）
     */
    public getDictionary(): Map<string, string[]> {
        return new Map(this.liesDictionary);
    }    /**
     * 重置字典为默认内容
     */
    public resetDictionary(): void {
        this.liesDictionary = createLiesDictionary();
    }    /**
     * 选择性字典替换注释功能
     * 让用户选择要替换哪些注释
     */
    public async selectiveDictionaryReplaceComments(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 检测当前文件中的所有注释
        const comments = this.commentDetector.detectComments(editor.document);

        console.log('检测到的注释数量:', comments.length);
        console.log('字典大小:', this.liesDictionary.size);

        if (comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }// 为每个注释生成预览信息
        const commentItems: vscode.QuickPickItem[] = [];
        const commentDataArray: { comment: any, lieText: string }[] = []; for (let i = 0; i < comments.length; i++) {
            const comment = comments[i];
            const lieText = this.generateLieForComment(comment.text);

            console.log(`注释${i + 1}: "${comment.text}" -> "${lieText}"`);

            if (lieText) {
                const originalText = this.extractCommentContent(comment.text);
                const lineNumber = comment.range.start.line + 1;

                commentItems.push({
                    label: `第${lineNumber}行: ${originalText}`,
                    description: `→ ${lieText}`,
                    detail: `${comment.type} 注释`,
                    picked: false
                });

                commentDataArray.push({ comment, lieText });
            }
        }

        console.log('可替换的注释数量:', commentItems.length);

        if (commentItems.length === 0) {
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
            return;
        }

        // 显示多选列表
        const selectedItems = await vscode.window.showQuickPick(commentItems, {
            placeHolder: '选择要替换的注释（可多选）',
            canPickMany: true,
            matchOnDescription: true,
            ignoreFocusOut: true
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }        // 执行替换
        let replacedCount = 0;
        const results: SingleReplaceResult[] = [];

        const success = await editor.edit(editBuilder => {
            selectedItems.forEach((item, index) => {
                const itemIndex = commentItems.indexOf(item);
                const commentData = commentDataArray[itemIndex];
                if (commentData) {
                    const { comment, lieText } = commentData;

                    // 创建替换范围
                    const range = new vscode.Range(
                        new vscode.Position(comment.range.start.line, comment.range.start.character),
                        new vscode.Position(comment.range.end.line, comment.range.end.character)
                    );

                    // 保持注释格式，只替换内容
                    const formattedLie = this.formatCommentWithLie(comment.text, lieText, comment.type);

                    editBuilder.replace(range, formattedLie);

                    // 记录历史
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        lineNumber: comment.range.start.line,
                        originalText: comment.text,
                        newText: formattedLie,
                        timestamp: new Date(),
                        startPosition: {
                            line: comment.range.start.line,
                            character: comment.range.start.character
                        },
                        endPosition: {
                            line: comment.range.end.line,
                            character: comment.range.end.character
                        }
                    };

                    this.historyManager.addRecord(historyRecord);

                    results.push({
                        success: true,
                        originalText: comment.text,
                        newText: formattedLie,
                        lineNumber: comment.range.start.line + 1
                    });

                    replacedCount++;
                }
            });
        });

        if (success && replacedCount > 0) {
            vscode.window.showInformationMessage(
                `选择性字典替换完成！共替换了 ${replacedCount} 个注释。`
            );
        } else {
            vscode.window.showErrorMessage('替换操作失败！');
        }
    }
}