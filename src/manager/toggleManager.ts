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
  private findBestMatchOffsets(text: string, needle: string, nearOffset: number): { start: number; end: number } | null {
    if (!needle) {
      return null;
    }

    let index = text.indexOf(needle);
    if (index === -1) {
      return null;
    }

    let bestIndex = index;
    let bestDistance = Math.abs(index - nearOffset);
    while (index !== -1) {
      const distance = Math.abs(index - nearOffset);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
      index = text.indexOf(needle, index + needle.length);
    }

    return { start: bestIndex, end: bestIndex + needle.length };
  }
  private collectRecordReplacements(
    editor: vscode.TextEditor,
    records: HistoryRecord[],
    direction: 'toTruth' | 'toLie'
  ): Array<{ range: vscode.Range; text: string }> {
    const replacements: Array<{ range: vscode.Range; text: string }> = [];
    const fullText = editor.document.getText();

    for (const rec of records) {
      if (rec.fileSnapshot) {
        continue;
      }

      const fromText = direction === 'toTruth' ? rec.newText : rec.originalText;
      const toText = direction === 'toTruth' ? rec.originalText : rec.newText;
      if (!fromText) {
        continue;
      }

      const range = new vscode.Range(
        rec.startPosition.line,
        rec.startPosition.character,
        rec.endPosition.line,
        rec.endPosition.character
      );
      const currentRangeText = editor.document.getText(range);
      if (currentRangeText === fromText) {
        replacements.push({ range, text: toText });
        continue;
      }

      const nearOffset = editor.document.offsetAt(range.start);
      const match = this.findBestMatchOffsets(fullText, fromText, nearOffset);
      if (match) {
        const matchRange = new vscode.Range(
          editor.document.positionAt(match.start),
          editor.document.positionAt(match.end)
        );
        replacements.push({ range: matchRange, text: toText });
      }
    }

    return replacements;
  }
  private getSessionRecords(allRecords: HistoryRecord[]): { records: HistoryRecord[]; snapshot?: string } {
    const snapshotRecord = allRecords
      .filter(r => r.fileSnapshot)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const sessionId = snapshotRecord?.sessionId || allRecords
      .filter(r => r.sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)[0]?.sessionId;
    const sessionStartTime = snapshotRecord?.timestamp;
    const records = sessionId
      ? allRecords.filter(r =>
          r.sessionId === sessionId ||
          (!r.sessionId && sessionStartTime !== undefined && r.timestamp >= sessionStartTime)
        )
      : allRecords;
    return { records, snapshot: snapshotRecord?.fileSnapshot };
  }
  private inferCurrentState(
    editor: vscode.TextEditor,
    records: HistoryRecord[],
    snapshot?: string
  ): TruthToggleState {
    if (records.length === 0) {
      return TruthToggleState.NONE;
    }

    const currentText = editor.document.getText();
    if (snapshot) {
      const lieText = this.applyRecords(snapshot, records);
      if (currentText === lieText) {
        return TruthToggleState.LIE;
      }
      if (currentText === snapshot) {
        return TruthToggleState.TRUTH;
      }
    }

    const latestRecord = records
      .filter(r => !r.fileSnapshot)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!latestRecord) {
      return TruthToggleState.NONE;
    }

    const range = new vscode.Range(
      latestRecord.startPosition.line,
      latestRecord.startPosition.character,
      latestRecord.endPosition.line,
      latestRecord.endPosition.character
    );
    const currentRangeText = editor.document.getText(range);
    if (currentRangeText === latestRecord.newText) {
      return TruthToggleState.LIE;
    }
    if (currentRangeText === latestRecord.originalText) {
      return TruthToggleState.TRUTH;
    }

    return TruthToggleState.TRUTH;
  }
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
    const allRecords = this.history.getRecordsForFile(filePath);
    outputChannel.appendLine(`[ToggleManager] 找到 ${allRecords.length} 条历史记录`);

    const { records, snapshot } = this.getSessionRecords(allRecords);
    const inferredState = this.inferCurrentState(editor, records, snapshot);
    const currentState = info?.currentState && info.currentState === inferredState
      ? info.currentState
      : inferredState;
    if (records.length === 0) {
      outputChannel.appendLine(`[ToggleManager] 没有历史记录，跳过切换`);
      this.states.set(filePath, {
        currentState: TruthToggleState.NONE,
        lastToggleTime: Date.now(),
        documentUri: filePath,
        hasLies: false,
      });
      this.updateStatusBar();
      return { success: false, newState: TruthToggleState.NONE, affectedComments: 0, errorMessage: '没有假注释' };
    }

    const newState = currentState === TruthToggleState.LIE ? TruthToggleState.TRUTH : TruthToggleState.LIE;
    outputChannel.appendLine(`[ToggleManager] 状态切换: ${currentState} -> ${newState}`);
    let affected = 0;
    if (snapshot) {
      outputChannel.appendLine(`[ToggleManager] 使用快照恢复模式，快照长度: ${snapshot.length}`);
      const expectedLieText = this.applyRecords(snapshot, records);
      const targetText = newState === TruthToggleState.LIE ? expectedLieText : snapshot;
      outputChannel.appendLine(`[ToggleManager] 目标文本长度: ${targetText.length}`);

      const currentText = editor.document.getText();
      const shouldUseFullReplace = newState === TruthToggleState.LIE
        ? currentText === snapshot
        : currentText === expectedLieText;

      if (currentText === targetText) {
        outputChannel.appendLine(`[ToggleManager] 当前文档已处于目标状态，跳过替换`);
      } else if (shouldUseFullReplace) {
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
      } else {
        outputChannel.appendLine(`[ToggleManager] 当前内容有改动，使用安全替换模式`);
        const replacements = this.collectRecordReplacements(
          editor,
          records,
          newState === TruthToggleState.LIE ? 'toLie' : 'toTruth'
        );
        const success = await editor.edit(builder => {
          const sorted = replacements.sort((a, b) =>
            editor.document.offsetAt(b.range.start) - editor.document.offsetAt(a.range.start)
          );
          for (const replacement of sorted) {
            builder.replace(replacement.range, replacement.text);
          }
        });
        affected = success ? replacements.length : 0;
        outputChannel.appendLine(`[ToggleManager] 安全替换完成，实际影响 ${affected} 条记录`);
      }
    } else if (records.length > 0) {
      outputChannel.appendLine(`[ToggleManager] 使用记录逐一恢复模式，共 ${records.length} 条记录`);
      const replacements = this.collectRecordReplacements(
        editor,
        records,
        newState === TruthToggleState.LIE ? 'toLie' : 'toTruth'
      );
      await editor.edit(builder => {
        const sorted = replacements.sort((a, b) =>
          editor.document.offsetAt(b.range.start) - editor.document.offsetAt(a.range.start)
        );
        for (const replacement of sorted) {
          builder.replace(replacement.range, replacement.text);
        }
      });
      affected = replacements.length;
      outputChannel.appendLine(`[ToggleManager] 记录恢复完成，实际影响 ${affected} 条记录`);
    } else {
      outputChannel.appendLine(`[ToggleManager] 没有找到历史记录，无需恢复`);
    }
    this.states.set(filePath, {
      currentState: records.length === 0 ? TruthToggleState.NONE : newState,
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
      state.currentState = TruthToggleState.NONE;
      outputChannel.appendLine(`[ToggleManager] 无历史记录，重置为无假话状态`);
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
    const allRecords = this.history.getRecordsForFile(filePath);
    const { records, snapshot } = this.getSessionRecords(allRecords);
    const inferredState = this.inferCurrentState(editor, records, snapshot);
    const state = info?.currentState && info.currentState === inferredState
      ? info.currentState
      : inferredState;
    const text = state === TruthToggleState.TRUTH ? '真话模式' : state === TruthToggleState.LIE ? '假话模式' : '没有假话';
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
    const allRecords = this.history.getRecordsForFile(filePath);
    const { records, snapshot } = this.getSessionRecords(allRecords);
    const inferredState = this.inferCurrentState(editor, records, snapshot);
    const state = info?.currentState && info.currentState === inferredState
      ? info.currentState
      : inferredState;
    if (!info || info.currentState !== state) {
      this.states.set(filePath, {
        currentState: state,
        lastToggleTime: Date.now(),
        documentUri: filePath,
        hasLies: records.length > 0,
      });
    }
    this.bar.text = state === TruthToggleState.TRUTH
      ? '$(eye) 真话'
      : state === TruthToggleState.LIE
        ? '$(eye-closed) 假话'
        : '$(circle-slash) 无假话';
    this.bar.show();
    outputChannel.appendLine(`[ToggleManager] 状态栏更新: ${filePath} -> ${state}`);
  } public dispose(): void {
    outputChannel.appendLine(`[ToggleManager] 释放资源`);
    this.bar.dispose();
    outputChannel.dispose();
  }
}
