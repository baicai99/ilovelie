/**
 * 真话假话切换管理器
 * 负责管理文档的真话假话状态切换
 */
import * as vscode from 'vscode';
import { TruthToggleState, ToggleStateInfo, ToggleResult, ScannedComment } from './types';
import { HistoryManager } from './historyManager';
import { CommentScanner } from './commentScanner';

export class ToggleManager {
    private historyManager: HistoryManager;
    private commentScanner: CommentScanner;
    private documentStates: Map<string, ToggleStateInfo> = new Map();
    private statusBarItem: vscode.StatusBarItem;
    private extensionContext: vscode.ExtensionContext | null = null; constructor(historyManager: HistoryManager, commentScanner: CommentScanner) {
        console.log('[ToggleManager] 构造函数开始');
        this.historyManager = historyManager;
        this.commentScanner = commentScanner;

        console.log('[ToggleManager] 创建状态栏项');
        // 创建状态栏项
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'ilovelie.toggleTruthState';
        this.statusBarItem.tooltip = '点击切换真话/假话模式';
        this.statusBarItem.show(); console.log('[ToggleManager] 设置监听器');
        // 监听活动编辑器变化
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            console.log('[ToggleManager] 活动编辑器变化事件');
            if (editor) {
                const documentUri = editor.document.uri.toString();
                console.log(`[ToggleManager] 新的活动编辑器: ${documentUri}`);
                await this.initializeDocumentState(documentUri);
            }
            this.updateStatusBar();
        });

        // 监听文档内容变化，用于更新状态
        vscode.workspace.onDidChangeTextDocument(async (event) => {
            const documentUri = event.document.uri.toString();
            console.log(`[ToggleManager] 文档内容变化: ${documentUri}`);
            // 延迟一下再刷新状态，避免频繁更新
            setTimeout(async () => {
                await this.refreshDocumentState(documentUri);
            }, 1000);
        });

        // 监听文档关闭，清理状态
        vscode.workspace.onDidCloseTextDocument((document) => {
            const documentUri = document.uri.toString();
            console.log(`[ToggleManager] 文档关闭: ${documentUri}`);
            this.cleanupDocumentState(documentUri);
        }); console.log('[ToggleManager] 初始化当前活动编辑器状态');
        // 初始化当前活动编辑器状态
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const documentUri = activeEditor.document.uri.toString();
            console.log(`[ToggleManager] 当前活动编辑器: ${documentUri}`);
            this.initializeDocumentState(documentUri);
        } else {
            console.log('[ToggleManager] 当前没有活动编辑器');
        }

        // 初始更新状态栏
        console.log('[ToggleManager] 初始更新状态栏');
        this.updateStatusBar();
        console.log('[ToggleManager] 构造函数完成');
    }

    /**
     * 切换当前文档的真话假话状态
     */
    public async toggleTruthState(): Promise<ToggleResult> {
        console.log(`[DEBUG] 开始切换真话假话状态`);

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log(`[DEBUG] 没有活动编辑器`);
            return {
                success: false,
                newState: TruthToggleState.TRUTH,
                affectedComments: 0,
                errorMessage: '没有活动的编辑器'
            };
        }

        const documentUri = editor.document.uri.toString();
        const currentState = this.getCurrentState(documentUri);

        console.log(`[DEBUG] 文档: ${documentUri}`);
        console.log(`[DEBUG] 当前状态: ${currentState}`);

        try {
            if (currentState === TruthToggleState.TRUTH) {
                console.log(`[DEBUG] 从真话切换到假话`);
                // 当前显示真话，切换到假话
                const result = await this.switchToLies(editor, documentUri);
                this.updateStatusBar(); // 更新状态栏
                console.log(`[DEBUG] 切换到假话结果:`, result);
                if (result.success) {
                    vscode.window.showInformationMessage(`🤥 已切换到假话模式 (影响了 ${result.affectedComments} 个注释)`);
                } else if (result.errorMessage) {
                    vscode.window.showErrorMessage(`切换失败: ${result.errorMessage}`);
                }
                return result;
            } else {
                console.log(`[DEBUG] 从假话切换到真话`);
                // 当前显示假话，切换到真话
                const result = await this.switchToTruth(editor, documentUri);
                this.updateStatusBar(); // 更新状态栏
                console.log(`[DEBUG] 切换到真话结果:`, result);
                if (result.success) {
                    vscode.window.showInformationMessage(`✅ 已切换到真话模式 (恢复了 ${result.affectedComments} 个注释)`);
                } else if (result.errorMessage) {
                    vscode.window.showErrorMessage(`切换失败: ${result.errorMessage}`);
                }
                return result;
            }
        } catch (error: any) {
            console.error(`[DEBUG] 切换状态时发生异常:`, error);
            vscode.window.showErrorMessage(`切换失败: ${error.message || error}`);
            return {
                success: false,
                newState: currentState,
                affectedComments: 0,
                errorMessage: `切换状态时发生错误: ${error.message || error}`
            };
        }
    }    /**
     * 获取当前文档的状态
     */
    public getCurrentState(documentUri: string): TruthToggleState {
        console.log(`[ToggleManager] 获取当前文档状态: ${documentUri}`);
        // 首先从 globalstate 获取状态
        const filePath = documentUri.startsWith('file://') ? vscode.Uri.parse(documentUri).fsPath : documentUri;
        const globalState = this.getFileStateFromGlobalState(filePath);
        console.log(`[ToggleManager] GlobalState状态: ${globalState}`);

        // 如果 globalstate 有状态记录，优先使用
        if (globalState !== TruthToggleState.TRUTH || this.hasLiesInFile(filePath)) {
            console.log(`[ToggleManager] 使用GlobalState状态: ${globalState}`);
            return globalState;
        }

        // 回退到内存状态（兼容性）
        const stateInfo = this.documentStates.get(documentUri);
        const memoryState = stateInfo?.currentState || TruthToggleState.TRUTH;
        console.log(`[ToggleManager] 使用内存状态: ${memoryState}`);
        return memoryState;
    }

    /**
     * 获取状态信息
     */
    public getStateInfo(documentUri: string): ToggleStateInfo | undefined {
        return this.documentStates.get(documentUri);
    }    /**
     * 检查文档是否有撒谎记录
     */
    private async hasLiesInDocument(documentUri: string): Promise<boolean> {
        console.log(`[ToggleManager] 检查文档是否有撒谎记录: ${documentUri}`);
        // 首先检查历史记录
        const filePath = documentUri.startsWith('file://') ? vscode.Uri.parse(documentUri).fsPath : documentUri;
        const hasLies = this.hasLiesInFile(filePath);
        console.log(`[ToggleManager] 文件有撒谎记录: ${hasLies}`);

        if (hasLies) {
            return true;
        }

        // 回退到历史记录检查（兼容性）
        const records = await this.historyManager.getRecordsForFile(documentUri);
        const hasRecords = records.length > 0;
        console.log(`[ToggleManager] 历史记录数量: ${records.length}, 有记录: ${hasRecords}`);
        return hasRecords;
    }    /**
     * 切换到假话状态
     */
    private async switchToLies(editor: vscode.TextEditor, documentUri: string): Promise<ToggleResult> {
        console.log(`[ToggleManager] switchToLies 开始: ${documentUri}`);
        const hasLies = await this.hasLiesInDocument(documentUri);
        console.log(`[DEBUG] 文档是否有撒谎记录: ${hasLies}`);

        if (!hasLies) {
            console.log(`[DEBUG] 没有撒谎记录，先扫描注释并提示用户`);
            console.log(`[ToggleManager] 开始扫描文档注释`);
            const scanResult = await this.commentScanner.scanDocument(editor.document);
            console.log(`[ToggleManager] 扫描结果:`, scanResult);

            if (!scanResult.success) {
                console.log(`[ToggleManager] 扫描失败: ${scanResult.errorMessage}`);
                return {
                    success: false,
                    newState: TruthToggleState.TRUTH,
                    affectedComments: 0,
                    errorMessage: `扫描注释失败: ${scanResult.errorMessage}`
                };
            }

            if (scanResult.totalComments === 0) {
                console.log(`[ToggleManager] 文档中没有注释`);
                return {
                    success: false,
                    newState: TruthToggleState.TRUTH,
                    affectedComments: 0,
                    errorMessage: '当前文档中没有找到注释'
                };
            } console.log(`[DEBUG] 找到 ${scanResult.totalComments} 条注释，提示用户选择替换方式`);
            console.log(`[ToggleManager] 更新文档状态为真话模式`);
            await this.updateDocumentState(documentUri, TruthToggleState.TRUTH, false); // 确保状态正确

            console.log(`[ToggleManager] 显示用户选择对话框`);
            const action = await vscode.window.showWarningMessage(
                `当前文档有 ${scanResult.totalComments} 条注释，但还没有撒谎记录。请先选择一种替换方式进行撒谎操作。`,
                '手动替换',
                '字典替换',
                'AI替换',
                '取消'
            );
            console.log(`[ToggleManager] 用户选择: ${action}`);

            if (action && action !== '取消') {
                console.log(`[ToggleManager] 执行${action}命令`);
                switch (action) {
                    case '手动替换':
                        vscode.commands.executeCommand('ilovelie.smartReplaceComment');
                        break;
                    case '字典替换':
                        vscode.commands.executeCommand('ilovelie.smartDictionaryReplace');
                        break;
                    case 'AI替换':
                        vscode.commands.executeCommand('ilovelie.aiBatchReplaceComments');
                        break;
                }
                return {
                    success: true, // 标记为成功，因为用户被引导去执行撒谎操作
                    newState: TruthToggleState.TRUTH,
                    affectedComments: 0,
                    errorMessage: `已启动${action}操作，完成后可再次切换状态`
                };
            }

            console.log(`[ToggleManager] 用户取消操作`);
            return {
                success: false,
                newState: TruthToggleState.TRUTH,
                affectedComments: 0,
                errorMessage: '需要先进行撒谎操作'
            };
        } console.log(`[ToggleManager] 开始获取历史记录并应用`);
        // 获取最新的撒谎记录并应用
        // IMPORTANT: 这里需要确保 historyManager.getRecordsForFile 返回的是当前文档所有最新的撒谎记录
        const records = await this.historyManager.getRecordsForFile(documentUri);
        let affectedComments = 0;

        console.log(`[DEBUG] 找到 ${records.length} 条历史记录可用于切换到假话`);

        if (records.length === 0) {
            console.log(`[DEBUG] 没有找到历史记录，无法切换到假话状态`);
            return {
                success: false,
                newState: TruthToggleState.TRUTH,
                affectedComments: 0,
                errorMessage: '没有找到撒谎记录'
            };
        }

        console.log(`[ToggleManager] 开始收集编辑操作`);
        // 收集所有需要替换的编辑操作
        const editOperations: Array<{ range: vscode.Range; newText: string; recordId: string }> = [];
        const processedRecordIds = new Set<string>(); // 用于去重，防止重复处理同一记录

        for (const record of records) {
            // 确保每个记录只被处理一次，以防 historyManager 返回重复记录
            if (processedRecordIds.has(record.id)) {
                console.log(`[DEBUG] 跳过重复记录: ${record.id}`);
                continue;
            }

            try {
                console.log(`[ToggleManager] 处理记录: ${record.id}`);
                const range = new vscode.Range(
                    record.startPosition.line,
                    record.startPosition.character,
                    record.endPosition.line,
                    record.endPosition.character
                );

                // 检查当前文档中该范围的文本是否与原始文本匹配
                // 这可以帮助我们避免替换掉已经被用户手动修改过的注释
                const currentTextInDocument = editor.document.getText(range);
                console.log(`[ToggleManager] 记录 ${record.id} - 当前文本: "${currentTextInDocument}", 原始文本: "${record.originalText}", 新文本: "${record.newText}"`);

                if (currentTextInDocument !== record.originalText && currentTextInDocument !== record.newText) {
                    console.warn(`[DEBUG] 记录 ${record.id} 的当前文本与原始/新文本不匹配，可能已被修改。跳过。`);
                    continue; // 跳过此记录
                }

                editOperations.push({ range, newText: record.newText, recordId: record.id });
                processedRecordIds.add(record.id);
                console.log(`[ToggleManager] 记录 ${record.id} 添加到编辑操作队列`);

            } catch (error: any) {
                console.error(`[DEBUG] 准备撒谎记录失败 ${record.id}:`, error);
            }
        } console.log(`[DEBUG] 准备执行 ${editOperations.length} 个编辑操作`);

        // 验证所有范围
        console.log(`[ToggleManager] 开始验证编辑范围`);
        const rangesToValidate = editOperations.map(op => op.range);
        const validation = this.validateEditRanges(rangesToValidate, editor.document);

        if (!validation.valid) {
            console.error(`[DEBUG] 范围验证失败:`, validation.errors);
            vscode.window.showErrorMessage(`应用撒谎时范围验证失败: ${validation.errors.join('; ')}`);
            // 这里我们仍旧切换状态，但是affectedComments为0，表示实际替换数量为0
            console.log(`[ToggleManager] 范围验证失败，仍然更新状态但影响数为0`);
            await this.updateDocumentState(documentUri, TruthToggleState.LIE, hasLies); // 保持hasLies为true
            return {
                success: false,
                newState: TruthToggleState.LIE,
                affectedComments: 0,
                errorMessage: `应用撒谎时范围验证失败: ${validation.errors.join('; ')}`
            };
        }

        console.log(`[ToggleManager] 范围验证通过，开始排序编辑操作`);
        // 按位置倒序排序，避免位置偏移问题
        editOperations.sort((a, b) => {
            if (a.range.start.line !== b.range.start.line) {
                return b.range.start.line - a.range.start.line;
            }
            return b.range.start.character - a.range.start.character;
        });
        console.log(`[ToggleManager] 编辑操作排序完成`);

        // 一次性执行所有编辑操作
        if (editOperations.length > 0) {
            try {
                console.log(`[ToggleManager] 开始执行编辑操作`);
                const editSuccess = await editor.edit(editBuilder => {
                    editOperations.forEach(operation => {
                        console.log(`[DEBUG] 应用编辑: ${operation.recordId} at ${operation.range.start.line}:${operation.range.start.character}`);
                        editBuilder.replace(operation.range, operation.newText);
                        affectedComments++; // 只有成功添加到 editBuilder 的才算影响
                    });
                });

                if (!editSuccess) {
                    console.error(`[DEBUG] 编辑操作失败`);
                    vscode.window.showErrorMessage('编辑操作执行失败');
                    return {
                        success: false,
                        newState: TruthToggleState.TRUTH,
                        affectedComments: 0,
                        errorMessage: '编辑操作执行失败'
                    };
                }

                console.log(`[DEBUG] 成功应用 ${affectedComments} 个编辑操作`);
            } catch (error: any) {
                console.error(`[DEBUG] 编辑操作异常:`, error);
                vscode.window.showErrorMessage(`编辑操作异常: ${error.message || error}`);
                return {
                    success: false,
                    newState: TruthToggleState.TRUTH,
                    affectedComments: 0,
                    errorMessage: `编辑操作异常: ${error.message || error}`
                };
            }
        } console.log(`[ToggleManager] 更新文档状态为假话模式`);
        // 更新状态
        await this.updateDocumentState(documentUri, TruthToggleState.LIE, true);

        console.log(`[ToggleManager] switchToLies 完成，影响 ${affectedComments} 个注释`);
        return {
            success: true,
            newState: TruthToggleState.LIE,
            affectedComments: affectedComments,
        };
    }    /**
     * 切换到真话状态
     */
    private async switchToTruth(editor: vscode.TextEditor, documentUri: string): Promise<ToggleResult> {
        console.log(`[ToggleManager] switchToTruth 开始: ${documentUri}`);
        // 临时恢复所有撒谎记录（不删除历史记录，以便可以重复切换）
        // historyManager.temporaryRestoreAllForFile 应该执行实际的文本替换操作
        console.log(`[ToggleManager] 调用历史管理器恢复所有记录`);
        const restoreResult = await this.historyManager.temporaryRestoreAllForFile(documentUri);
        console.log(`[ToggleManager] 恢复结果:`, restoreResult);

        if (!restoreResult.success) {
            console.log(`[ToggleManager] 恢复失败: ${restoreResult.errorMessage}`);
            return {
                success: false,
                newState: TruthToggleState.LIE,
                affectedComments: 0,
                errorMessage: restoreResult.errorMessage
            };
        } console.log(`[ToggleManager] 更新文档状态为真话模式`);
        // 更新状态
        await this.updateDocumentState(documentUri, TruthToggleState.TRUTH, true); // 保持 hasLies 为 true，因为记录仍然存在

        console.log(`[ToggleManager] switchToTruth 完成，恢复 ${restoreResult.restoredCount} 个注释`);
        return {
            success: true,
            newState: TruthToggleState.TRUTH,
            affectedComments: restoreResult.restoredCount, // 使用 historyManager 返回的实际恢复数量
        };
    }    /**
     * 更新文档状态
     */
    private async updateDocumentState(documentUri: string, newState: TruthToggleState, hasLies: boolean): Promise<void> {
        console.log(`[ToggleManager] 更新文档状态: ${documentUri}, 状态: ${newState}, 有撒谎: ${hasLies}`);
        this.documentStates.set(documentUri, {
            currentState: newState,
            lastToggleTime: Date.now(),
            documentUri: documentUri,
            hasLies: hasLies
        });

        console.log(`[ToggleManager] 同步状态到 globalstate`);
        // 同步状态到 globalstate
        try {
            const filePath = documentUri.startsWith('file://') ? vscode.Uri.parse(documentUri).fsPath : documentUri;
            await this.saveFileStateToGlobalState(filePath, newState);
            console.log(`[ToggleManager] 已同步状态到 globalstate: ${filePath} -> ${newState}`);
        } catch (error) {
            console.error(`[ToggleManager] 同步状态到 globalstate 失败:`, error);
        }

        // 更新状态栏
        console.log(`[ToggleManager] 更新状态栏显示`);
        this.updateStatusBar();
    }    /**
     * 获取状态显示文本
     */
    public getStateDisplayText(documentUri: string): string {
        console.log(`[ToggleManager] 获取状态显示文本: ${documentUri}`);
        const state = this.getCurrentState(documentUri);
        const stateInfo = this.getStateInfo(documentUri);

        const stateText = state === TruthToggleState.TRUTH ? '真话模式' : '假话模式';
        const icon = state === TruthToggleState.TRUTH ? '✅' : '🤥';

        let displayText;
        if (stateInfo?.hasLies) {
            displayText = `${icon} ${stateText}`;
        } else {
            displayText = `${icon} ${stateText} (未撒谎)`;
        }

        console.log(`[ToggleManager] 状态显示文本生成: ${displayText}`);
        return displayText;
    }/**
     * 清理文档状态（文档关闭时调用）
     */
    public cleanupDocumentState(documentUri: string): void {
        console.log(`[ToggleManager] 清理文档状态: ${documentUri}`);
        this.documentStates.delete(documentUri);
    }

    /**
     * 获取所有文档状态
     */
    public getAllStates(): Map<string, ToggleStateInfo> {
        return new Map(this.documentStates);
    }    /**
     * 显示当前状态信息
     */
    public async showCurrentStatus(): Promise<void> {
        console.log(`[ToggleManager] 显示当前状态信息`);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log(`[ToggleManager] 没有活动编辑器`);
            vscode.window.showErrorMessage('没有活动的编辑器');
            return;
        }

        const documentUri = editor.document.uri.toString();
        console.log(`[ToggleManager] 获取文档状态: ${documentUri}`);
        const stateInfo = this.getStateInfo(documentUri);
        const displayText = this.getStateDisplayText(documentUri);
        console.log(`[ToggleManager] 状态显示文本: ${displayText}`);

        if (stateInfo) {
            const lastToggleTime = new Date(stateInfo.lastToggleTime).toLocaleString();
            console.log(`[ToggleManager] 上次切换时间: ${lastToggleTime}`);
            vscode.window.showInformationMessage(
                `当前状态: ${displayText}\n上次切换: ${lastToggleTime}`
            );
        } else {
            console.log(`[ToggleManager] 没有找到状态信息`);
            vscode.window.showInformationMessage(`当前状态: ${displayText}`);
        }
    }    /**
     * 更新状态栏显示
     */
    private updateStatusBar(): void {
        console.log(`[ToggleManager] 更新状态栏显示`);
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            console.log(`[ToggleManager] 没有活动编辑器，隐藏状态栏`);
            this.statusBarItem.hide();
            return;
        }

        const documentUri = editor.document.uri.toString();
        const displayText = this.getStateDisplayText(documentUri);
        console.log(`[ToggleManager] 状态栏文本: ${displayText}`);
        this.statusBarItem.text = displayText;
        this.statusBarItem.show();
    }    /**
     * 销毁资源
     */
    public dispose(): void {
        console.log(`[ToggleManager] 销毁资源`);
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
            console.log(`[ToggleManager] 状态栏项已销毁`);
        }
    }    /**
     * 验证编辑范围是否有效且不重叠
     */
    private validateEditRanges(ranges: vscode.Range[], document: vscode.TextDocument): { valid: boolean; errors: string[] } {
        console.log(`[ToggleManager] 验证编辑范围，共 ${ranges.length} 个范围`);
        const errors: string[] = [];
        const sortedRanges = [...ranges].sort((a, b) => {
            if (a.start.line !== b.start.line) {
                return a.start.line - b.start.line;
            }
            return a.start.character - b.start.character;
        });
        console.log(`[ToggleManager] 范围排序完成`);

        for (let i = 0; i < sortedRanges.length; i++) {
            const range = sortedRanges[i];
            console.log(`[ToggleManager] 验证范围 ${i}: [${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}]`);

            // 检查范围是否在文档内
            if (range.start.line < 0 || range.end.line >= document.lineCount) {
                const error = `范围 ${i} 超出文档边界: ${range.start.line}-${range.end.line}, 文档行数: ${document.lineCount}`;
                console.error(`[ToggleManager] ${error}`);
                errors.push(error);
                continue;
            }

            // 检查起始位置是否有效
            if (range.start.character < 0 || range.end.character < 0) {
                const error = `范围 ${i} 字符位置无效: ${range.start.character}-${range.end.character}`;
                console.error(`[ToggleManager] ${error}`);
                errors.push(error);
                continue;
            }

            // 检查范围是否有效（起始位置不能在结束位置之后）
            if (range.start.isAfter(range.end)) {
                const error = `范围 ${i} 起始位置在结束位置之后: ${range.start.line}:${range.start.character} > ${range.end.line}:${range.end.character}`;
                console.error(`[ToggleManager] ${error}`);
                errors.push(error);
                continue;
            }

            // 检查与后续范围是否重叠
            if (i + 1 < sortedRanges.length) {
                const nextRange = sortedRanges[i + 1];
                if (range.intersection(nextRange) !== undefined) {
                    const error = `范围 ${i} 与范围 ${i + 1} 重叠: [${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}] vs [${nextRange.start.line}:${nextRange.start.character}-${nextRange.end.line}:${nextRange.end.character}]`;
                    console.error(`[ToggleManager] ${error}`);
                    errors.push(error);
                }
            }
        }

        const result = {
            valid: errors.length === 0,
            errors: errors
        };
        console.log(`[ToggleManager] 范围验证结果: ${result.valid ? '通过' : '失败'}, 错误数量: ${errors.length}`);
        return result;
    }    /**
     * 当用户进行撒谎操作后通知状态变化
     * 这个方法应该在任何替换操作完成后被调用
     */
    public async notifyLiesAdded(documentUri: string): Promise<void> {
        console.log(`[DEBUG] 通知撒谎操作完成: ${documentUri}`);

        // 更新文档状态，标记为已有撒谎记录且当前显示假话
        await this.updateDocumentState(documentUri, TruthToggleState.LIE, true);

        // 更新状态栏显示
        this.updateStatusBar();

        console.log(`[DEBUG] 状态已更新: 假话模式, 已有撒谎记录`);
    }/**
     * 初始化文档状态
     * 在打开文档时检查是否已有撒谎记录
     */
    public async initializeDocumentState(documentUri: string): Promise<void> {
        console.log(`[ToggleManager] 初始化文档状态开始: ${documentUri}`);

        if (this.documentStates.has(documentUri)) {
            console.log(`[DEBUG] 文档状态已存在: ${documentUri}`);
            // 已有状态，重新检查撒谎记录状态以确保同步
            const hasLies = await this.hasLiesInDocument(documentUri);
            const currentState = this.documentStates.get(documentUri);

            console.log(`[ToggleManager] 检查状态同步: 当前hasLies=${currentState?.hasLies}, 实际hasLies=${hasLies}`);
            if (currentState && currentState.hasLies !== hasLies) {
                console.log(`[DEBUG] 更新撒谎记录状态: ${currentState.hasLies} -> ${hasLies}`);
                await this.updateDocumentState(documentUri, currentState.currentState, hasLies);
            }
            return;
        }

        console.log(`[DEBUG] 初始化文档状态: ${documentUri}`);

        // 检查是否有历史撒谎记录
        const hasLies = await this.hasLiesInDocument(documentUri);
        console.log(`[ToggleManager] 检查历史撒谎记录结果: ${hasLies}`);

        // 设置初始状态 - 总是以真话模式开始
        console.log(`[ToggleManager] 设置初始状态为真话模式`);
        await this.updateDocumentState(documentUri, TruthToggleState.TRUTH, hasLies);

        console.log(`[DEBUG] 文档初始状态: 真话模式, 有撒谎记录: ${hasLies}`);
    }    /**
     * 强制刷新文档状态
     * 当文档内容发生变化时调用，重新检查撒谎记录
     */
    public async refreshDocumentState(documentUri: string): Promise<void> {
        console.log(`[DEBUG] 刷新文档状态: ${documentUri}`);

        console.log(`[ToggleManager] 重新检查撒谎记录`);
        const hasLies = await this.hasLiesInDocument(documentUri);
        const currentStateInfo = this.documentStates.get(documentUri);

        console.log(`[ToggleManager] 当前状态信息:`, currentStateInfo);
        console.log(`[ToggleManager] 重新检查的撒谎记录状态: ${hasLies}`);

        if (currentStateInfo) {
            // 保持当前的显示状态，但更新撒谎记录状态
            console.log(`[ToggleManager] 保持当前显示状态: ${currentStateInfo.currentState}, 更新撒谎记录状态: ${hasLies}`);
            await this.updateDocumentState(documentUri, currentStateInfo.currentState, hasLies);
        } else {
            // 如果没有状态，初始化为真话模式
            console.log(`[ToggleManager] 没有当前状态，初始化为真话模式`);
            await this.updateDocumentState(documentUri, TruthToggleState.TRUTH, hasLies);
        }

        console.log(`[DEBUG] 状态已刷新: 有撒谎记录: ${hasLies}`);
    }    /**
     * 初始化 ToggleManager
     */
    public initialize(context: vscode.ExtensionContext): void {
        console.log(`[ToggleManager] 初始化 ToggleManager`);
        this.extensionContext = context;
        console.log(`[ToggleManager] ExtensionContext 已设置`);
    }    /**
     * 从 globalstate 获取文件状态
     */
    private getFileStateFromGlobalState(filePath: string): TruthToggleState {
        console.log(`[ToggleManager] 从 globalstate 获取文件状态: ${filePath}`);
        if (!this.extensionContext) {
            console.log(`[ToggleManager] ExtensionContext 未初始化，返回默认状态`);
            return TruthToggleState.TRUTH;
        }

        const stateKey = `fileState_${this.getRelativePath(filePath)}`;
        const state = this.extensionContext.globalState.get(stateKey, TruthToggleState.TRUTH);
        console.log(`[ToggleManager] GlobalState 获取状态: ${stateKey} -> ${state}`);
        return state;
    }    /**
     * 保存文件状态到 globalstate
     */
    private async saveFileStateToGlobalState(filePath: string, state: TruthToggleState): Promise<void> {
        console.log(`[ToggleManager] 保存文件状态到 globalstate: ${filePath} -> ${state}`);
        if (!this.extensionContext) {
            console.log(`[ToggleManager] ExtensionContext 未初始化，无法保存状态`);
            return;
        }

        const stateKey = `fileState_${this.getRelativePath(filePath)}`;
        console.log(`[ToggleManager] GlobalState 保存状态: ${stateKey} -> ${state}`);
        await this.extensionContext.globalState.update(stateKey, state);
        console.log(`[ToggleManager] GlobalState 状态保存完成`);
    }    /**
     * 检查文件是否有撒谎记录（通过历史记录）
     */
    private hasLiesInFile(filePath: string): boolean {
        console.log(`[ToggleManager] 检查文件是否有撒谎记录: ${filePath}`);
        const documentUri = filePath.startsWith('file://') ? filePath : vscode.Uri.file(filePath).toString();
        const records = this.historyManager.getRecordsForFile(documentUri);
        const hasLies = records.length > 0;
        console.log(`[ToggleManager] 文件撒谎记录检查结果: ${hasLies}, 记录数量: ${records.length}`);
        return hasLies;
    }    /**
     * 获取文件的相对路径
     */
    private getRelativePath(absolutePath: string): string {
        console.log(`[ToggleManager] 获取相对路径: ${absolutePath}`);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log(`[ToggleManager] 没有工作区文件夹，返回绝对路径`);
            return absolutePath;
        }

        const path = require('path');
        const relativePath = path.relative(workspaceFolder.uri.fsPath, absolutePath);
        console.log(`[ToggleManager] 相对路径: ${relativePath}`);
        return relativePath;
    }
}