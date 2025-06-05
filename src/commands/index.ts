import * as vscode from 'vscode';
import { CommentReplacer } from '../commentReplacer';
import { DictionaryReplacer } from '../dictionaryReplacer';
import { RestoreManager } from '../restoreManager';
import { CommentDetector } from '../commentDetector';
import { CommentHider } from '../commentHider';
import { AIReplacer } from '../aiReplacer';
import { CommentScanner } from '../commentScanner';
import { ToggleManager } from '../toggleManager';
import { HistoryManager } from '../historyManager';

/**
 * 命令注册器
 * 负责注册所有VS Code命令
 */
export class CommandRegistrar {
    private commentReplacer: CommentReplacer;
    private dictionaryReplacer: DictionaryReplacer;
    private restoreManager: RestoreManager;
    private commentDetector: CommentDetector;
    private commentHider: CommentHider;
    private aiReplacer: AIReplacer;
    private commentScanner: CommentScanner;
    private toggleManager: ToggleManager;

    constructor(
        commentReplacer: CommentReplacer,
        dictionaryReplacer: DictionaryReplacer,
        restoreManager: RestoreManager,
        commentDetector: CommentDetector,
        commentHider: CommentHider,
        aiReplacer: AIReplacer,
        commentScanner: CommentScanner,
        toggleManager: ToggleManager,
        historyManager: HistoryManager
    ) {
        this.commentReplacer = commentReplacer;
        this.dictionaryReplacer = dictionaryReplacer;
        this.restoreManager = restoreManager;
        this.commentDetector = commentDetector;
        this.commentHider = commentHider;
        this.aiReplacer = aiReplacer;
        this.commentScanner = commentScanner;
        this.toggleManager = toggleManager;
    }

    /**
     * 注册所有命令
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        const commands = [            // 注释替换命令
            {
                id: 'ilovelie.replaceComment',
                handler: () => this.commentReplacer.replaceComment()
            },
            {
                id: 'ilovelie.replaceSelectedComment',
                handler: () => this.commentReplacer.replaceSelectedComment()
            },
            {
                id: 'ilovelie.smartReplaceComment',
                handler: () => this.commentReplacer.smartReplaceComment()
            }, {
                id: 'ilovelie.dictionaryReplaceComments',
                handler: () => this.dictionaryReplacer.dictionaryReplaceComments()
            },
            {
                id: 'ilovelie.selectiveDictionaryReplace',
                handler: () => this.dictionaryReplacer.selectiveDictionaryReplaceComments()
            },
            {
                id: 'ilovelie.smartDictionaryReplace',
                handler: () => this.dictionaryReplacer.smartDictionaryReplaceComments()
            },
            {
                id: 'ilovelie.showHistory',
                handler: () => this.restoreManager.showHistory()
            },
            {
                id: 'ilovelie.restoreFromHistory',
                handler: () => this.restoreManager.restoreFromHistory()
            },
            {
                id: 'ilovelie.clearAllHistory',
                handler: () => this.restoreManager.clearAllHistory()
            },

            // 注释隐藏命令
            {
                id: 'ilovelie.toggleCommentVisibility',
                handler: () => this.commentHider.toggleCommentVisibility()
            },
            // AI撒谎命令
            {
                id: 'ilovelie.aiReplaceSelectedComment',
                handler: () => this.aiReplacer.aiReplaceSingleComment()
            },
            {
                id: 'ilovelie.aiBatchReplaceComments',
                handler: () => this.aiReplacer.aiBatchReplaceComments()
            },
            {
                id: 'ilovelie.aiSelectiveReplaceComments',
                handler: () => this.aiReplacer.aiSelectiveReplaceComments()
            }, {
                id: 'ilovelie.configureAI',
                handler: () => this.aiReplacer.openConfigurationCenter()
            },            // 注释扫描命令
            {
                id: 'ilovelie.scanComments',
                handler: () => this.scanAndShowComments()
            },
            {
                id: 'ilovelie.showCommentStatistics',
                handler: () => this.showCommentStatistics()
            },            // 真话假话切换命令
            {
                id: 'ilovelie.toggleTruthState',
                handler: () => this.toggleTruthState()
            },
            {
                id: 'ilovelie.showCurrentStatus',
                handler: () => this.toggleManager.showCurrentStatus()
            }, {
                id: 'ilovelie.clearCurrentFileHistory',
                handler: () => this.clearCurrentFileHistory()
            }
        ];

        // 注册每个命令
        commands.forEach(command => {
            const disposable = vscode.commands.registerCommand(command.id, command.handler);
            context.subscriptions.push(disposable);
        });        // 注册文档关闭事件监听器
        const onDidCloseDocument = vscode.workspace.onDidCloseTextDocument((document) => {
            this.commentHider.handleDocumentClose(document);
            // 清理toggle状态
            this.toggleManager.cleanupDocumentState(document.uri.toString());
        });

        context.subscriptions.push(onDidCloseDocument);
    }

    /**
     * 扫描并显示注释
     */
    private async scanAndShowComments(): Promise<void> {
        try {
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
                detail: `格式: ${comment.format} | 缩进: ${comment.indentation.length} 个空格`,
                comment: comment
            }));

            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                placeHolder: `选择要查看的注释 (共找到 ${scanResult.totalComments} 条注释)`,
                matchOnDescription: true,
                matchOnDetail: true
            });

            if (selectedItem) {
                // 跳转到选中的注释
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const position = new vscode.Position(selectedItem.comment.lineNumber, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(selectedItem.comment.range, vscode.TextEditorRevealType.InCenter);
                }
            }

        } catch (error) {
            vscode.window.showErrorMessage(`扫描注释时发生错误: ${error}`);
        }
    }

    /**
     * 显示注释统计信息
     */
    private async showCommentStatistics(): Promise<void> {
        try {
            const scanResult = await this.commentScanner.scanActiveDocument();

            if (!scanResult.success) {
                vscode.window.showErrorMessage(`扫描注释失败: ${scanResult.errorMessage}`);
                return;
            }

            const stats = this.commentScanner.getStatistics(scanResult);

            // 格式化统计信息
            let message = `📊 注释统计信息\n\n`;
            message += `文件: ${scanResult.documentInfo.fileName}\n`;
            message += `语言: ${scanResult.documentInfo.languageId}\n`;
            message += `总行数: ${scanResult.documentInfo.totalLines}\n\n`;
            message += `📝 注释概览:\n`;
            message += `• 总注释数: ${stats.totalComments}\n`;
            message += `• 单行注释: ${stats.singleLineComments}\n`;
            message += `• 多行注释: ${stats.multiLineComments}\n\n`;
            message += `🔍 格式分布:\n`;

            Object.entries(stats.formatBreakdown).forEach(([format, count]) => {
                const formatNames = {
                    'single-line-slash': '// 单行注释',
                    'single-line-hash': '# 单行注释',
                    'multi-line-star': '/* */ 多行注释',
                    'html-comment': '<!-- --> HTML注释'
                };
                message += `• ${formatNames[format as keyof typeof formatNames] || format}: ${count}\n`;
            });

            // 显示在信息窗口中
            const action = await vscode.window.showInformationMessage(
                message,
                { modal: true },
                '查看详细列表',
                '导出统计'
            );

            if (action === '查看详细列表') {
                await this.scanAndShowComments();
            } else if (action === '导出统计') {
                await this.exportStatistics(scanResult, stats);
            }

        } catch (error) {
            vscode.window.showErrorMessage(`获取注释统计时发生错误: ${error}`);
        }
    }

    /**
     * 导出统计信息到文件
     */
    private async exportStatistics(scanResult: any, stats: any): Promise<void> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `comment-statistics-${timestamp}.txt`;

            let content = `注释统计报告\n`;
            content += `生成时间: ${new Date().toLocaleString()}\n\n`;
            content += `文件信息:\n`;
            content += `  文件名: ${scanResult.documentInfo.fileName}\n`;
            content += `  语言: ${scanResult.documentInfo.languageId}\n`;
            content += `  总行数: ${scanResult.documentInfo.totalLines}\n\n`;
            content += `注释统计:\n`;
            content += `  总注释数: ${stats.totalComments}\n`;
            content += `  单行注释: ${stats.singleLineComments}\n`;
            content += `  多行注释: ${stats.multiLineComments}\n\n`;
            content += `格式分布:\n`;

            Object.entries(stats.formatBreakdown).forEach(([format, count]) => {
                content += `  ${format}: ${count}\n`;
            });

            content += `\n详细注释列表:\n`;
            scanResult.comments.forEach((comment: any, index: number) => {
                content += `\n${index + 1}. 第 ${comment.lineNumber + 1} 行 (${comment.format})\n`;
                content += `   内容: ${comment.cleanText}\n`;
                content += `   缩进: ${comment.indentation.length} 个空格\n`;
            });

            // 保存到工作区
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                await vscode.workspace.fs.writeFile(filePath, Buffer.from(content, 'utf8'));

                const action = await vscode.window.showInformationMessage(
                    `统计报告已导出到: ${fileName}`,
                    '打开文件'
                );

                if (action === '打开文件') {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);
                }
            }

        } catch (error) {
            vscode.window.showErrorMessage(`导出统计信息失败: ${error}`);
        }
    }    /**
     * 切换真话假话状态
     */
    private async toggleTruthState(): Promise<void> {
        try {
            const result = await this.toggleManager.toggleTruthState();

            if (result.success) {
                const stateText = result.newState === 'truth' ? '真话模式' : '假话模式';
                const icon = result.newState === 'truth' ? '✅' : '🤥';

                vscode.window.showInformationMessage(
                    `${icon} 已切换到${stateText}` +
                    (result.affectedComments > 0 ? ` (影响了 ${result.affectedComments} 个注释)` : '')
                );
            } else {
                vscode.window.showErrorMessage(`切换失败: ${result.errorMessage}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`切换状态时发生错误: ${error}`);
        }
    }

    /**
     * 清除当前文件的撒谎历史记录
     */
    private async clearCurrentFileHistory(): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('没有活动的编辑器');
                return;
            }

            const documentUri = editor.document.uri.toString();

            // 获取当前文件的历史记录数量
            const records = this.restoreManager.historyManager.getRecordsForFile(documentUri);

            if (records.length === 0) {
                vscode.window.showInformationMessage('当前文件没有撒谎历史记录');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `确定要永久清除当前文件的 ${records.length} 条撒谎历史记录吗？此操作不可撤销！`,
                '确定', '取消'
            ); if (confirm === '确定') {
                const result = await this.restoreManager.historyManager.clearRecordsForFile(documentUri);

                if (result.success) {
                    // 更新toggle状态
                    await this.toggleManager.refreshDocumentState(documentUri);

                    vscode.window.showInformationMessage(
                        `已永久清除当前文件的 ${result.clearedCount} 条撒谎历史记录 🗑️`
                    );
                } else {
                    vscode.window.showErrorMessage('清除历史记录失败');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`清除历史记录时发生错误: ${error}`);
        }
    }
}
