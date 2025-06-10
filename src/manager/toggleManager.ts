import * as vscode from 'vscode';
import { TruthToggleState, ToggleStateInfo, ToggleResult, HistoryRecord } from '../types';
import { HistoryManager } from './historyManager';

// 创建输出通道用于调试日志
const outputChannel = vscode.window.createOutputChannel('I Love Lie - Toggle Manager');

/**
 * 切换逻辑的最小实现。
 */
export class ToggleManager {
  private history: HistoryManager;
  private states: Map<string, ToggleStateInfo> = new Map();
  private bar: vscode.StatusBarItem;
  /** 将历史记录应用到快照并返回假话文本 */
  private applyRecords(snapshot: string, records: HistoryRecord[]): string {
    const lineOffsets: number[] = [];
    let offset = 0;
    const lines = snapshot.split(/\n/);
    for (const line of lines) {
      lineOffsets.push(offset);
      offset += line.length + 1;
    }

    const sorted = records
      .filter(r => !r.fileSnapshot)
      .sort((a, b) => {
        const sa = lineOffsets[a.startPosition.line] + a.startPosition.character;
        const sb = lineOffsets[b.startPosition.line] + b.startPosition.character;
        return sa - sb;
      });

    let result = '';
    let last = 0;
    for (const rec of sorted) {
      const start = lineOffsets[rec.startPosition.line] + rec.startPosition.character;
      const end = lineOffsets[rec.endPosition.line] + rec.endPosition.character;
      result += snapshot.slice(last, start);
      result += rec.newText;
      last = end;
    }
    result += snapshot.slice(last);
    return result;
  } constructor(history: HistoryManager) {
    outputChannel.appendLine(`[ToggleManager] 初始化开始`);
    this.history = history;
    this.bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.bar.command = 'ilovelie.toggleTruthState';
    this.bar.tooltip = '点击切换真话/假话模式';
    // 初始显示状态栏
    this.updateStatusBar();
    outputChannel.appendLine(`[ToggleManager] 初始化完成`);
  }
  public initialize(context: vscode.ExtensionContext): void {
    outputChannel.appendLine(`[ToggleManager] 注册编辑器事件监听`);
    // 注册编辑器切换事件，确保状态栏始终显示正确的状态
    const onDidChangeActiveEditor = vscode.window.onDidChangeActiveTextEditor(() => {
      outputChannel.appendLine(`[ToggleManager] 编辑器切换，更新状态栏`);
      this.updateStatusBar();
    });

    context.subscriptions.push(onDidChangeActiveEditor);

    // 如果当前有活动编辑器，立即更新状态栏
    if (vscode.window.activeTextEditor) {
      outputChannel.appendLine(`[ToggleManager] 发现活动编辑器，立即更新状态栏`);
      this.updateStatusBar();
    }
  }  /** 切换当前文档状态。 */
  public async toggleTruthState(): Promise<ToggleResult> {
    outputChannel.appendLine(`[ToggleManager] 开始切换真话/假话状态`);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      outputChannel.appendLine(`[ToggleManager] 错误：没有活动的编辑器`);
      return { success: false, newState: TruthToggleState.TRUTH, affectedComments: 0, errorMessage: '没有活动的编辑器' };
    }
    const filePath = editor.document.uri.fsPath;
    outputChannel.appendLine(`[ToggleManager] 当前文件: ${filePath}`);

    const info = this.states.get(filePath);
    const currentState = info?.currentState || TruthToggleState.TRUTH;
    const newState = currentState === TruthToggleState.LIE ? TruthToggleState.TRUTH : TruthToggleState.LIE;
    outputChannel.appendLine(`[ToggleManager] 状态切换: ${currentState} -> ${newState}`);

    const records = this.history.getRecordsForFile(filePath);
    outputChannel.appendLine(`[ToggleManager] 找到 ${records.length} 条历史记录`);

    const snapshotRecord = records
      .filter(r => r.fileSnapshot)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const snapshot = snapshotRecord?.fileSnapshot;
    let affected = 0; if (snapshot) {
      outputChannel.appendLine(`[ToggleManager] 使用快照恢复模式，快照长度: ${snapshot.length}`);
      const targetText = newState === TruthToggleState.LIE
        ? this.applyRecords(snapshot, records)
        : snapshot;
      outputChannel.appendLine(`[ToggleManager] 目标文本长度: ${targetText.length}`);

      const success = await editor.edit(builder => {
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          editor.document.lineAt(editor.document.lineCount - 1).range.end
        );
        builder.replace(fullRange, targetText);
      });
      if (success) {
        affected = records.filter(r => !r.fileSnapshot).length;
        outputChannel.appendLine(`[ToggleManager] 快照恢复成功，影响 ${affected} 条记录`);
      } else {
        outputChannel.appendLine(`[ToggleManager] 快照恢复失败`);
      }
    } else if (records.length > 0) {
      outputChannel.appendLine(`[ToggleManager] 使用记录逐一恢复模式，共 ${records.length} 条记录`);
      await editor.edit(builder => {
        for (const rec of records) {
          const range = new vscode.Range(
            rec.startPosition.line,
            rec.startPosition.character,
            rec.endPosition.line,
            rec.endPosition.character
          );
          const targetText = newState === TruthToggleState.LIE ? rec.newText : rec.originalText;
          const currentText = editor.document.getText(range);
          if (currentText !== targetText) {
            outputChannel.appendLine(`[ToggleManager] 替换位置 ${rec.startPosition.line}:${rec.startPosition.character} "${currentText}" -> "${targetText}"`);
            builder.replace(range, targetText);
            affected++;
          }
        }
      });
      outputChannel.appendLine(`[ToggleManager] 记录恢复完成，实际影响 ${affected} 条记录`);
    } else {
      outputChannel.appendLine(`[ToggleManager] 没有找到历史记录，无需恢复`);
    } this.states.set(filePath, {
      currentState: newState,
      lastToggleTime: Date.now(),
      documentUri: filePath,
      hasLies: records.length > 0,
    });
    this.updateStatusBar();
    outputChannel.appendLine(`[ToggleManager] 状态切换完成: ${newState}, 影响 ${affected} 个位置`);
    return { success: true, newState, affectedComments: affected };
  }  /** 当文件有新的假话记录添加时调用。 */
  public async notifyLiesAdded(filePath: string): Promise<void> {
    outputChannel.appendLine(`[ToggleManager] 通知文件新增假话记录: ${filePath}`);
    const state = this.states.get(filePath) || {
      currentState: TruthToggleState.LIE,
      lastToggleTime: Date.now(),
      documentUri: filePath,
      hasLies: true,
    };
    state.hasLies = true;
    state.currentState = TruthToggleState.LIE;
    state.lastToggleTime = Date.now();
    this.states.set(filePath, state);
    this.updateStatusBar();
    outputChannel.appendLine(`[ToggleManager] 文件状态已更新为假话模式`);
  }  /** 文档关闭时清理。 */
  public cleanupDocumentState(filePath: string): void {
    outputChannel.appendLine(`[ToggleManager] 清理文档状态: ${filePath}`);
    this.states.delete(filePath);
  }  /** 刷新文档的状态信息，例如清除历史记录后。 */
  public async refreshDocumentState(filePath: string): Promise<void> {
    outputChannel.appendLine(`[ToggleManager] 刷新文档状态: ${filePath}`);
    const records = this.history.getRecordsForFile(filePath);
    outputChannel.appendLine(`[ToggleManager] 找到 ${records.length} 条历史记录`);

    const state = this.states.get(filePath) || {
      currentState: TruthToggleState.TRUTH,
      lastToggleTime: Date.now(),
      documentUri: filePath,
      hasLies: false,
    };
    state.hasLies = records.length > 0;
    if (!state.hasLies) {
      state.currentState = TruthToggleState.TRUTH;
      outputChannel.appendLine(`[ToggleManager] 无历史记录，重置为真话模式`);
    }
    state.lastToggleTime = Date.now();
    this.states.set(filePath, state);
    this.updateStatusBar();
  }
  /** 在信息消息中显示当前状态。 */
  public async showCurrentStatus(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有活动的编辑器');
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const info = this.states.get(filePath);
    const state = info?.currentState || TruthToggleState.TRUTH;
    const text = state === TruthToggleState.TRUTH ? '真话模式' : '假话模式';
    vscode.window.showInformationMessage(`当前状态: ${text}`);
  } private updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      // 即使没有活动编辑器，也显示默认的真话模式状态
      this.bar.text = '$(eye) 真话';
      this.bar.show();
      outputChannel.appendLine(`[ToggleManager] 状态栏更新: 无活动编辑器，显示默认真话模式`);
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const info = this.states.get(filePath);
    const state = info?.currentState || TruthToggleState.TRUTH;
    this.bar.text = state === TruthToggleState.TRUTH ? '$(eye) 真话' : '$(eye-closed) 假话';
    this.bar.show();
    outputChannel.appendLine(`[ToggleManager] 状态栏更新: ${filePath} -> ${state}`);
  } public dispose(): void {
    outputChannel.appendLine(`[ToggleManager] 释放资源`);
    this.bar.dispose();
    outputChannel.dispose();
  }
}
