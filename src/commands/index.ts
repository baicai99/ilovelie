import * as vscode from 'vscode';
import { CommentReplacer } from '../replacer/commentReplacer';
import { DictionaryReplacer } from '../replacer/dictionaryReplacer';
import { CommentDetector } from '../comment/commentDetector';
import { CommentHider } from '../comment/commentHider';
import { AIReplacer } from '../replacer/aiReplacer';
import { CommentScanner } from '../comment/commentScanner';
import { ToggleManager } from '../manager/toggleManager';
import { TruthToggleState } from '../types';
import { HistoryManager } from '../manager/historyManager';

/**
 * 命令注册器
 * 负责注册所有VS Code命令
 */
export class CommandRegistrar {
    private commentReplacer: CommentReplacer;
    private dictionaryReplacer: DictionaryReplacer;
    private commentDetector: CommentDetector;
    private commentHider: CommentHider;
    private aiReplacer: AIReplacer;
    private commentScanner: CommentScanner;
    private toggleManager: ToggleManager;
    private historyManager: HistoryManager; constructor(
        commentReplacer: CommentReplacer,
        dictionaryReplacer: DictionaryReplacer,
        commentDetector: CommentDetector,
        commentHider: CommentHider,
        aiReplacer: AIReplacer,
        commentScanner: CommentScanner,
        toggleManager: ToggleManager,
        historyManager: HistoryManager
    ) {
        this.commentReplacer = commentReplacer;
        this.dictionaryReplacer = dictionaryReplacer;
        this.commentDetector = commentDetector;
        this.commentHider = commentHider;
        this.aiReplacer = aiReplacer;
        this.commentScanner = commentScanner;
        this.toggleManager = toggleManager;
        this.historyManager = historyManager;
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
            }, {
                id: 'ilovelie.dictionaryReplaceComments',
                handler: () => this.dictionaryReplacer.dictionaryReplaceComments()
            },
            {
                id: 'ilovelie.selectiveDictionaryReplace',
                handler: () => this.dictionaryReplacer.selectiveDictionaryReplaceComments()
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
            this.toggleManager.cleanupDocumentState(document.uri.fsPath);
        });

        context.subscriptions.push(onDidCloseDocument);
    }

    /**
     * 切换真话假话状态
     */
    private async toggleTruthState(): Promise<void> {
        try {
            const result = await this.toggleManager.toggleTruthState();

            if (result.success) {
                const stateText = result.newState === TruthToggleState.TRUTH ? '真话模式' : '假话模式';
                const icon = result.newState === TruthToggleState.TRUTH ? '✅' : '🤥';

                vscode.window.showInformationMessage(
                    `${icon} 已切换到${stateText}` +
                    (result.affectedComments > 0 ? ` (影响了 ${result.affectedComments} 个注释)` : '')
                );
            } else if (result.newState === TruthToggleState.NONE) {
                vscode.window.showInformationMessage('当前文件没有假注释，无法切换。');
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

            const documentUri = editor.document.uri.fsPath;

            // 获取当前文件的历史记录数量
            const records = this.historyManager.getRecordsForFile(documentUri);

            if (records.length === 0) {
                vscode.window.showInformationMessage('当前文件没有撒谎历史记录');
                return;
            }

            const confirm = await vscode.window.showWarningMessage(
                `确定要永久清除当前文件的 ${records.length} 条撒谎历史记录吗？此操作不可撤销！`,
                '确定', '取消'
            );

            if (confirm === '确定') {
                const result = await this.historyManager.clearRecordsForFile(documentUri);

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
