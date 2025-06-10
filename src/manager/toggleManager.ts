import * as vscode from 'vscode';
import { TruthToggleState, ToggleStateInfo, ToggleResult } from '../types';
import { HistoryManager } from './historyManager';

/**
 * Minimal implementation of toggle logic.
 */
export class ToggleManager {
  private history: HistoryManager;
  private states: Map<string, ToggleStateInfo> = new Map();
  private bar: vscode.StatusBarItem;

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
    const uri = editor.document.uri.toString();
    const info = this.states.get(uri);
    const newState = info?.currentState === TruthToggleState.LIE ? TruthToggleState.TRUTH : TruthToggleState.LIE;
    this.states.set(uri, {
      currentState: newState,
      lastToggleTime: Date.now(),
      documentUri: uri,
      hasLies: this.history.getRecordsForFile(uri).length > 0,
    });
    this.updateStatusBar();
    return { success: true, newState, affectedComments: 0 };
  }

  /** Called when a file has new lie records added. */
  public async notifyLiesAdded(documentUri: string): Promise<void> {
    const state = this.states.get(documentUri) || {
      currentState: TruthToggleState.LIE,
      lastToggleTime: Date.now(),
      documentUri,
      hasLies: true,
    };
    state.hasLies = true;
    state.currentState = TruthToggleState.LIE;
    state.lastToggleTime = Date.now();
    this.states.set(documentUri, state);
    this.updateStatusBar();
  }

  /** Clean up when document closed. */
  public cleanupDocumentState(documentUri: string): void {
    this.states.delete(documentUri);
  }

  /** Show current status in an information message. */
  public async showCurrentStatus(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('没有活动的编辑器');
      return;
    }
    const uri = editor.document.uri.toString();
    const info = this.states.get(uri);
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
    const uri = editor.document.uri.toString();
    const info = this.states.get(uri);
    const state = info?.currentState || TruthToggleState.TRUTH;
    this.bar.text = state === TruthToggleState.TRUTH ? '$(eye) 真话' : '$(eye-closed) 假话';
    this.bar.show();
  }

  public dispose(): void {
    this.bar.dispose();
  }
}
