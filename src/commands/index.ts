import * as vscode from 'vscode';
import { CommentReplacer } from '../commentReplacer';
import { DictionaryReplacer } from '../dictionaryReplacer';
import { RestoreManager } from '../restoreManager';
import { TempStateManager } from '../tempStateManager';

/**
 * 命令注册器
 * 负责注册所有VS Code命令
 */
export class CommandRegistrar {
    private commentReplacer: CommentReplacer;
    private dictionaryReplacer: DictionaryReplacer;
    private restoreManager: RestoreManager;
    private tempStateManager: TempStateManager;

    constructor(
        commentReplacer: CommentReplacer,
        dictionaryReplacer: DictionaryReplacer,
        restoreManager: RestoreManager,
        tempStateManager: TempStateManager
    ) {
        this.commentReplacer = commentReplacer;
        this.dictionaryReplacer = dictionaryReplacer;
        this.restoreManager = restoreManager;
        this.tempStateManager = tempStateManager;
    }

    /**
     * 注册所有命令
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        const commands = [
            // 注释替换命令
            {
                id: 'ilovelie.replaceComment',
                handler: () => this.commentReplacer.replaceComment()
            }, {
                id: 'ilovelie.replaceSelectedComment',
                handler: () => this.commentReplacer.replaceSelectedComment()
            },
            {
                id: 'ilovelie.dictionaryReplaceComments',
                handler: () => this.dictionaryReplacer.dictionaryReplaceComments()
            },

            // 恢复相关命令
            {
                id: 'ilovelie.undoLastChange',
                handler: () => this.restoreManager.undoLastChange()
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
            },            // 临时状态管理命令
            {
                id: 'ilovelie.toggleTruthLieState',
                handler: () => this.tempStateManager.toggleTruthLieState()
            },
            {
                id: 'ilovelie.temporarilyRestoreAllLies',
                handler: () => this.tempStateManager.temporarilyRestoreAllLies()
            },
            {
                id: 'ilovelie.restoreLieState',
                handler: (filePath: string) => this.tempStateManager.restoreLieState(filePath)
            },
            {
                id: 'ilovelie.manuallyRestoreLies',
                handler: () => this.tempStateManager.manuallyRestoreLies()
            }
        ];

        // 注册每个命令
        commands.forEach(command => {
            const disposable = vscode.commands.registerCommand(command.id, command.handler);
            context.subscriptions.push(disposable);
        });

        // 注册文档关闭事件监听器
        const onDidCloseDocument = vscode.workspace.onDidCloseTextDocument((document) => {
            this.tempStateManager.handleDocumentClose(document);
        });

        context.subscriptions.push(onDidCloseDocument);
    }
}
