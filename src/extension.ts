/**
 * "我爱撒谎" VS Code 扩展
 * 主入口文件 - 负责初始化所有组件和注册命令
 */
import * as vscode from 'vscode';

// 导入所有模块
import { HistoryManager } from './historyManager';
import { CommentDetector } from './commentDetector';
import { CommentReplacer } from './commentReplacer';
import { RestoreManager } from './restoreManager';
import { TempStateManager } from './tempStateManager';
import { CommandRegistrar } from './commands';

// 全局实例
let historyManager: HistoryManager;
let commentDetector: CommentDetector;
let commentReplacer: CommentReplacer;
let restoreManager: RestoreManager;
let tempStateManager: TempStateManager;
let commandRegistrar: CommandRegistrar;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "我爱撒谎" is now active!');

	// 初始化所有管理器
	historyManager = new HistoryManager();
	historyManager.initialize(context);
	commentDetector = new CommentDetector();
	restoreManager = new RestoreManager(historyManager);
	tempStateManager = new TempStateManager(historyManager, restoreManager);
	commentReplacer = new CommentReplacer(commentDetector, historyManager);

	// 初始化命令注册器并注册所有命令
	commandRegistrar = new CommandRegistrar(
		commentReplacer,
		restoreManager,
		tempStateManager
	);

	// 注册所有命令
	commandRegistrar.registerCommands(context);

	// 监听文档关闭事件
	const onDidCloseDocument = vscode.workspace.onDidCloseTextDocument((document) => {
		const filePath = document.uri.fsPath;
		const tempState = tempStateManager.getTempState(filePath);

		if (tempState && tempState.isTemporarilyRestored) {
			// 延迟恢复撒谎状态，给用户一点时间看到提示
			setTimeout(() => {
				tempStateManager.restoreLieState(filePath);
			}, 1000);
		}
	});

	// 添加到订阅中
	context.subscriptions.push(onDidCloseDocument);
}

// This method is called when your extension is deactivated
export function deactivate() { }
