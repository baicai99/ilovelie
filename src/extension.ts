// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

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
			}
		}
	});

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

	vscode.window.showInformationMessage('注释替换成功！你已经成功撒谎了 😈');
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "我爱撒谎" is now active!');

	// 注册手动替换注释命令
	const replaceCommentDisposable = vscode.commands.registerCommand('ilovelie.replaceComment', replaceComment);

	// 注册替换选中注释命令
	const replaceSelectedCommentDisposable = vscode.commands.registerCommand('ilovelie.replaceSelectedComment', replaceSelectedComment);

	context.subscriptions.push(replaceCommentDisposable, replaceSelectedCommentDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
