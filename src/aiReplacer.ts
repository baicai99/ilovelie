/**
 * AI驱动的撒谎替换器
 * 使用OpenAI GPT-4o-mini生成创意撒谎内容
 */
import * as vscode from 'vscode';
import OpenAI from 'openai';
import { CommentDetector } from './commentDetector';
import { HistoryManager } from './historyManager';
import { HistoryRecord } from './types';

export interface AIReplaceResult {
    success: boolean;
    originalText: string;
    newText: string;
    lineNumber: number;
    error?: string;
}

export class AIReplacer {
    private commentDetector: CommentDetector;
    private historyManager: HistoryManager;
    private openai: OpenAI | null = null;
    private isConfigured = false;

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager) {
        this.commentDetector = commentDetector;
        this.historyManager = historyManager;
        this.initializeOpenAI();
    }

    /**
     * 初始化OpenAI客户端
     */
    private initializeOpenAI(): void {
        const config = vscode.workspace.getConfiguration('ilovelie');
        const apiKey = config.get<string>('openaiApiKey');
        const baseURL = config.get<string>('openaiBaseURL');

        if (apiKey) {
            try {
                this.openai = new OpenAI({
                    apiKey: apiKey,
                    baseURL: baseURL || 'https://api.openai.com/v1'
                });
                this.isConfigured = true;
            } catch (error) {
                console.error('初始化OpenAI客户端失败:', error);
                this.isConfigured = false;
            }
        } else {
            this.isConfigured = false;
        }
    }

    /**
     * 检查AI配置是否正确
     */
    public async checkConfiguration(): Promise<boolean> {
        if (!this.isConfigured) {
            const choice = await vscode.window.showWarningMessage(
                '🤖 AI功能需要配置OpenAI API Key，是否现在配置？',
                '立即配置',
                '稍后再说'
            );

            if (choice === '立即配置') {
                await this.showConfigurationGuide();
                return false;
            }
            return false;
        }
        return true;
    }

    /**
     * 显示配置指南
     */
    private async showConfigurationGuide(): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'aiConfig',
            '🤖 AI撒谎功能配置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.getConfigurationWebviewContent();

        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'saveConfig':
                        await this.saveConfiguration(message.apiKey, message.baseURL);
                        panel.dispose();
                        break;
                    case 'testConfig':
                        await this.testConfiguration(message.apiKey, message.baseURL);
                        break;
                }
            }
        );
    }

    /**
     * 获取配置界面HTML内容
     */
    private getConfigurationWebviewContent(): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI撒谎功能配置</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        .input-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input {
            width: 100%;
            padding: 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }
        button {
            padding: 8px 16px;
            margin-right: 10px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .info {
            background-color: var(--vscode-textBlockQuote-background);
            padding: 10px;
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            margin-bottom: 20px;
        }
        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        .test-result {
            margin-top: 10px;
            padding: 10px;
            border-radius: 4px;
            display: none;
        }
        .success {
            background-color: var(--vscode-inputValidation-infoBackground);
            color: var(--vscode-inputValidation-infoForeground);
        }
        .error {
            background-color: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-inputValidation-errorForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 AI撒谎功能配置</h1>
        
        <div class="info">
            <h3>功能说明</h3>
            <p>AI撒谎功能使用OpenAI的GPT-4o-mini模型来生成创意的撒谎内容，让你的注释变得更加有趣和迷惑人！</p>
        </div>

        <div class="warning">
            <h3>⚠️ 注意事项</h3>
            <ul>
                <li>你需要有一个OpenAI API Key</li>
                <li>API Key不会上传到服务器，只保存在本地</li>
                <li>使用API会产生费用，请注意使用量</li>
                <li>支持自定义API Base URL（用于代理或其他兼容的服务）</li>
            </ul>
        </div>

        <form>
            <div class="input-group">
                <label for="apiKey">OpenAI API Key *</label>
                <input type="password" id="apiKey" placeholder="sk-..." required>
                <small>从 <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI平台</a> 获取</small>
            </div>

            <div class="input-group">
                <label for="baseURL">API Base URL (可选)</label>
                <input type="url" id="baseURL" placeholder="https://api.openai.com/v1" value="https://api.openai.com/v1">
                <small>使用代理或其他兼容服务时修改此项</small>
            </div>

            <div>
                <button type="button" onclick="testConfiguration()">测试连接</button>
                <button type="button" onclick="saveConfiguration()">保存配置</button>
            </div>

            <div id="testResult" class="test-result"></div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function testConfiguration() {
            const apiKey = document.getElementById('apiKey').value;
            const baseURL = document.getElementById('baseURL').value;
            
            if (!apiKey) {
                showTestResult('请输入API Key', false);
                return;
            }

            showTestResult('正在测试连接...', null);
            
            vscode.postMessage({
                command: 'testConfig',
                apiKey: apiKey,
                baseURL: baseURL
            });
        }

        function saveConfiguration() {
            const apiKey = document.getElementById('apiKey').value;
            const baseURL = document.getElementById('baseURL').value;
            
            if (!apiKey) {
                showTestResult('请输入API Key', false);
                return;
            }

            vscode.postMessage({
                command: 'saveConfig',
                apiKey: apiKey,
                baseURL: baseURL
            });
        }

        function showTestResult(message, success) {
            const resultDiv = document.getElementById('testResult');
            resultDiv.textContent = message;
            resultDiv.style.display = 'block';
            
            if (success === true) {
                resultDiv.className = 'test-result success';
            } else if (success === false) {
                resultDiv.className = 'test-result error';
            } else {
                resultDiv.className = 'test-result';
            }
        }

        // 监听来自扩展的消息
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'testResult') {
                showTestResult(message.message, message.success);
            }
        });
    </script>
</body>
</html>`;
    }

    /**
     * 保存配置
     */
    private async saveConfiguration(apiKey: string, baseURL: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('ilovelie');
        await config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);
        await config.update('openaiBaseURL', baseURL, vscode.ConfigurationTarget.Global);

        this.initializeOpenAI();

        vscode.window.showInformationMessage('🎉 AI配置已保存！现在可以使用AI撒谎功能了。');
    }

    /**
     * 测试配置
     */
    private async testConfiguration(apiKey: string, baseURL: string): Promise<void> {
        try {
            const testClient = new OpenAI({
                apiKey: apiKey,
                baseURL: baseURL || 'https://api.openai.com/v1'
            });

            // 发送一个简单的测试请求
            await testClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 1
            });

            vscode.window.showInformationMessage('✅ 连接测试成功！');
        } catch (error: any) {
            vscode.window.showErrorMessage(`❌ 连接测试失败：${error.message}`);
        }
    }

    /**
     * 清理AI返回内容中的注释符号，避免双斜杠问题
     */
    private cleanAIContent(content: string): string {
        return content
            // 移除开头的注释符号
            .replace(/^\/\/+\s*/, '')     // 移除开头的 //
            .replace(/^\/\*+\s*/, '')     // 移除开头的 /*
            .replace(/\s*\*+\/$/, '')     // 移除结尾的 */
            .replace(/^<!--\s*/, '')      // 移除开头的 <!--
            .replace(/\s*-->$/, '')       // 移除结尾的 -->
            .replace(/^#+\s*/, '')        // 移除开头的 #
            // 移除中间可能出现的注释符号
            .replace(/\/\/+/g, '')        // 移除所有 //
            .replace(/\/\*[\s\S]*?\*\//g, '') // 移除所有 /* */
            .replace(/<!--[\s\S]*?-->/g, '') // 移除所有 <!-- -->
            .trim();
    }    /**
     * AI生成撒谎内容（单个）
     */
    private async generateLieContent(originalComment: string): Promise<string> {
        if (!this.openai) {
            throw new Error('OpenAI 客户端未初始化');
        } const prompt = `你是一个专业的"撒谎"专家，专门为代码注释生成完全不相关但听起来合理的虚假描述。

原始注释：${originalComment}

请为这个注释生成一个完全不相关但听起来很专业的虚假描述。要求：
- 完全不能暴露真实功能
- 听起来要专业且合理
- 长度适中，不要太长
- 中文回复
- 只回复替换后的内容，不要其他解释
- 不要包含任何注释符号（如//、/*、<!--等）
- 只返回纯文本内容

例如：
- "计算用户数据" -> "优化网络延迟"
- "数据库连接" -> "图像渲染处理"
- "用户验证" -> "音频解码算法"

请生成一个类似的创意撒谎内容：`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100,
                temperature: 0.8,
                top_p: 0.9
            }); const content = response.choices[0]?.message?.content?.trim();
            if (!content) {
                throw new Error('AI生成的内容为空');
            }

            // 清理AI返回内容中可能包含的注释符号，避免双斜杠问题
            const cleanContent = this.cleanAIContent(content);

            return cleanContent;
        } catch (error: any) {
            console.error('AI生成失败:', error);
            throw new Error(`AI生成失败: ${error.message}`);
        }
    }

    /**
     * AI批量生成撒谎内容（优化版）
     */
    private async generateBatchLieContent(originalComments: string[]): Promise<string[]> {
        if (!this.openai) {
            throw new Error('OpenAI 客户端未初始化');
        }

        if (originalComments.length === 0) {
            return [];
        }

        // 构建批量处理的提示词
        const numberedComments = originalComments.map((comment, index) =>
            `${index + 1}. ${comment.replace(/\s+/g, ' ').trim()}`
        ).join('\n');

        const prompt = `你是一个专业的"撒谎"专家，专门为代码注释生成完全不相关但听起来合理的虚假描述。

我将给你 ${originalComments.length} 个原始注释，请为每个注释生成一个对应的虚假描述。

原始注释列表：
${numberedComments}

要求：
- 完全不能暴露真实功能
- 听起来要专业且合理
- 长度适中，不要太长
- 中文回复
- 不要包含任何注释符号（如//、/*、<!--等）
- 只返回纯文本内容

示例转换：
- "计算用户数据" -> "优化网络延迟"
- "数据库连接" -> "图像渲染处理"  
- "用户验证" -> "音频解码算法"

请按照相同的编号顺序返回对应的虚假描述，每行一个，格式如下：
1. [第一个注释的虚假描述]
2. [第二个注释的虚假描述]
...

请开始生成：`;

        try {
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: Math.min(4000, originalComments.length * 50), // 动态调整token限制
                temperature: 0.8,
                top_p: 0.9
            });

            const content = response.choices[0]?.message?.content?.trim();
            if (!content) {
                throw new Error('AI生成的内容为空');
            }

            // 解析返回的批量结果
            const lines = content.split('\n').filter(line => line.trim());
            const results: string[] = [];

            for (const line of lines) {
                // 匹配 "数字. 内容" 格式
                const match = line.match(/^\d+\.\s*(.+)$/);
                if (match) {
                    const cleanContent = this.cleanAIContent(match[1]);
                    results.push(cleanContent);
                }
            }

            // 如果解析的结果数量不匹配，回退到原始方式
            if (results.length !== originalComments.length) {
                console.warn(`批量AI生成结果数量不匹配：期望 ${originalComments.length}，实际 ${results.length}`);

                // 尝试简单按行分割
                const simpleResults = content.split('\n')
                    .map(line => line.replace(/^\d+\.\s*/, '').trim())
                    .filter(line => line.length > 0)
                    .map(line => this.cleanAIContent(line))
                    .slice(0, originalComments.length);

                if (simpleResults.length === originalComments.length) {
                    return simpleResults;
                }

                // 如果还是不匹配，抛出错误让调用方回退到单个处理
                throw new Error(`批量处理结果数量不匹配，期望 ${originalComments.length} 个，实际获得 ${results.length} 个`);
            }

            return results;

        } catch (error: any) {
            console.error('批量AI生成失败:', error);
            throw new Error(`批量AI生成失败: ${error.message}`);
        }
    }

    /**
     * AI替换单个注释
     */
    public async aiReplaceSingleComment(): Promise<void> {
        if (!(await this.checkConfiguration())) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showErrorMessage('请先选中要替换的注释！');
            return;
        }

        const selectedText = editor.document.getText(selection);
        if (!this.commentDetector.isComment(selectedText, editor.document.languageId)) {
            vscode.window.showErrorMessage('选中的内容不是注释！');
            return;
        }

        try {
            // 显示加载提示
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 AI正在生成创意撒谎内容...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "分析注释内容..." });

                // 生成AI撒谎内容
                const lieContent = await this.generateLieContent(selectedText);
                progress.report({ increment: 50, message: "生成撒谎内容..." });

                // 格式化注释
                const formattedLie = this.commentDetector.replaceCommentContent(
                    selectedText,
                    lieContent,
                    editor.document.languageId
                );
                progress.report({ increment: 20, message: "应用替换..." });

                // 应用替换
                const success = await editor.edit(editBuilder => {
                    editBuilder.replace(selection, formattedLie);
                });

                if (success) {
                    // 保存到历史记录
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        originalText: selectedText,
                        newText: formattedLie,
                        timestamp: Date.now(),
                        type: 'ai-replace',
                        startPosition: {
                            line: selection.start.line,
                            character: selection.start.character
                        },
                        endPosition: {
                            line: selection.end.line,
                            character: selection.end.character
                        }
                    };

                    this.historyManager.addRecord(historyRecord);
                }
            });

            vscode.window.showInformationMessage('🎉 AI撒谎替换完成！代码注释已被AI完美伪装。');

        } catch (error: any) {
            vscode.window.showErrorMessage(`😅 AI撒谎失败：${error.message}`);
        }
    }    /**
     * AI批量替换注释（优化版）
     */
    public async aiBatchReplaceComments(): Promise<void> {
        if (!(await this.checkConfiguration())) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 检测所有注释
        const comments = this.commentDetector.detectComments(editor.document);
        if (comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            `🤖 发现 ${comments.length} 个注释，AI批量替换将使用优化的批量处理模式，是否继续？`,
            '继续替换',
            '取消'
        );

        if (choice !== '继续替换') {
            return;
        }

        let replacedCount = 0;
        const results: AIReplaceResult[] = [];

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 AI正在批量生成撒谎内容...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 10, message: "准备批量处理..." });

                // 提取所有注释文本
                const commentTexts = comments.map(comment => comment.text);

                progress.report({ increment: 20, message: "发送批量请求到AI..." });

                try {
                    // 使用批量生成方法
                    const lieContents = await this.generateBatchLieContent(commentTexts);

                    progress.report({ increment: 50, message: "处理AI返回结果..." });

                    // 处理结果
                    for (let i = 0; i < comments.length; i++) {
                        const comment = comments[i];
                        const lieContent = lieContents[i];

                        if (lieContent) {
                            // 格式化注释
                            const formattedLie = this.commentDetector.replaceCommentContent(
                                comment.text,
                                lieContent,
                                editor.document.languageId
                            );

                            results.push({
                                success: true,
                                originalText: comment.text,
                                newText: formattedLie,
                                lineNumber: comment.range.start.line + 1
                            });
                        } else {
                            results.push({
                                success: false,
                                originalText: comment.text,
                                newText: '',
                                lineNumber: comment.range.start.line + 1,
                                error: '批量生成结果为空'
                            });
                        }
                    }

                } catch (batchError: any) {
                    // 批量处理失败，回退到单个处理模式
                    console.warn('批量AI处理失败，回退到单个处理模式:', batchError.message);

                    progress.report({ increment: 0, message: "批量处理失败，使用单个处理模式..." });

                    for (let i = 0; i < comments.length; i++) {
                        const comment = comments[i];
                        const progressPercent = Math.round((i / comments.length) * 60); // 剩余60%进度

                        progress.report({
                            increment: i === 0 ? 0 : 60 / comments.length,
                            message: `单个处理 ${i + 1}/${comments.length} (${progressPercent}%)`
                        });

                        try {
                            // 生成AI撒谎内容
                            const lieContent = await this.generateLieContent(comment.text);

                            // 格式化注释
                            const formattedLie = this.commentDetector.replaceCommentContent(
                                comment.text,
                                lieContent,
                                editor.document.languageId
                            );

                            results.push({
                                success: true,
                                originalText: comment.text,
                                newText: formattedLie,
                                lineNumber: comment.range.start.line + 1
                            });

                        } catch (error: any) {
                            results.push({
                                success: false,
                                originalText: comment.text,
                                newText: '',
                                lineNumber: comment.range.start.line + 1,
                                error: error.message
                            });
                        }

                        // 小延迟避免API限制
                        if (i < comments.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                progress.report({ increment: 20, message: "应用替换..." });
            });

            // 应用所有替换
            const success = await editor.edit(editBuilder => {
                for (let i = 0; i < comments.length; i++) {
                    const comment = comments[i];
                    const result = results[i];

                    if (result.success) {
                        const range = new vscode.Range(
                            new vscode.Position(comment.range.start.line, comment.range.start.character),
                            new vscode.Position(comment.range.end.line, comment.range.end.character)
                        );

                        editBuilder.replace(range, result.newText);

                        // 保存到历史记录
                        const historyRecord: HistoryRecord = {
                            id: this.generateId(),
                            filePath: editor.document.uri.fsPath,
                            originalText: result.originalText,
                            newText: result.newText,
                            timestamp: Date.now(),
                            type: 'ai-batch-replace',
                            startPosition: {
                                line: comment.range.start.line,
                                character: comment.range.start.character
                            },
                            endPosition: {
                                line: comment.range.end.line,
                                character: comment.range.end.character
                            }
                        };

                        this.historyManager.addRecord(historyRecord);
                        replacedCount++;
                    }
                }
            });

            const failedCount = results.filter(r => !r.success).length;

            if (success && replacedCount > 0) {
                let message = `🎉 AI批量撒谎完成！成功替换了 ${replacedCount} 个注释`;
                if (failedCount > 0) {
                    message += `，${failedCount} 个失败`;
                }
                message += `。使用了${failedCount > 0 && replacedCount < comments.length ? '混合' : '批量'}处理模式。`;
                vscode.window.showInformationMessage(message);
            } else if (failedCount === results.length) {
                vscode.window.showErrorMessage('😅 所有注释的AI生成都失败了！请检查网络连接和API配置。');
            } else {
                vscode.window.showErrorMessage('替换操作失败！');
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`😅 AI批量撒谎失败：${error.message}`);
        }
    }

    /**
     * AI选择性替换注释
     */
    public async aiSelectiveReplaceComments(): Promise<void> {
        if (!(await this.checkConfiguration())) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 检测所有注释
        const comments = this.commentDetector.detectComments(editor.document);
        if (comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        }

        // 为每个注释生成预览信息
        const commentItems: vscode.QuickPickItem[] = comments.map((comment, index) => {
            const preview = comment.text.replace(/\s+/g, ' ').trim();
            const shortPreview = preview.length > 50 ? preview.substring(0, 47) + '...' : preview;

            return {
                label: `第 ${comment.range.start.line + 1} 行`,
                description: shortPreview,
                detail: `完整内容: ${preview}`,
                picked: false
            };
        });

        // 显示多选列表
        const selectedItems = await vscode.window.showQuickPick(commentItems, {
            placeHolder: '选择要进行AI撒谎替换的注释（可多选）',
            canPickMany: true,
            matchOnDescription: true,
            ignoreFocusOut: true
        });

        if (!selectedItems || selectedItems.length === 0) {
            return;
        }

        const choice = await vscode.window.showWarningMessage(
            `🤖 将对 ${selectedItems.length} 个注释进行AI撒谎替换，这可能会产生API费用，是否继续？`,
            '继续替换',
            '取消'
        );

        if (choice !== '继续替换') {
            return;
        }        // 获取选中的注释索引
        const selectedIndices = selectedItems.map(item => {
            const lineNumber = parseInt(item.label.match(/第 (\d+) 行/)?.[1] || '0') - 1;
            return comments.findIndex(comment => comment.range.start.line === lineNumber);
        }).filter(index => index !== -1);

        let replacedCount = 0;
        const results: AIReplaceResult[] = [];

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🤖 AI正在为选中注释生成撒谎内容...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 10, message: "准备批量处理选中注释..." });

                // 提取选中的注释文本
                const selectedComments = selectedIndices.map(index => comments[index]);
                const commentTexts = selectedComments.map(comment => comment.text);

                progress.report({ increment: 20, message: "发送批量请求到AI..." });

                try {
                    // 使用批量生成方法
                    const lieContents = await this.generateBatchLieContent(commentTexts);

                    progress.report({ increment: 50, message: "处理AI返回结果..." });

                    // 处理结果
                    for (let i = 0; i < selectedComments.length; i++) {
                        const comment = selectedComments[i];
                        const lieContent = lieContents[i];

                        if (lieContent) {
                            // 格式化注释
                            const formattedLie = this.commentDetector.replaceCommentContent(
                                comment.text,
                                lieContent,
                                editor.document.languageId
                            );

                            results.push({
                                success: true,
                                originalText: comment.text,
                                newText: formattedLie,
                                lineNumber: comment.range.start.line + 1
                            });
                        } else {
                            results.push({
                                success: false,
                                originalText: comment.text,
                                newText: '',
                                lineNumber: comment.range.start.line + 1,
                                error: '批量生成结果为空'
                            });
                        }
                    }

                } catch (batchError: any) {
                    // 批量处理失败，回退到单个处理模式
                    console.warn('批量AI处理失败，回退到单个处理模式:', batchError.message);

                    progress.report({ increment: 0, message: "批量处理失败，使用单个处理模式..." });

                    for (let i = 0; i < selectedIndices.length; i++) {
                        const commentIndex = selectedIndices[i];
                        const comment = comments[commentIndex];
                        const progressPercent = Math.round((i / selectedIndices.length) * 60); // 剩余60%进度

                        progress.report({
                            increment: i === 0 ? 0 : 60 / selectedIndices.length,
                            message: `单个处理 ${i + 1}/${selectedIndices.length} (${progressPercent}%)`
                        });

                        try {
                            // 生成AI撒谎内容
                            const lieContent = await this.generateLieContent(comment.text);

                            // 格式化注释
                            const formattedLie = this.commentDetector.replaceCommentContent(
                                comment.text,
                                lieContent,
                                editor.document.languageId
                            );

                            results.push({
                                success: true,
                                originalText: comment.text,
                                newText: formattedLie,
                                lineNumber: comment.range.start.line + 1
                            });

                        } catch (error: any) {
                            results.push({
                                success: false,
                                originalText: comment.text,
                                newText: '',
                                lineNumber: comment.range.start.line + 1,
                                error: error.message
                            });
                        }

                        // 小延迟避免API限制
                        if (i < selectedIndices.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                progress.report({ increment: 20, message: "应用替换..." });
            });

            // 应用替换
            const success = await editor.edit(editBuilder => {
                for (let i = 0; i < selectedIndices.length; i++) {
                    const commentIndex = selectedIndices[i];
                    const comment = comments[commentIndex];
                    const result = results[i];

                    if (result.success) {
                        const range = new vscode.Range(
                            new vscode.Position(comment.range.start.line, comment.range.start.character),
                            new vscode.Position(comment.range.end.line, comment.range.end.character)
                        );

                        editBuilder.replace(range, result.newText);

                        // 保存到历史记录
                        const historyRecord: HistoryRecord = {
                            id: this.generateId(),
                            filePath: editor.document.uri.fsPath,
                            originalText: result.originalText,
                            newText: result.newText,
                            timestamp: Date.now(),
                            type: 'ai-selective-replace',
                            startPosition: {
                                line: comment.range.start.line,
                                character: comment.range.start.character
                            },
                            endPosition: {
                                line: comment.range.end.line,
                                character: comment.range.end.character
                            }
                        };

                        this.historyManager.addRecord(historyRecord);
                        replacedCount++;
                    }
                }
            }); const failedCount = results.filter(r => !r.success).length;

            if (success && replacedCount > 0) {
                let message = `🎉 AI选择性撒谎完成！成功替换了 ${replacedCount} 个注释`;
                if (failedCount > 0) {
                    message += `，${failedCount} 个失败`;
                }
                message += `。使用了${failedCount > 0 && replacedCount < selectedIndices.length ? '混合' : '批量'}处理模式。`;
                vscode.window.showInformationMessage(message);
            } else if (failedCount === results.length) {
                vscode.window.showErrorMessage('😅 所有选中注释的AI生成都失败了！请检查网络连接和API配置。');
            } else {
                vscode.window.showErrorMessage('替换操作失败！');
            }

        } catch (error: any) {
            vscode.window.showErrorMessage(`😅 AI选择性撒谎失败：${error.message}`);
        }
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
