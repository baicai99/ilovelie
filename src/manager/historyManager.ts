import * as vscode from 'vscode';
import { HistoryRecord } from '../types';

/**
 * Simple history manager storing changes per file.
 */
export class HistoryManager {
  private records: HistoryRecord[] = [];
  private context?: vscode.ExtensionContext;
  private sessions: Map<string, string> = new Map();

  /** Initialize manager and load persisted history. */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    const saved = context.globalState.get<HistoryRecord[]>('changeHistory', []);
    this.records = saved ?? [];
  }

  /** Start a lie session for a file and return session id. */
  public startLieSession(filePath: string, fileText: string): string {
    const id = this.generateId();
    this.sessions.set(filePath, id);

    // create a snapshot record so we can restore the file later
    const snapshotRecord: HistoryRecord = {
      id: this.generateId(),
      filePath,
      originalText: fileText,
      newText: fileText,
      timestamp: Date.now(),
      type: 'session-start',
      startPosition: { line: 0, character: 0 },
      endPosition: { line: 0, character: 0 },
      sessionId: id,
      isActive: true,
      versionNumber: 1,
      fileSnapshot: fileText,
    };
    this.records.push(snapshotRecord);
    this.save();

    return id;
  }

  /** End active lie session for file. */
  public endLieSession(filePath: string): void {
    const sessionId = this.sessions.get(filePath);
    if (sessionId) {
      for (const record of this.records) {
        if (record.sessionId === sessionId && record.isActive) {
          record.isActive = false;
          record.sessionEndTime = Date.now();
        }
      }
    }
    this.sessions.delete(filePath);
    this.save();
  }

  /** Check if file has active session. */
  public hasActiveSession(filePath: string): boolean {
    return this.sessions.has(filePath);
  }

  /** Get current session id if exists. */
  public getCurrentSessionId(filePath: string): string | undefined {
    return this.sessions.get(filePath);
  }

  /** Generate unique id. */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  /** Persist history to global state. */
  private save(): void {
    this.context?.globalState.update('changeHistory', this.records);
  }

  /** Create a history record from text range. */
  public createHistoryRecord(
    filePath: string,
    originalText: string,
    newText: string,
    range: vscode.Range,
    type: HistoryRecord['type'] = 'manual-replace'
  ): HistoryRecord {
    const sessionId = this.getCurrentSessionId(filePath);
    return {
      id: this.generateId(),
      filePath,
      originalText,
      newText,
      timestamp: Date.now(),
      type,
      startPosition: { line: range.start.line, character: range.start.character },
      endPosition: { line: range.end.line, character: range.end.character },
      sessionId: sessionId,
      isActive: !!sessionId,
      versionNumber: 1
    };
  }

  /** Add a record and persist. */
  public async addRecord(record: HistoryRecord): Promise<void> {
    this.records.push(record);
    this.save();
  }

  /** Get all records. */
  public getAllRecords(): HistoryRecord[] {
    return [...this.records];
  }

  /** Get records for a specific file. */
  public getRecordsForFile(filePath: string): HistoryRecord[] {
    return this.records.filter(r => r.filePath === filePath);
  }

  /**
   * Clear all records associated with a file.
   */
  public clearRecordsForFile(filePath: string): { success: boolean; clearedCount: number } {
    const before = this.records.length;
    this.records = this.records.filter(r => r.filePath !== filePath);
    const cleared = before - this.records.length;
    if (cleared > 0) {
      this.save();
    }
    return { success: true, clearedCount: cleared };
  }

  /** Remove record by id. */
  public removeRecordById(id: string): boolean {
    const idx = this.records.findIndex(r => r.id === id);
    if (idx >= 0) {
      this.records.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Remove duplicate records for a file keeping highest version.
   */
  public cleanupDuplicateRecords(filePath: string): number {
    const related = this.getRecordsForFile(filePath);
    const map = new Map<string, HistoryRecord>();
    for (const r of related) {
      const key = `${r.startPosition.line}:${r.startPosition.character}-` +
        `${r.endPosition.line}:${r.endPosition.character}`;
      const existing = map.get(key);
      if (!existing || (r.versionNumber || 1) > (existing.versionNumber || 1)) {
        map.set(key, r);
      }
    }
    const unique = Array.from(map.values());
    const removed = related.length - unique.length;
    this.records = this.records.filter(r => r.filePath !== filePath);
    this.records.push(...unique);
    if (removed > 0) this.save();
    return removed;
  }
}
