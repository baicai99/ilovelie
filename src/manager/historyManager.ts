import * as vscode from 'vscode';
import { HistoryRecord } from '../types';

// 创建输出通道用于调试日志
const outputChannel = vscode.window.createOutputChannel('I Love Lie - History Manager');

/**
 * 简单的历史管理器，按文件存储更改。
 */
export class HistoryManager {
  // 存储限制常量
  private static readonly MAX_RECORDS_PER_FILE = 100;  // 每个文件最多保留100条记录
  private static readonly MAX_TOTAL_SIZE_BYTES = 5 * 1024 * 1024;  // 总存储上限 5MB

  private records: HistoryRecord[] = [];
  private context?: vscode.ExtensionContext;
  private sessions: Map<string, string> = new Map();
  private idCounter = 0;  // Counter to prevent ID collisions  /** 初始化管理器并加载持久化的历史记录。 */
  public initialize(context: vscode.ExtensionContext): void {
    outputChannel.appendLine(`[HistoryManager] 初始化开始`);
    this.context = context;
    const saved = context.globalState.get<HistoryRecord[]>('changeHistory', []);
    this.records = saved ?? [];
    outputChannel.appendLine(`[HistoryManager] 加载了 ${this.records.length} 条历史记录`);
  }
  /** Start a lie session for a file and return session id. */
  public startLieSession(filePath: string, fileText: string): string {
    outputChannel.appendLine(`[HistoryManager] 开始假话会话: ${filePath}`);

    // 先清理可能存在的旧会话，防止内存泄漏
    if (this.sessions.has(filePath)) {
      outputChannel.appendLine(`[HistoryManager] 检测到旧会话，先清理`);
      this.endLieSession(filePath);
    }

    const id = this.generateId();
    this.sessions.set(filePath, id);
    outputChannel.appendLine(`[HistoryManager] 生成会话ID: ${id}`);

    // 清理同文件的旧记录，但保留最近的记录
    const beforeCount = this.records.length;
    this.cleanupOldRecords(filePath);
    const removedCount = beforeCount - this.records.length;
    if (removedCount > 0) {
      outputChannel.appendLine(`[HistoryManager] 清理了 ${removedCount} 条旧记录`);
    }

    // 检查是否可以添加新快照
    if (!this.canAddSnapshot(fileText.length)) {
      outputChannel.appendLine(`[HistoryManager] 警告：快照过大或存储空间不足`);
      vscode.window.showWarningMessage('历史记录存储空间不足，将跳过创建快照');
      return id;
    }

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
    outputChannel.appendLine(`[HistoryManager] 创建文件快照，长度: ${fileText.length}`);
    this.save();

    return id;
  }

  /** End active lie session for file. */
  public async endLieSession(filePath: string): Promise<void> {
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
    await this.save();
  }

  /** Check if file has active session. */
  public hasActiveSession(filePath: string): boolean {
    return this.sessions.has(filePath);
  }

  /** Get current session id if exists. */
  public getCurrentSessionId(filePath: string): string | undefined {
    return this.sessions.get(filePath);
  }

  /** Generate unique id with counter to prevent collisions. */
  private generateId(): string {
    return `${Date.now().toString(36)}-${(this.idCounter++).toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  /** Persist history to global state. */
  private async save(): Promise<void> {
    if (!this.context) {
      console.error('[HistoryManager] Context未初始化，无法保存');
      return;
    }
    try {
      await this.context.globalState.update('changeHistory', this.records);
      outputChannel.appendLine(`[HistoryManager] 已保存 ${this.records.length} 条记录到全局状态`);
    } catch (error) {
      console.error('[HistoryManager] 保存历史记录失败:', error);
      outputChannel.appendLine(`[HistoryManager] 保存失败: ${error}`);
      // 通知用户保存失败
      vscode.window.showErrorMessage('保存历史记录失败，可能是存储空间不足或数据过大');
    }
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
    await this.save();
  }

  /** Add multiple records and persist once. */
  public async addRecords(records: HistoryRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }
    this.records.push(...records);
    await this.save();
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
  public async clearRecordsForFile(filePath: string): Promise<{ success: boolean; clearedCount: number }> {
    const before = this.records.length;
    this.records = this.records.filter(r => r.filePath !== filePath);
    const cleared = before - this.records.length;
    if (cleared > 0) {
      await this.save();
    }
    return { success: true, clearedCount: cleared };
  }

  /** Remove record by id. */
  public async removeRecordById(id: string): Promise<boolean> {
    const idx = this.records.findIndex(r => r.id === id);
    if (idx >= 0) {
      this.records.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Remove duplicate records for a file keeping highest version.
   */
  public async cleanupDuplicateRecords(filePath: string): Promise<number> {
    const related = this.getRecordsForFile(filePath);
    const map = new Map<string, HistoryRecord>();
    for (const r of related) {
      const key = `${r.startPosition.line}:${r.startPosition.character}-` +
        `${r.endPosition.line}:${r.endPosition.character}`;
      const existing = map.get(key);
      if (!existing || (r.versionNumber || 1) > (existing.versionNumber || 1)) {
        map.set(key, r);
      }
    } const unique = Array.from(map.values());
    const removed = related.length - unique.length;
    this.records = this.records.filter(r => r.filePath !== filePath);
    this.records.push(...unique);
    if (removed > 0) {
      await this.save();
    }
    return removed;
  }

  /**
   * 检查是否可以添加新快照
   */
  private canAddSnapshot(snapshotSize: number): boolean {
    const currentSize = this.estimateSize();
    const projectedSize = currentSize + snapshotSize;

    if (projectedSize > HistoryManager.MAX_TOTAL_SIZE_BYTES) {
      return false;
    }

    return true;
  }

  /**
   * 清理文件的旧记录，只保留最近的 N 条
   */
  private cleanupOldRecords(filePath: string): void {
    const fileRecords = this.records.filter(r => r.filePath === filePath);

    if (fileRecords.length <= HistoryManager.MAX_RECORDS_PER_FILE) {
      return;
    }

    // 按时间戳排序，保留最新的记录
    const sortedRecords = fileRecords.sort((a, b) => b.timestamp - a.timestamp);
    const toKeep = sortedRecords.slice(0, HistoryManager.MAX_RECORDS_PER_FILE);
    const toKeepIds = new Set(toKeep.map(r => r.id));

    // 移除旧记录
    this.records = this.records.filter(r =>
      r.filePath !== filePath || toKeepIds.has(r.id)
    );
  }

  /**
   * 估算当前历史记录的大小（字节）
   */
  private estimateSize(): number {
    return this.records.reduce((total, record) => {
      const recordSize =
        (record.originalText?.length || 0) +
        (record.newText?.length || 0) +
        (record.fileSnapshot?.length || 0) +
        200;  // 其他字段的估算大小
      return total + recordSize;
    }, 0);
  }
}
