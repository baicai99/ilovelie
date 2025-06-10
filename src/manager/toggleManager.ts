import * as vscode from 'vscode';
import { TruthToggleState, ToggleStateInfo, ToggleResult, HistoryRecord } from '../types';
import { HistoryManager } from './historyManager';

/**
 * Minimal implementation of toggle logic.
 */
export class ToggleManager {
  private history: HistoryManager;
  private states: Map<string, ToggleStateInfo> = new Map();
  private bar: vscode.StatusBarItem;

  /** Apply history records to a snapshot and return lied text */
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
  }

  constructor(history: HistoryManager) {
    this.history = history;
    this.bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.bar.command = 'ilovelie.toggleTruthState';
    this.bar.show();
  }

  public initialize(context: vscode.ExtensionContext): void {
    // nothing to load for now
  }

  /** Toggle current document state. */
  public async toggleTruthState(): Promise<ToggleResult> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { success: false, newState: TruthToggleState.TRUTH, affectedComments: 0, errorMessage: '没有活动的编辑器' };
    }
    const filePath = editor.document.uri.fsPath;
    const info = this.states.get(filePath);
    const newState = info?.currentState === TruthToggleState.LIE ? TruthToggleState.TRUTH : TruthToggleState.LIE;

    const records = this.history.getRecordsForFile(filePath);
    const snapshotRecord = records
      .filter(r => r.fileSnapshot)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    const snapshot = snapshotRecord?.fileSnapshot;
    let affected = 0;

    if (snapshot) {
      const targetText = newState === TruthToggleState.LIE
        ? this.applyRecords(snapshot, records)
        : snapshot;

      const success = await editor.edit(builder => {
        const fullRange = new vscode.Range(
          new vscode.Position(0, 0),
          editor.document.lineAt(editor.document.lineCount - 1).range.end
        );
        builder.replace(fullRange, targetText);
      });
      if (success) {
        affected = records.filter(r => !r.fileSnapshot).length;
      }
    } else if (records.length > 0) {
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
            builder.replace(range, targetText);
            affected++;
          }
        }
      });
    }

    this.states.set(filePath, {
      currentState: newState,
      lastToggleTime: Date.now(),
      documentUri: filePath,
      hasLies: records.length > 0,
    });
    this.updateStatusBar();
    return { success: true, newState, affectedComments: affected };
  }

  /** Called when a file has new lie records added. */
  public async notifyLiesAdded(filePath: string): Promise<void> {
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
  }

  /** Clean up when document closed. */
  public cleanupDocumentState(filePath: string): void {
    this.states.delete(filePath);
  }

  /** Refresh state information for a document, e.g. after clearing history. */
  public async refreshDocumentState(filePath: string): Promise<void> {
    const records = this.history.getRecordsForFile(filePath);
    const state = this.states.get(filePath) || {
      currentState: TruthToggleState.TRUTH,
      lastToggleTime: Date.now(),
      documentUri: filePath,
      hasLies: false,
    };
    state.hasLies = records.length > 0;
    if (!state.hasLies) {
      state.currentState = TruthToggleState.TRUTH;
    }
    state.lastToggleTime = Date.now();
    this.states.set(filePath, state);
    this.updateStatusBar();
  }

  /** Show current status in an information message. */
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
  }

  private updateStatusBar(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.bar.hide();
      return;
    }
    const filePath = editor.document.uri.fsPath;
    const info = this.states.get(filePath);
    const state = info?.currentState || TruthToggleState.TRUTH;
    this.bar.text = state === TruthToggleState.TRUTH ? '$(eye) 真话' : '$(eye-closed) 假话';
    this.bar.show();
  }

  public dispose(): void {
    this.bar.dispose();
  }
}
