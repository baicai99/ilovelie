/**
 * "我爱撒谎" VS Code 扩展
 * 主入口文件 - 负责初始化所有组件和注册命令
 */
import * as vscode from 'vscode';

// 导入所有模块
import { HistoryManager } from './historyManager';
import { CommentDetector } from './commentDetector';
import { CommentScanner } from './commentScanner';
import { CommentReplacer } from './commentReplacer';
import { DictionaryReplacer } from './dictionaryReplacer';
import { RestoreManager } from './restoreManager';
import { CommentHider } from './commentHider';
import { AIReplacer } from './aiReplacer';
import { CommandRegistrar } from './commands';

// 全局实例
let historyManager: HistoryManager;
let commentDetector: CommentDetector;
let commentScanner: CommentScanner;
let commentReplacer: CommentReplacer;
let dictionaryReplacer: DictionaryReplacer;
let restoreManager: RestoreManager;
let commentHider: CommentHider;
let aiReplacer: AIReplacer;
let commandRegistrar: CommandRegistrar;

// 此方法在您的扩展被激活时调用
// 您的扩展在命令首次执行时即被激活
export function activate(context: vscode.ExtensionContext) {
	// 使用控制台输出诊断信息 (console.log) 和错误 (console.error)
	// 这行代码只会在您的扩展激活时执行一次
	console.log('Congratulations, your extension "我爱撒谎" is now active!');	// 初始化所有管理器
	historyManager = new HistoryManager();
	historyManager.initialize(context);
	commentDetector = new CommentDetector();
	commentScanner = new CommentScanner();
	restoreManager = new RestoreManager(historyManager);
	commentReplacer = new CommentReplacer(commentDetector, historyManager);
	dictionaryReplacer = new DictionaryReplacer(commentDetector, historyManager);
	commentHider = new CommentHider(commentDetector, historyManager);
	aiReplacer = new AIReplacer(commentDetector, historyManager);
	// 初始化命令注册器并注册所有命令
	commandRegistrar = new CommandRegistrar(
		commentReplacer,
		dictionaryReplacer,
		restoreManager,
		commentDetector,
		commentHider,
		aiReplacer,
		commentScanner
	);
	// 注册所有命令
	commandRegistrar.registerCommands(context);
}

// 此方法在您的扩展被停用时调用
export function deactivate() { }
