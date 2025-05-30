import * as vscode from 'vscode';
import { CommentReplacer } from '../commentReplacer';
import { DictionaryReplacer } from '../dictionaryReplacer';
import { RestoreManager } from '../restoreManager';
import { CommentDetector } from '../commentDetector';
import { CommentHider } from '../commentHider';
import { AIReplacer } from '../aiReplacer';

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
    private aiReplacer: AIReplacer; constructor(
        commentReplacer: CommentReplacer,
        dictionaryReplacer: DictionaryReplacer,
        restoreManager: RestoreManager,
        commentDetector: CommentDetector,
        commentHider: CommentHider,
        aiReplacer: AIReplacer
    ) {
        this.commentReplacer = commentReplacer;
        this.dictionaryReplacer = dictionaryReplacer;
        this.restoreManager = restoreManager;
        this.commentDetector = commentDetector;
        this.commentHider = commentHider;
        this.aiReplacer = aiReplacer;
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
            },
            {
                id: 'ilovelie.replaceSelectedComment',
                handler: () => this.commentReplacer.replaceSelectedComment()
            },
            {
                id: 'ilovelie.dictionaryReplaceComments',
                handler: () => this.dictionaryReplacer.dictionaryReplaceComments()
            },
            {
                id: 'ilovelie.selectiveDictionaryReplace',
                handler: () => this.dictionaryReplacer.selectiveDictionaryReplaceComments()
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
            }
        ];

        // 注册每个命令
        commands.forEach(command => {
            const disposable = vscode.commands.registerCommand(command.id, command.handler);
            context.subscriptions.push(disposable);
        });        // 注册文档关闭事件监听器
        const onDidCloseDocument = vscode.workspace.onDidCloseTextDocument((document) => {
            this.commentHider.handleDocumentClose(document);
        });

        context.subscriptions.push(onDidCloseDocument);
    }
}
