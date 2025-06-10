/**
 * 真话假话切换管理器
 * 负责管理文档的真话假话状态切换
 */
import * as vscode from 'vscode';
import { TruthToggleState, ToggleStateInfo, ToggleResult, ScannedComment } from '../types';
import { HistoryManager } from './historyManager';
import { CommentScanner } from '../comment/commentScanner';
import { normalizeComment } from '../comment/commentUtils';

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
                this.updateStatusBar(); // 更新状态栏                console.log(`[DEBUG] 切换到真话结果:`, result);
                if (result.success) {
                    if (result.affectedComments > 0) {
                        vscode.window.showInformationMessage(`✅ 已切换到真话模式 (恢复了 ${result.affectedComments} 个注释)`);
                    } else {
                        // 检查该文件是否原本就有历史记录
                        const recordsForFile = this.historyManager.getRecordsForFile(documentUri);

                        if (recordsForFile.length > 0) {
                            // 如果原本有记录，但一条都没恢复成功
                            vscode.window.showWarningMessage(`✅ 真话模式已激活，但未能恢复任何注释。可能是文档已被大幅修改或注释位置已变动。`);
                            console.warn(`[ToggleManager] 切换到真话，但 restoredCount 为 0，尽管历史记录存在 (${recordsForFile.length} 条记录)。`);
                        } else {
                            // 如果原本就没有记录
                            vscode.window.showInformationMessage(`✅ 已切换到真话模式 (文档中没有需要恢复的撒谎注释记录)`);
                        }
                    }
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
        } console.log(`[ToggleManager] 开始获取活跃历史记录并应用`);

        // 强制启动新会话并重新激活记录，确保从清晰的状态开始
        const filePath = vscode.Uri.parse(documentUri).fsPath;

        // 如果已有活跃会话，先结束它
        if (this.historyManager.hasActiveSession(filePath)) {
            console.log(`[DEBUG] 结束现有的活跃会话: ${filePath}`);
            this.historyManager.endLieSession(filePath);
        }

        // 启动新的撒谎会话
        console.log(`[DEBUG] 启动新的撒谎会话: ${filePath}`);
        const sessionId = this.historyManager.startLieSession(filePath);
        console.log(`[DEBUG] 新会话ID: ${sessionId}`);

        // 重新激活所有相关的历史记录
        this.historyManager.reactivateRecordsForFile(documentUri, sessionId);

        // 获取当前活跃会话的撒谎记录
        let records = await this.historyManager.getActiveRecordsForFile(documentUri);
        let affectedComments = 0;

        console.log(`[DEBUG] 从新会话中找到 ${records.length} 条活跃历史记录可用于切换到假话`);

        if (records.length === 0) {
            console.log(`[DEBUG] 没有找到可用的记录，无法切换到假话状态`);
            return {
                success: false,
                newState: TruthToggleState.TRUTH,
                affectedComments: 0,
                errorMessage: '没有找到可用的撒谎记录'
            };
        }

        console.log(`[ToggleManager] 开始收集编辑操作`);
        // 收集所有需要替换的编辑操作，处理范围唯一性
        const editOperations: Array<{ range: vscode.Range; newText: string; recordId: string }> = [];
        const processedRanges = new Set<string>(); // 用于跟踪已处理的范围，防止范围重叠
        const processedRecordIds = new Set<string>(); // 用于去重，防止重复处理同一记录
        const skippedRecords = {
            duplicateRecord: 0,
            duplicateRange: 0,
            alreadyLie: 0,
            textMismatch: 0,
            error: 0
        }; // 统计跳过的记录

        for (const record of records) {
            // 确保每个记录只被处理一次，以防 historyManager 返回重复记录
            if (processedRecordIds.has(record.id)) {
                console.log(`[DEBUG] 跳过重复记录: ${record.id}`);
                skippedRecords.duplicateRecord++;
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

                // 创建范围的唯一标识符
                const rangeKey = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;

                // 检查此范围是否已经被处理过
                if (processedRanges.has(rangeKey)) {
                    console.log(`[DEBUG] 跳过已处理的范围: ${rangeKey} (记录 ${record.id})`);
                    processedRecordIds.add(record.id);
                    skippedRecords.duplicateRange++;
                    continue;
                }                // 检查当前文档中该范围的文本
                const currentTextInDocument = editor.document.getText(range);
                console.log(`[ToggleManager] 记录 ${record.id} - 当前文本: "${currentTextInDocument}", 原始文本: "${record.originalText}", 新文本: "${record.newText}"`);

                const normalizedCurrent = normalizeComment(currentTextInDocument);
                const normalizedOriginal = normalizeComment(record.originalText);
                const normalizedNew = normalizeComment(record.newText);

                // 更精确的文本匹配：只有当前文本确实是原始文本（真话）时才应用假话替换
                if (normalizedCurrent === normalizedOriginal) {
                    // 当前文本是真话，应用假话替换
                    editOperations.push({ range, newText: record.newText, recordId: record.id });
                    processedRanges.add(rangeKey);
                    console.log(`[ToggleManager] 记录 ${record.id} 添加到编辑操作队列 (真话->假话)`);
                } else if (normalizedCurrent === normalizedNew) {
                    // 当前文本已经是假话，不需要编辑但标记范围为已处理
                    processedRanges.add(rangeKey);
                    console.log(`[ToggleManager] 记录 ${record.id} 当前已是假话，跳过编辑但标记范围已处理`);
                    skippedRecords.alreadyLie++;
                } else {
                    // 当前文本既不是原始文本也不是新文本，可能已被手动修改
                    console.warn(`[DEBUG] 记录 ${record.id} 的当前文本与原始/新文本不匹配，可能已被修改。跳过。`);
                    console.warn(`[DEBUG] 详细信息: 位置[${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}]`);
                    console.warn(`[DEBUG] 当前文本长度: ${currentTextInDocument.length}, 原始文本长度: ${record.originalText.length}, 新文本长度: ${record.newText.length}`);

                    // 尝试部分匹配检测（用于诊断）
                    const isPartialOriginalMatch = record.originalText.includes(currentTextInDocument) || currentTextInDocument.includes(record.originalText);
                    const isPartialNewMatch = record.newText.includes(currentTextInDocument) || currentTextInDocument.includes(record.newText);

                    if (isPartialOriginalMatch) {
                        console.warn(`[DEBUG] 检测到与原始文本的部分匹配，可能是范围边界问题`);
                    } else if (isPartialNewMatch) {
                        console.warn(`[DEBUG] 检测到与新文本的部分匹配，可能是范围边界问题`);
                    } else {
                        console.warn(`[DEBUG] 完全不匹配，可能是用户手动修改或文档结构变化`);
                    }
                    skippedRecords.textMismatch++;
                }

                processedRecordIds.add(record.id);

            } catch (error: any) {
                console.error(`[DEBUG] 准备撒谎记录失败 ${record.id}:`, error);
                skippedRecords.error++;
            }
        } console.log(`[DEBUG] 准备执行 ${editOperations.length} 个编辑操作`);

        // 验证所有范围
        console.log(`[ToggleManager] 开始验证编辑范围`);
        const rangesToValidate = editOperations.map(op => op.range);
        const validation = this.validateEditRanges(rangesToValidate, editor.document); if (!validation.valid) {
            console.error(`[DEBUG] 范围验证失败:`, validation.errors);
            vscode.window.showErrorMessage(`应用撒谎时范围验证失败: ${validation.errors.join('; ')}`);

            // 生成跳过记录的汇总报告（失败情况）
            const totalSkipped = skippedRecords.duplicateRecord + skippedRecords.duplicateRange +
                skippedRecords.alreadyLie + skippedRecords.textMismatch + skippedRecords.error;

            if (totalSkipped > 0) {
                console.log(`[ToggleManager] 跳过记录汇总统计（验证失败前）:`);
                console.log(`  - 重复记录ID: ${skippedRecords.duplicateRecord} 个`);
                console.log(`  - 重复范围: ${skippedRecords.duplicateRange} 个`);
                console.log(`  - 已为假话: ${skippedRecords.alreadyLie} 个`);
                console.log(`  - 文本不匹配: ${skippedRecords.textMismatch} 个`);
                console.log(`  - 处理错误: ${skippedRecords.error} 个`);
                console.log(`  - 总跳过数: ${totalSkipped} 个`);
            }

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
                }); if (!editSuccess) {
                    console.error(`[DEBUG] 编辑操作失败`);

                    // 生成跳过记录的汇总报告（编辑失败情况）
                    const totalSkipped = skippedRecords.duplicateRecord + skippedRecords.duplicateRange +
                        skippedRecords.alreadyLie + skippedRecords.textMismatch + skippedRecords.error;

                    if (totalSkipped > 0) {
                        console.log(`[ToggleManager] 跳过记录汇总统计（编辑失败前）:`);
                        console.log(`  - 重复记录ID: ${skippedRecords.duplicateRecord} 个`);
                        console.log(`  - 重复范围: ${skippedRecords.duplicateRange} 个`);
                        console.log(`  - 已为假话: ${skippedRecords.alreadyLie} 个`);
                        console.log(`  - 文本不匹配: ${skippedRecords.textMismatch} 个`);
                        console.log(`  - 处理错误: ${skippedRecords.error} 个`);
                        console.log(`  - 总跳过数: ${totalSkipped} 个`);
                    }

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

                // 生成跳过记录的汇总报告（编辑异常情况）
                const totalSkipped = skippedRecords.duplicateRecord + skippedRecords.duplicateRange +
                    skippedRecords.alreadyLie + skippedRecords.textMismatch + skippedRecords.error;

                if (totalSkipped > 0) {
                    console.log(`[ToggleManager] 跳过记录汇总统计（编辑异常前）:`);
                    console.log(`  - 重复记录ID: ${skippedRecords.duplicateRecord} 个`);
                    console.log(`  - 重复范围: ${skippedRecords.duplicateRange} 个`);
                    console.log(`  - 已为假话: ${skippedRecords.alreadyLie} 个`);
                    console.log(`  - 文本不匹配: ${skippedRecords.textMismatch} 个`);
                    console.log(`  - 处理错误: ${skippedRecords.error} 个`);
                    console.log(`  - 总跳过数: ${totalSkipped} 个`);
                }

                vscode.window.showErrorMessage(`编辑操作异常: ${error.message || error}`);
                return {
                    success: false,
                    newState: TruthToggleState.TRUTH,
                    affectedComments: 0,
                    errorMessage: `编辑操作异常: ${error.message || error}`
                };
            }
        }

        // 生成跳过记录的汇总报告
        const totalSkipped = skippedRecords.duplicateRecord + skippedRecords.duplicateRange +
            skippedRecords.alreadyLie + skippedRecords.textMismatch + skippedRecords.error;

        if (totalSkipped > 0) {
            console.log(`[ToggleManager] 跳过记录汇总统计:`);
            console.log(`  - 重复记录ID: ${skippedRecords.duplicateRecord} 个`);
            console.log(`  - 重复范围: ${skippedRecords.duplicateRange} 个`);
            console.log(`  - 已为假话: ${skippedRecords.alreadyLie} 个`);
            console.log(`  - 文本不匹配: ${skippedRecords.textMismatch} 个`);
            console.log(`  - 处理错误: ${skippedRecords.error} 个`);
            console.log(`  - 总跳过数: ${totalSkipped} 个`);

            // 如果有文本不匹配或错误，显示用户友好的提示
            if (skippedRecords.textMismatch > 0) {
                console.warn(`[ToggleManager] 警告: ${skippedRecords.textMismatch} 个记录因文本不匹配被跳过，可能是文档被手动修改过`);
            }
            if (skippedRecords.error > 0) {
                console.warn(`[ToggleManager] 警告: ${skippedRecords.error} 个记录处理时发生错误`);
            }
        }

        console.log(`[ToggleManager] 更新文档状态为假话模式`);
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
     */    private async switchToTruth(editor: vscode.TextEditor, documentUri: string): Promise<ToggleResult> {
        console.log(`[ToggleManager] switchToTruth 开始: ${documentUri}`);

        // 先检查是否有历史记录
        const recordsForFile = this.historyManager.getRecordsForFile(documentUri);
        console.log(`[ToggleManager] 文件历史记录总数: ${recordsForFile.length}`);

        // 先临时恢复所有撒谎记录（不删除历史记录，以便可以重复切换）
        // 在结束会话之前恢复，确保能找到活跃记录
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
        }

        // 在恢复成功后，结束当前活跃的撒谎会话
        const filePath = vscode.Uri.parse(documentUri).fsPath;
        if (this.historyManager.hasActiveSession(filePath)) {
            this.historyManager.endLieSession(filePath);
            console.log(`[ToggleManager] 已结束撒谎会话: ${filePath}`);
        }

        console.log(`[ToggleManager] 更新文档状态为真话模式`);
        // 更新状态
        await this.updateDocumentState(documentUri, TruthToggleState.TRUTH, true); // 保持 hasLies 为 true，因为记录仍然存在        // 如果恢复数量为0但原本有记录，添加额外的调试信息
        if (restoreResult.restoredCount === 0 && recordsForFile.length > 0) {
            console.warn(`[ToggleManager] 警告: 恢复了0个注释，但文件有${recordsForFile.length}条历史记录。可能的原因:`);
            console.warn(`  1. 文档内容已被大幅修改，导致历史记录中的位置信息失效`);
            console.warn(`  2. 注释文本已被手动修改，不再匹配历史记录中的"假话"文本`);
            console.warn(`  3. 历史记录中的行号超出了当前文档的实际行数`);
            console.warn(`  建议用户检查 HistoryManager 的恢复逻辑或重新进行撒谎操作`);

            // 执行详细诊断
            await this.diagnoseLowRestoreCount(documentUri);
        }

        console.log(`[ToggleManager] switchToTruth 完成，恢复 ${restoreResult.restoredCount} 个注释`);
        return {
            success: true,
            newState: TruthToggleState.TRUTH,
            affectedComments: restoreResult.restoredCount, // 使用 historyManager 返回的实际恢复数量
        };
    }/**
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

        // 开始新的撒谎会话
        const filePath = vscode.Uri.parse(documentUri).fsPath;
        if (!this.historyManager.hasActiveSession(filePath)) {
            this.historyManager.startLieSession(filePath);
            console.log(`[DEBUG] 为文件启动新的撒谎会话: ${filePath}`);
        }

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

        // 规范化文件路径为 URI 格式
        let documentUri: string;
        if (filePath.startsWith('file://')) {
            documentUri = filePath;
        } else {
            documentUri = vscode.Uri.file(filePath).toString();
        }

        console.log(`[ToggleManager] 标准化后的 documentUri: ${documentUri}`);

        // 同时检查两种格式的记录
        const recordsByUri = this.historyManager.getRecordsForFile(documentUri);
        const recordsByPath = this.historyManager.getRecordsForFile(filePath);

        // 合并并去重
        const allRecords = [...recordsByUri, ...recordsByPath];
        const uniqueRecords = allRecords.filter((record, index, array) =>
            array.findIndex(r => r.id === record.id) === index
        );

        const hasLies = uniqueRecords.length > 0;
        console.log(`[ToggleManager] 文件撒谎记录检查结果: ${hasLies}, URI记录数: ${recordsByUri.length}, 路径记录数: ${recordsByPath.length}, 总计: ${uniqueRecords.length}`);
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
    }    /**
     * 诊断当前文档的恢复问题
     * 可以作为命令暴露给用户
     */
    public async diagnoseCurrentDocument(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('没有活动的编辑器');
            return;
        }

        const documentUri = editor.document.uri.toString();
        console.log(`[ToggleManager] 用户触发诊断: ${documentUri}`);

        vscode.window.showInformationMessage('正在诊断恢复问题，请查看开发者控制台输出...');
        await this.diagnoseLowRestoreCount(documentUri);

        const records = this.historyManager.getRecordsForFile(documentUri);
        const activeRecords = this.historyManager.getActiveRecordsForFile(documentUri);

        vscode.window.showInformationMessage(
            `诊断完成！总记录: ${records.length}, 活跃记录: ${activeRecords.length}。详细信息请查看开发者控制台。`
        );
    }
    public async diagnoseLowRestoreCount(documentUri: string): Promise<void> {
        console.log(`[ToggleManager] 开始诊断恢复失败原因: ${documentUri}`);

        const records = this.historyManager.getRecordsForFile(documentUri);
        console.log(`[ToggleManager] 诊断 - 总历史记录: ${records.length}`);

        if (records.length === 0) {
            console.log(`[ToggleManager] 诊断结果: 没有历史记录`);
            return;
        }

        const activeRecords = this.historyManager.getActiveRecordsForFile(documentUri);
        console.log(`[ToggleManager] 诊断 - 活跃记录: ${activeRecords.length}`);

        try {
            const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(documentUri));
            console.log(`[ToggleManager] 诊断 - 文档总行数: ${document.lineCount}`);

            let outOfBoundsCount = 0;
            let textMismatchCount = 0;
            let validCount = 0;

            for (const record of activeRecords) {
                // 检查位置是否超出边界
                if (record.startPosition.line >= document.lineCount || record.endPosition.line >= document.lineCount) {
                    outOfBoundsCount++;
                    console.log(`[ToggleManager] 诊断 - 记录 ${record.id} 位置超出边界: 记录位置 ${record.startPosition.line}-${record.endPosition.line}, 文档行数 ${document.lineCount}`);
                    continue;
                }

                try {
                    const range = new vscode.Range(
                        record.startPosition.line,
                        record.startPosition.character,
                        record.endPosition.line,
                        record.endPosition.character
                    );

                    const currentText = document.getText(range);
                    const normalizedCurrent = normalizeComment(currentText);
                    const normalizedNew = normalizeComment(record.newText);

                    if (normalizedCurrent === normalizedNew) {
                        validCount++;
                        console.log(`[ToggleManager] 诊断 - 记录 ${record.id} 文本匹配，可以恢复`);
                    } else {
                        textMismatchCount++;
                        console.log(`[ToggleManager] 诊断 - 记录 ${record.id} 文本不匹配:`);
                        console.log(`  当前文本: "${currentText}"`);
                        console.log(`  期望文本: "${record.newText}"`);
                        console.log(`  原始文本: "${record.originalText}"`);
                    }
                } catch (error) {
                    console.error(`[ToggleManager] 诊断 - 记录 ${record.id} 处理异常:`, error);
                }
            }

            console.log(`[ToggleManager] 诊断结果汇总:`);
            console.log(`  - 总记录数: ${records.length}`);
            console.log(`  - 活跃记录数: ${activeRecords.length}`);
            console.log(`  - 位置超出边界: ${outOfBoundsCount}`);
            console.log(`  - 文本不匹配: ${textMismatchCount}`);
            console.log(`  - 可以恢复: ${validCount}`);

            // 提供修复建议
            if (outOfBoundsCount > 0) {
                console.warn(`[ToggleManager] 建议: ${outOfBoundsCount} 个记录的位置超出文档边界，可能需要改进 HistoryManager 的位置适应逻辑`);
            }
            if (textMismatchCount > 0) {
                console.warn(`[ToggleManager] 建议: ${textMismatchCount} 个记录的文本不匹配，可能需要添加模糊匹配逻辑`);
            }

        } catch (error) {
            console.error(`[ToggleManager] 诊断过程中发生异常:`, error);
        }
    }
}