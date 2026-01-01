import * as vscode from 'vscode';
import { CommentDetector } from '../comment/commentDetector';
import { CommentScanner } from '../comment/commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { ToggleManager } from '../manager/toggleManager';
import { createLiesDictionary, getRandomLie, findMatchingLie } from '../data/liesDictionary';
import { applyCommentReplacements, CommentReplacement } from '../utils/commentReplacementExecutor';

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

    constructor(
        commentDetector: CommentDetector,
        historyManager: HistoryManager,
        toggleManager: ToggleManager | undefined,
        commentScanner: CommentScanner
    ) {
        console.log('[DictionaryReplacer] 初始化字典替换器');
        this.commentDetector = commentDetector;
        this.commentScanner = commentScanner;
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

        const commentFormats = new Set(scanResult.comments.map(comment => comment.format));
        if (commentFormats.size > 1) {
            console.log(`[DictionaryReplacer] 检测到混合注释类型: ${Array.from(commentFormats).join(', ')}`);
        }

        if (scanResult.comments.length > 500) {
            const choice = await vscode.window.showWarningMessage(
                `发现 ${scanResult.comments.length} 个注释，批量替换可能较慢，是否继续？`,
                '继续替换',
                '取消'
            );
            if (choice !== '继续替换') {
                await this.historyManager.endLieSession(filePath);
                return;
            }
        }

        // 分析可以进行字典替换的注释
        const dictionaryReplaceableComments = scanResult.comments.filter(comment => {
            const lie = findMatchingLie(comment.cleanText, this.liesDictionary);
            return lie !== null;
        });

        console.log(`[DictionaryReplacer] 可进行字典替换的注释: ${dictionaryReplaceableComments.length} 个`);

        let dictionaryReplacedCount = 0;
        let randomReplacedCount = 0;
        const replacements: CommentReplacement[] = [];

        for (const comment of scanResult.comments) {
            const lieText = this.generateLieForComment(comment.cleanText);

            if (lieText) {
                const isDictionaryMatch = findMatchingLie(comment.cleanText, this.liesDictionary) !== null;

                console.log(`[DictionaryReplacer] 替换注释: "${comment.cleanText}" -> "${lieText}" (${isDictionaryMatch ? '字典匹配' : '随机生成'})`);

                replacements.push({ comment, newContent: lieText });

                if (isDictionaryMatch) {
                    dictionaryReplacedCount++;
                } else {
                    randomReplacedCount++;
                }
            } else {
                console.log(`[DictionaryReplacer] 跳过注释（无匹配内容）: "${comment.cleanText}"`);
            }
        }

        const totalReplacedCount = replacements.length;
        if (totalReplacedCount === 0) {
            await this.historyManager.endLieSession(filePath);
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
            return;
        }

        const result = await applyCommentReplacements({
            editor,
            replacements,
            historyManager: this.historyManager,
            recordType: 'dictionary-replace',
            toggleManager: this.toggleManager
        });

        console.log(`[DictionaryReplacer] 替换操作完成，成功: ${result.success}, 总替换数量: ${totalReplacedCount} (字典: ${dictionaryReplacedCount}, 随机: ${randomReplacedCount})`);

        if (result.success && totalReplacedCount > 0) {

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
            await this.historyManager.endLieSession(filePath);
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

        // 启动新的撒谎会话
        const filePath = editor.document.uri.fsPath;
        const sessionId = this.historyManager.startLieSession(filePath, editor.document.getText());
        console.log(`[DictionaryReplacer] 开始新的选择性字典替换会话: ${sessionId}`);

        // 使用CommentScanner扫描当前文件中的所有注释
        const scanResult = await this.commentScanner.scanDocument(editor.document);

        console.log('检测到的注释数量:', scanResult.comments.length);
        console.log('字典大小:', this.liesDictionary.size);

        if (!scanResult.success || scanResult.comments.length === 0) {
            await this.historyManager.endLieSession(filePath);
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
            await this.historyManager.endLieSession(filePath);
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
            await this.historyManager.endLieSession(filePath);
            return;
        }        // 执行替换
        const replacements: CommentReplacement[] = [];

        selectedItems.forEach(item => {
            const itemIndex = commentItems.indexOf(item);
            const commentData = commentDataArray[itemIndex];
            if (commentData) {
                const { comment, lieText } = commentData;
                replacements.push({ comment, newContent: lieText });
            }
        });

        if (replacements.length === 0) {
            await this.historyManager.endLieSession(filePath);
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
            return;
        }

        const result = await applyCommentReplacements({
            editor,
            replacements,
            historyManager: this.historyManager,
            recordType: 'dictionary-replace',
            toggleManager: this.toggleManager
        });

        if (result.success && result.replacedCount > 0) {
            // 通知toggle manager状态已更新
            this.toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);
            vscode.window.showInformationMessage(
                `选择性字典替换完成！共替换了 ${result.replacedCount} 个注释。`
            );
        } else {
            await this.historyManager.endLieSession(filePath);
            vscode.window.showErrorMessage('替换操作失败！');
        }
    }

    /**
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

        const replacements: CommentReplacement[] = [];

        for (const comment of comments) {
            const lie = findMatchingLie(comment.cleanText, this.liesDictionary);

            if (lie) {
                console.log(`[DictionaryReplacer] 智能替换注释: "${comment.cleanText}" -> "${lie}"`);
                replacements.push({ comment, newContent: lie });
            } else {
                console.log(`[DictionaryReplacer] 跳过注释（无匹配内容）: "${comment.cleanText}"`);
            }
        }

        const result = await applyCommentReplacements({
            editor,
            replacements,
            historyManager: this.historyManager,
            recordType: 'dictionary-replace',
            toggleManager: this.toggleManager
        });

        console.log(`[DictionaryReplacer] 智能替换操作完成，成功: ${result.success}, 替换数量: ${result.replacedCount}`);

        if (result.success && result.replacedCount > 0) {
            // 只有在showMessage为true时才显示消息
            if (showMessage) {
                vscode.window.showInformationMessage(
                    `智能字典替换完成！成功替换了 ${result.replacedCount} 条注释`
                );
            }
        } else if (result.success && result.replacedCount === 0 && showMessage) {
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
        } else if (!result.success && showMessage) {
            vscode.window.showErrorMessage('字典替换失败！');
        }

        return { success: result.success, replacedCount: result.replacedCount };
    }

    /**
     * 随机替换所有注释
     */    private async randomReplaceAllComments(scanResult: any): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const replacements: CommentReplacement[] = scanResult.comments.map((comment: any) => ({
            comment,
            newContent: getRandomLie()
        }));

        const result = await applyCommentReplacements({
            editor,
            replacements,
            historyManager: this.historyManager,
            recordType: 'dictionary-replace',
            toggleManager: this.toggleManager
        });

        if (result.success) {
            vscode.window.showInformationMessage(
                `随机替换完成！成功替换了 ${result.replacedCount} 条注释`
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

            const replacements: CommentReplacement[] = selectedItems.map(item => ({
                comment: item.comment,
                newContent: getRandomLie()
            }));

            const result = await applyCommentReplacements({
                editor,
                replacements,
                historyManager: this.historyManager,
                recordType: 'dictionary-replace',
                toggleManager: this.toggleManager
            });

            if (result.success) {
                vscode.window.showInformationMessage(
                    `手动替换完成！成功替换了 ${result.replacedCount} 条注释`
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
