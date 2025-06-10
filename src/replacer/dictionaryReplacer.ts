import * as vscode from 'vscode';
import { HistoryRecord, SingleReplaceResult } from '../types';
import { CommentDetector } from '../comment/commentDetector';
import { CommentScanner } from '../comment/commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { ToggleManager } from '../manager/toggleManager';
import { createLiesDictionary, getRandomLie, findMatchingLie } from '../data/liesDictionary';

/**
 * 字典替换器
 * 根据预设字典替换注释内容，如果没有匹配的关键词则使用随机替换
 */
export class DictionaryReplacer {
    private commentDetector: CommentDetector;
    private commentScanner: CommentScanner;
    private historyManager: HistoryManager;
    private toggleManager?: ToggleManager;

    // 撒谎字典：关键词 -> 撒谎内容
    private liesDictionary: Map<string, string[]>;

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager, toggleManager?: ToggleManager) {
        console.log('[DictionaryReplacer] 初始化字典替换器');
        this.commentDetector = commentDetector;
        this.commentScanner = new CommentScanner();
        this.historyManager = historyManager;
        this.toggleManager = toggleManager;
        // 初始化字典
        this.liesDictionary = createLiesDictionary();
        console.log('[DictionaryReplacer] 字典大小:', this.liesDictionary.size);
    }    /**
     * 字典替换注释功能（重构版）
     * 检测注释中的关键词并进行替换，如果没有关键词则使用随机替换
     * 现在使用统一的核心替换逻辑，避免代码重复
     */
    public async dictionaryReplaceComments(): Promise<void> {
        console.log('[DictionaryReplacer] 开始执行批量字典替换');
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 启动新的撒谎会话
        const filePath = editor.document.uri.fsPath;
        const sessionId = this.historyManager.startLieSession(filePath, editor.document.getText());
        console.log(`[DictionaryReplacer] 开始新的撒谎会话: ${sessionId}`);

        // 使用CommentScanner检测当前文件中的所有注释
        console.log('[DictionaryReplacer] 扫描文档中的注释');
        const scanResult = await this.commentScanner.scanActiveDocument();

        if (!scanResult.success || scanResult.comments.length === 0) {
            console.log('[DictionaryReplacer] 未找到注释，扫描结果:', scanResult);
            // 结束会话，因为没有注释可以处理
            this.historyManager.endLieSession(filePath);
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }

        console.log(`[DictionaryReplacer] 找到 ${scanResult.comments.length} 个注释`);

        // 分析可以进行字典替换的注释
        const dictionaryReplaceableComments = scanResult.comments.filter(comment => {
            const lie = findMatchingLie(comment.cleanText, this.liesDictionary);
            return lie !== null;
        });

        console.log(`[DictionaryReplacer] 可进行字典替换的注释: ${dictionaryReplaceableComments.length} 个`);

        let totalReplacedCount = 0;
        let dictionaryReplacedCount = 0;
        let randomReplacedCount = 0;

        // 执行替换操作
        const success = await editor.edit(editBuilder => {
            for (const comment of scanResult.comments) {
                const lieText = this.generateLieForComment(comment.cleanText);

                if (lieText) {
                    const isDictionaryMatch = findMatchingLie(comment.cleanText, this.liesDictionary) !== null;

                    console.log(`[DictionaryReplacer] 替换注释: "${comment.cleanText}" -> "${lieText}" (${isDictionaryMatch ? '字典匹配' : '随机生成'})`);

                    // 创建替换范围
                    const range = new vscode.Range(
                        new vscode.Position(comment.range.start.line, comment.range.start.character),
                        new vscode.Position(comment.range.end.line, comment.range.end.character)
                    );

                    // 保持注释格式，只替换内容
                    const formattedLie = this.formatCommentWithLie(comment.content, lieText, this.getCommentTypeFromFormat(comment.format));

                    editBuilder.replace(range, formattedLie);

                    // 记录历史
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        originalText: comment.content,
                        newText: formattedLie,
                        timestamp: Date.now(),
                        type: 'dictionary-replace',
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

                    totalReplacedCount++;
                    if (isDictionaryMatch) {
                        dictionaryReplacedCount++;
                    } else {
                        randomReplacedCount++;
                    }
                } else {
                    console.log(`[DictionaryReplacer] 跳过注释（无匹配内容）: "${comment.cleanText}"`);
                }
            }
        }); console.log(`[DictionaryReplacer] 替换操作完成，成功: ${success}, 总替换数量: ${totalReplacedCount} (字典: ${dictionaryReplacedCount}, 随机: ${randomReplacedCount})`);

        if (success && totalReplacedCount > 0) {
            // 通知toggle manager状态已更新
            this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);

            // 构建详细的完成消息
            let message = `字典替换完成！共替换了 ${totalReplacedCount} 个注释`;
            if (dictionaryReplacedCount > 0 && randomReplacedCount > 0) {
                message += ` (字典匹配: ${dictionaryReplacedCount} 个，随机生成: ${randomReplacedCount} 个)`;
            } else if (dictionaryReplacedCount > 0) {
                message += ` (全部为字典匹配)`;
            } else {
                message += ` (全部为随机生成)`;
            }

            vscode.window.showInformationMessage(message + '。');
            console.log(`[DictionaryReplacer] 撒谎会话保持活跃，共处理 ${totalReplacedCount} 个注释`);
        } else {
            // 如果替换失败或没有替换任何注释，结束会话
            this.historyManager.endLieSession(filePath);
            console.log(`[DictionaryReplacer] 撒谎会话已结束，因为没有成功替换注释`);

            if (totalReplacedCount === 0) {
                vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
            } else {
                vscode.window.showErrorMessage('替换操作失败！');
            }
        }
    }/**
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

        // 使用CommentScanner扫描当前文件中的所有注释
        const scanResult = await this.commentScanner.scanDocument(editor.document);

        console.log('检测到的注释数量:', scanResult.comments.length);
        console.log('字典大小:', this.liesDictionary.size);

        if (!scanResult.success || scanResult.comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }// 为每个注释生成预览信息
        const commentItems: vscode.QuickPickItem[] = [];
        const commentDataArray: { comment: any, lieText: string }[] = []; for (let i = 0; i < scanResult.comments.length; i++) {
            const comment = scanResult.comments[i];
            const lieText = this.generateLieForComment(comment.content);

            console.log(`注释${i + 1}: "${comment.content}" -> "${lieText}"`);

            if (lieText) {
                const originalText = this.extractCommentContent(comment.content);
                const lineNumber = comment.range.start.line + 1;

                commentItems.push({
                    label: `第${lineNumber}行: ${originalText}`,
                    description: `→ ${lieText}`,
                    detail: `${this.getCommentTypeFromFormat(comment.format)} 注释`,
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
                    );                    // 保持注释格式，只替换内容
                    const formattedLie = this.formatCommentWithLie(comment.content, lieText, comment.type);

                    editBuilder.replace(range, formattedLie);                    // 记录历史
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        originalText: comment.content,
                        newText: formattedLie,
                        timestamp: Date.now(),
                        type: 'dictionary-replace',
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
                        originalText: comment.content,
                        newText: formattedLie,
                        lineNumber: comment.range.start.line + 1
                    });

                    replacedCount++;
                }
            });
        }); if (success && replacedCount > 0) {
            // 通知toggle manager状态已更新
            this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);
            vscode.window.showInformationMessage(
                `选择性字典替换完成！共替换了 ${replacedCount} 个注释。`
            );
        } else {
            vscode.window.showErrorMessage('替换操作失败！');
        }
    }

    /**
     * 使用扫描器进行智能字典替换
     */
    public async smartDictionaryReplaceComments(): Promise<void> {
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

            // 分析哪些注释可以进行字典替换
            const replaceableComments = scanResult.comments.filter(comment => {
                const lie = findMatchingLie(comment.cleanText, this.liesDictionary);
                return lie !== null;
            });

            if (replaceableComments.length === 0) {
                const action = await vscode.window.showInformationMessage(
                    '没有找到可以进行字典替换的注释，是否使用随机替换？',
                    '随机替换全部',
                    '手动选择',
                    '取消'
                );

                if (action === '随机替换全部') {
                    await this.randomReplaceAllComments(scanResult);
                } else if (action === '手动选择') {
                    await this.manualSelectComments(scanResult);
                }
                return;
            }

            // 显示可替换的注释
            const message = `找到 ${replaceableComments.length} 条可进行字典替换的注释，共 ${scanResult.totalComments} 条注释`;
            const action = await vscode.window.showInformationMessage(
                message,
                '替换匹配的注释',
                '查看详细信息',
                '取消'
            ); if (action === '替换匹配的注释') {
                await this.executeSmartDictionaryReplace(replaceableComments, true);
            } else if (action === '查看详细信息') {
                await this.showReplaceableCommentsList(replaceableComments, scanResult.totalComments);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`智能字典替换时发生错误: ${error}`);
        }
    }    /**
     * 执行智能字典替换（重构版）
     * @param comments 要替换的注释列表
     * @param showMessage 是否显示完成消息，默认为false，避免重复显示
     * @returns 返回替换结果
     */
    private async executeSmartDictionaryReplace(comments: any[], showMessage: boolean = false): Promise<{ success: boolean, replacedCount: number }> {
        console.log('[DictionaryReplacer] 执行智能字典替换，注释数量:', comments.length, '显示消息:', showMessage);

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log('[DictionaryReplacer] 未找到活动编辑器');
            return { success: false, replacedCount: 0 };
        }

        let replacedCount = 0;
        const results: SingleReplaceResult[] = [];

        // 开始编辑操作
        const success = await editor.edit(editBuilder => {
            for (const comment of comments) {
                const lie = findMatchingLie(comment.cleanText, this.liesDictionary);

                if (lie) {
                    console.log(`[DictionaryReplacer] 智能替换注释: "${comment.cleanText}" -> "${lie}"`);

                    // 构建新的注释文本，保持原有格式
                    let newCommentText = '';

                    switch (comment.format) {
                        case 'single-line-slash':
                            newCommentText = `${comment.indentation}// ${lie}`;
                            break;
                        case 'single-line-hash':
                            newCommentText = `${comment.indentation}# ${lie}`;
                            break;
                        case 'multi-line-star':
                            if (comment.multiLinePosition === 'single') {
                                newCommentText = `${comment.indentation}/* ${lie} */`;
                            } else {
                                newCommentText = comment.content.replace(comment.cleanText, lie);
                            }
                            break;
                        case 'html-comment':
                            newCommentText = `${comment.indentation}<!-- ${lie} -->`;
                            break;
                        default:
                            newCommentText = `${comment.indentation}// ${lie}`;
                    }

                    editBuilder.replace(comment.range, newCommentText);

                    // 记录结果
                    results.push({
                        success: true,
                        originalText: comment.cleanText,
                        newText: lie,
                        lineNumber: comment.lineNumber
                    });

                    // 记录历史
                    const record = this.historyManager.createHistoryRecord(
                        editor.document.uri.fsPath,
                        comment.content,
                        newCommentText,
                        comment.range,
                        'dictionary-replace'
                    );

                    this.historyManager.addRecord(record);
                    replacedCount++;
                } else {
                    console.log(`[DictionaryReplacer] 跳过注释（无匹配内容）: "${comment.cleanText}"`);
                }
            }
        });

        console.log(`[DictionaryReplacer] 智能替换操作完成，成功: ${success}, 替换数量: ${replacedCount}`);

        if (success && replacedCount > 0) {
            // 通知toggle manager状态已更新
            this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);

            // 只有在showMessage为true时才显示消息
            if (showMessage) {
                vscode.window.showInformationMessage(
                    `智能字典替换完成！成功替换了 ${replacedCount} 条注释`
                );
            }
        } else if (success && replacedCount === 0 && showMessage) {
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
        } else if (!success && showMessage) {
            vscode.window.showErrorMessage('字典替换失败！');
        }

        return { success, replacedCount };
    }

    /**
     * 随机替换所有注释
     */    private async randomReplaceAllComments(scanResult: any): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        let replacedCount = 0; const success = await editor.edit(editBuilder => {
            for (const comment of scanResult.comments) {
                const randomLie = getRandomLie();

                // 构建新的注释文本
                let newCommentText = '';

                switch (comment.format) {
                    case 'single-line-slash':
                        newCommentText = `${comment.indentation}// ${randomLie}`;
                        break;
                    case 'single-line-hash':
                        newCommentText = `${comment.indentation}# ${randomLie}`;
                        break;
                    case 'multi-line-star':
                        if (comment.multiLinePosition === 'single') {
                            newCommentText = `${comment.indentation}/* ${randomLie} */`;
                        } else {
                            newCommentText = comment.content.replace(comment.cleanText, randomLie);
                        }
                        break;
                    case 'html-comment':
                        newCommentText = `${comment.indentation}<!-- ${randomLie} -->`;
                        break;
                    default:
                        newCommentText = `${comment.indentation}// ${randomLie}`;
                }

                editBuilder.replace(comment.range, newCommentText);

                // 记录历史
                const record = this.historyManager.createHistoryRecord(
                    editor.document.uri.fsPath,
                    comment.content,
                    newCommentText,
                    comment.range,
                    'dictionary-replace'
                );

                this.historyManager.addRecord(record);
                replacedCount++;
            }
        }); if (success) {
            // 通知toggle manager状态已更新
            this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);
            vscode.window.showInformationMessage(
                `随机替换完成！成功替换了 ${replacedCount} 条注释`
            );
        }
    }    /**
     * 手动选择注释进行替换
     */
    private async manualSelectComments(scanResult: any): Promise<void> {
        interface CommentQuickPickItem extends vscode.QuickPickItem {
            comment: any;
        }

        const quickPickItems: CommentQuickPickItem[] = scanResult.comments.map((comment: any, index: number) => ({
            label: `第 ${comment.lineNumber + 1} 行`,
            description: comment.cleanText.substring(0, 50) + (comment.cleanText.length > 50 ? '...' : ''),
            detail: `格式: ${comment.format}`,
            comment: comment
        }));

        const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: '选择要进行随机替换的注释',
            canPickMany: true,
            matchOnDescription: true
        }); if (selectedItems && selectedItems.length > 0) {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            let replacedCount = 0;

            const success = await editor.edit(editBuilder => {
                for (const item of selectedItems) {
                    const randomLie = getRandomLie();                    // 构建新的注释文本
                    let newCommentText = '';
                    const comment = item.comment;

                    switch (comment.format) {
                        case 'single-line-slash':
                            newCommentText = `${comment.indentation}// ${randomLie}`;
                            break;
                        case 'single-line-hash':
                            newCommentText = `${comment.indentation}# ${randomLie}`;
                            break;
                        case 'multi-line-star':
                            if (comment.multiLinePosition === 'single') {
                                newCommentText = `${comment.indentation}/* ${randomLie} */`;
                            } else {
                                newCommentText = comment.content.replace(comment.cleanText, randomLie);
                            }
                            break;
                        case 'html-comment':
                            newCommentText = `${comment.indentation}<!-- ${randomLie} -->`;
                            break;
                        default:
                            newCommentText = `${comment.indentation}// ${randomLie}`;
                    }

                    editBuilder.replace(comment.range, newCommentText);

                    // 记录历史
                    const record = this.historyManager.createHistoryRecord(
                        editor.document.uri.fsPath,
                        comment.content,
                        newCommentText,
                        comment.range,
                        'dictionary-replace'
                    );

                    this.historyManager.addRecord(record);
                    replacedCount++;
                }
            }); if (success) {
                // 通知toggle manager状态已更新
                this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);
                vscode.window.showInformationMessage(
                    `手动替换完成！成功替换了 ${replacedCount} 条注释`
                );
            }
        }
    }

    /**
     * 显示可替换注释的详细列表
     */
    private async showReplaceableCommentsList(replaceableComments: any[], totalComments: number): Promise<void> {
        const quickPickItems = replaceableComments.map((comment, index) => {
            const lie = findMatchingLie(comment.cleanText, this.liesDictionary);
            return {
                label: `第 ${comment.lineNumber + 1} 行`,
                description: comment.cleanText.substring(0, 30) + '...',
                detail: `将替换为: ${lie}`,
                comment: comment
            };
        });

        await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: `可替换的注释列表 (${replaceableComments.length}/${totalComments})`,
            matchOnDescription: true,
            matchOnDetail: true
        });
    }

    /**
     * 从注释格式获取注释类型
     * @param format 注释格式
     * @returns 注释类型
     */
    private getCommentTypeFromFormat(format: any): string {
        switch (format) {
            case 'single-line-slash':
            case 'single-line-hash':
                return 'line';
            case 'jsdoc-comment':
                return 'documentation';
            case 'multi-line-star':
                return 'block';
            case 'html-comment':
                return 'html';
            default:
                return 'line';
        }
    }
}