/**
 * "我爱撒谎" VS Code 扩展
 * 主入口文件 - 负责初始化所有组件和注册命令
 */
import * as vscode from 'vscode';

// 导入所有模块
import { HistoryManager } from './historyManager';
import { CommentDetector } from './commentDetector';
import { CommentReplacer } from './commentReplacer';
import { DictionaryReplacer } from './dictionaryReplacer';
import { RestoreManager } from './restoreManager';
import { TempStateManager } from './tempStateManager';
import { CommentHider } from './commentHider';
import { AIReplacer } from './aiReplacer';
import { CommandRegistrar } from './commands';

// 全局实例
let historyManager: HistoryManager;
let commentDetector: CommentDetector;
let commentReplacer: CommentReplacer;
let dictionaryReplacer: DictionaryReplacer;
let restoreManager: RestoreManager;
let tempStateManager: TempStateManager;
let commentHider: CommentHider;
let aiReplacer: AIReplacer;
let commandRegistrar: CommandRegistrar;

// 此方法在您的扩展被激活时调用
// 您的扩展在命令首次执行时即被激活
export function activate(context: vscode.ExtensionContext) {
	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在您的扩展激活时执行一次
	console.log('Congratulations, your extension "我爱撒谎" is now active!');

	// 初始化所有管理器
	historyManager = new HistoryManager();
	historyManager.initialize(context);
	commentDetector = new CommentDetector();
	restoreManager = new RestoreManager(historyManager);
	tempStateManager = new TempStateManager(historyManager, restoreManager);
	commentReplacer = new CommentReplacer(commentDetector, historyManager);
	dictionaryReplacer = new DictionaryReplacer(commentDetector, historyManager);
	commentHider = new CommentHider(commentDetector, historyManager);
	aiReplacer = new AIReplacer(commentDetector, historyManager);

	// 初始化命令注册器并注册所有命令
	commandRegistrar = new CommandRegistrar(
		commentReplacer,
		dictionaryReplacer,
		restoreManager,
		tempStateManager,
		commentDetector,
		commentHider,
		aiReplacer
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

// 此方法在您的扩展被停用时调用
export function deactivate() { }
