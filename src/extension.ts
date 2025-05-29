// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

/**
 * 历史记录接口
 */
interface HistoryRecord {
	id: string; // 添加唯一ID
	filePath: string;
	lineNumber: number;
	originalText: string;
	newText: string;
	timestamp: Date;
	// 添加位置信息，使还原更准确
	startPosition: { line: number; character: number };
	endPosition: { line: number; character: number };
}

/**
 * 全局历史记录存储
 */
let changeHistory: HistoryRecord[] = [];

/**
 * 扩展上下文，用于持久化存储
 */
let extensionContext: vscode.ExtensionContext;

/**
 * 生成唯一ID
 */
function generateId(): string {
	return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 保存历史记录到持久化存储
 */
function saveHistory() {
	if (extensionContext) {
		extensionContext.globalState.update('changeHistory', changeHistory);
	}
}

/**
 * 从持久化存储加载历史记录
 */
function loadHistory() {
	if (extensionContext) {
		const savedHistory = extensionContext.globalState.get<HistoryRecord[]>('changeHistory', []);
		changeHistory = savedHistory.map(record => ({
			...record,
			timestamp: new Date(record.timestamp) // 确保timestamp是Date对象
		}));
	}
}

/**
 * 创建历史记录
 */
function createHistoryRecord(
	filePath: string,
	originalText: string,
	newText: string,
	range: vscode.Range
): HistoryRecord {
	return {
		id: generateId(),
		filePath,
		lineNumber: range.start.line + 1,
		originalText,
		newText,
		timestamp: new Date(),
		startPosition: { line: range.start.line, character: range.start.character },
		endPosition: { line: range.end.line, character: range.end.character }
	};
}

/**
 * 精确还原特定的更改
 */
async function restoreSpecificChange(record: HistoryRecord): Promise<boolean> {
	const editor = vscode.window.activeTextEditor;
	if (!editor || editor.document.uri.fsPath !== record.filePath) {
		return false;
	}

	const document = editor.document;

	try {
		// 尝试通过精确位置还原
		const range = new vscode.Range(
			record.startPosition.line,
			record.startPosition.character,
			record.endPosition.line,
			record.endPosition.character
		);

		// 检查当前位置的文本是否匹配
		const currentText = document.getText(range);
		if (currentText === record.newText) {
			// 精确匹配，直接还原
			await editor.edit(editBuilder => {
				editBuilder.replace(range, record.originalText);
			});
			return true;
		}

		// 如果精确位置不匹配，尝试在附近行查找
		const searchStartLine = Math.max(0, record.startPosition.line - 2);
		const searchEndLine = Math.min(document.lineCount - 1, record.endPosition.line + 2);

		for (let i = searchStartLine; i <= searchEndLine; i++) {
			const line = document.lineAt(i);
			if (line.text.includes(record.newText.trim())) {
				const newRange = new vscode.Range(i, 0, i, line.text.length);
				await editor.edit(editBuilder => {
					editBuilder.replace(newRange, record.originalText);
				});
				return true;
			}
		}

		return false;
	} catch (error) {
		console.error('还原失败:', error);
		return false;
	}
}

/**
 * 检测文本是否为注释
 * @param text 文本内容
 * @param languageId 语言ID
 * @returns 是否为注释
 */
function isComment(text: string, languageId: string): boolean {
	const trimmedText = text.trim();

	switch (languageId) {
		case 'javascript':
		case 'typescript':
		case 'java':
		case 'csharp':
		case 'cpp':
		case 'c':
			return trimmedText.startsWith('//') ||
				(trimmedText.startsWith('/*') && trimmedText.endsWith('*/'));
		case 'python':
		case 'ruby':
		case 'shell':
			return trimmedText.startsWith('#');
		case 'html':
		case 'xml':
			return trimmedText.startsWith('<!--') && trimmedText.endsWith('-->');
		case 'css':
		case 'scss':
		case 'less':
			return trimmedText.startsWith('/*') && trimmedText.endsWith('*/');
		default:
			// 默认检测常见的注释格式
			return trimmedText.startsWith('//') ||
				trimmedText.startsWith('#') ||
				(trimmedText.startsWith('/*') && trimmedText.endsWith('*/')) ||
				(trimmedText.startsWith('<!--') && trimmedText.endsWith('-->'));
	}
}

/**
 * 保持注释格式，只替换内容
 * @param originalComment 原始注释
 * @param newContent 新内容
 * @param languageId 语言ID
 * @returns 新的注释
 */
function replaceCommentContent(originalComment: string, newContent: string, languageId: string): string {
	const trimmed = originalComment.trim();

	// JavaScript/TypeScript/Java/C#/C++ 单行注释
	if (trimmed.startsWith('//')) {
		return originalComment.replace(/\/\/\s*.*/, `// ${newContent}`);
	}

	// Python/Ruby/Shell 注释
	if (trimmed.startsWith('#')) {
		return originalComment.replace(/#\s*.*/, `# ${newContent}`);
	}

	// 多行注释 /* */
	if (trimmed.startsWith('/*') && trimmed.endsWith('*/')) {
		return originalComment.replace(/\/\*[\s\S]*?\*\//, `/* ${newContent} */`);
	}

	// HTML/XML 注释
	if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) {
		return originalComment.replace(/<!--[\s\S]*?-->/, `<!-- ${newContent} -->`);
	}

	return originalComment;
}

/**
 * 手动替换注释功能
 */
async function replaceComment() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('请先打开一个文件！');
		return;
	}

	// 获取用户输入的原始注释和新注释
	const originalComment = await vscode.window.showInputBox({
		prompt: '请输入要替换的原始注释内容',
		placeHolder: '例如：这是一个计算函数'
	});

	if (!originalComment) {
		return;
	}

	const newComment = await vscode.window.showInputBox({
		prompt: '请输入新的撒谎注释内容',
		placeHolder: '例如：这个函数用来播放音乐'
	});

	if (!newComment) {
		return;
	}

	const document = editor.document;
	const languageId = document.languageId;
	let replacements = 0;

	// 遍历文档的每一行
	await editor.edit(editBuilder => {
		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);
			const lineText = line.text;

			// 检查这一行是否包含要替换的注释
			if (isComment(lineText, languageId) && lineText.includes(originalComment)) {
				const newLineText = lineText.replace(originalComment, newComment);
				editBuilder.replace(line.range, newLineText);
				replacements++;

				// 记录历史
				const record = createHistoryRecord(
					document.uri.fsPath,
					lineText,
					newLineText,
					line.range
				);
				changeHistory.push(record);
			}
		}
	});

	// 保存历史记录
	saveHistory();

	if (replacements > 0) {
		vscode.window.showInformationMessage(`成功替换了 ${replacements} 个注释！你已经成功撒谎了 😈`);
	} else {
		vscode.window.showWarningMessage('没有找到匹配的注释内容');
	}
}

/**
 * 替换选中的注释
 */
async function replaceSelectedComment() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('请先打开一个文件！');
		return;
	}

	const selection = editor.selection;
	const selectedText = editor.document.getText(selection);

	if (!selectedText) {
		vscode.window.showErrorMessage('请先选中一段文本！');
		return;
	}

	const languageId = editor.document.languageId;

	// 检查选中的文本是否为注释
	if (!isComment(selectedText, languageId)) {
		vscode.window.showErrorMessage('选中的文本不是注释！');
		return;
	}

	const newComment = await vscode.window.showInputBox({
		prompt: '请输入新的撒谎注释内容',
		placeHolder: '例如：这个函数用来播放音乐',
		value: selectedText.replace(/^(\s*)(\/\/|#|\/\*|<!--)\s*/, '').replace(/\s*(\*\/|-->)\s*$/, '').trim()
	});

	if (!newComment) {
		return;
	}

	const newCommentText = replaceCommentContent(selectedText, newComment, languageId);

	await editor.edit(editBuilder => {
		editBuilder.replace(selection, newCommentText);
	});

	// 记录历史
	const record = createHistoryRecord(
		editor.document.uri.fsPath,
		selectedText,
		newCommentText,
		selection
	);
	changeHistory.push(record);

	// 保存历史记录
	saveHistory();

	vscode.window.showInformationMessage('注释替换成功！你已经成功撒谎了 😈');
}

/**
 * 撤销上次更改
 */
async function undoLastChange() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('请先打开一个文件！');
		return;
	}

	if (changeHistory.length === 0) {
		vscode.window.showInformationMessage('没有可撤销的更改');
		return;
	}

	// 获取最后一个更改记录
	const lastChange = changeHistory[changeHistory.length - 1];
	const currentFilePath = editor.document.uri.fsPath;

	// 检查是否是当前文件的更改
	if (lastChange.filePath !== currentFilePath) {
		const shouldContinue = await vscode.window.showWarningMessage(
			'最后一次更改不是当前文件，是否要撤销？',
			'是', '否'
		);
		if (shouldContinue !== '是') {
			return;
		}
	}

	// 精确还原最后一次更改
	const success = await restoreSpecificChange(lastChange);
	if (success) {
		// 从历史记录中移除
		changeHistory.pop();
		saveHistory();
		vscode.window.showInformationMessage(`已撤销对第${lastChange.lineNumber}行的更改 😇`);
	} else {
		vscode.window.showErrorMessage('撤销失败，可能文件已被修改');
	}
}

/**
 * 显示历史记录
 */
async function showHistory() {
	if (changeHistory.length === 0) {
		vscode.window.showInformationMessage('还没有撒过谎呢！');
		return;
	}

	const items = changeHistory.map((record, index) => ({
		label: `第${record.lineNumber}行 - ${new Date(record.timestamp).toLocaleString()}`,
		description: `${record.originalText.trim()} → ${record.newText.trim()}`,
		detail: record.filePath,
		index: index
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: '选择要查看的撒谎历史',
		matchOnDescription: true,
		matchOnDetail: true
	});

	if (selected) {
		vscode.window.showInformationMessage(
			`撒谎详情：\n原始：${changeHistory[selected.index].originalText}\n撒谎：${changeHistory[selected.index].newText}`
		);
	}
}

/**
 * 从历史中还原
 */
async function restoreFromHistory() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('请先打开一个文件！');
		return;
	}

	if (changeHistory.length === 0) {
		vscode.window.showInformationMessage('没有可还原的历史记录');
		return;
	}

	// 只显示当前文件的历史记录
	const currentFilePath = editor.document.uri.fsPath;
	const fileHistory = changeHistory.filter(record => record.filePath === currentFilePath);

	if (fileHistory.length === 0) {
		vscode.window.showInformationMessage('当前文件没有撒谎历史');
		return;
	}

	const items = fileHistory.map((record) => ({
		label: `第${record.lineNumber}行 - ${new Date(record.timestamp).toLocaleString()}`,
		description: `撒谎内容：${record.newText.trim()}`,
		detail: `原始内容：${record.originalText.trim()}`,
		record: record
	}));

	const selected = await vscode.window.showQuickPick(items, {
		placeHolder: '选择要还原的撒谎记录',
		matchOnDescription: true,
		matchOnDetail: true
	});

	if (!selected) {
		return;
	}

	const record = selected.record;

	// 使用精确还原函数
	const success = await restoreSpecificChange(record);
	if (success) {
		// 从历史记录中移除
		const index = changeHistory.findIndex(r => r.id === record.id);
		if (index !== -1) {
			changeHistory.splice(index, 1);
			saveHistory();
		}
		vscode.window.showInformationMessage(`第${record.lineNumber}行已还原为原始内容 😇`);
	} else {
		vscode.window.showErrorMessage('还原失败，可能文件内容已被修改');
	}
}

/**
 * 清除所有历史记录
 */
async function clearAllHistory() {
	if (changeHistory.length === 0) {
		vscode.window.showInformationMessage('没有历史记录需要清除');
		return;
	}

	const confirm = await vscode.window.showWarningMessage(
		`确定要清除所有 ${changeHistory.length} 条撒谎历史记录吗？此操作不可撤销！`,
		'确定', '取消'
	);

	if (confirm === '确定') {
		changeHistory = [];
		saveHistory();
		vscode.window.showInformationMessage('所有撒谎历史已清除 🗑️');
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// 初始化扩展上下文
	extensionContext = context;

	// 加载历史记录
	loadHistory();

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "我爱撒谎" is now active!');

	// 注册手动替换注释命令
	const replaceCommentDisposable = vscode.commands.registerCommand('ilovelie.replaceComment', replaceComment);

	// 注册替换选中注释命令
	const replaceSelectedCommentDisposable = vscode.commands.registerCommand('ilovelie.replaceSelectedComment', replaceSelectedComment);

	// 注册撤销命令
	const undoLastChangeDisposable = vscode.commands.registerCommand('ilovelie.undoLastChange', undoLastChange);

	// 注册查看历史命令
	const showHistoryDisposable = vscode.commands.registerCommand('ilovelie.showHistory', showHistory);

	// 注册从历史还原命令
	const restoreFromHistoryDisposable = vscode.commands.registerCommand('ilovelie.restoreFromHistory', restoreFromHistory);

	// 注册清除历史命令
	const clearAllHistoryDisposable = vscode.commands.registerCommand('ilovelie.clearAllHistory', clearAllHistory);

	context.subscriptions.push(
		replaceCommentDisposable,
		replaceSelectedCommentDisposable,
		undoLastChangeDisposable,
		showHistoryDisposable,
		restoreFromHistoryDisposable,
		clearAllHistoryDisposable
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
