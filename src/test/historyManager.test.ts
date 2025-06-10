import * as assert from 'assert';
import { HistoryManager } from '../manager/historyManager';
import * as vscode from 'vscode';

// Mock vscode for tests that don't require actual editor
// Only the parts used by HistoryManager need to be mocked

suite('HistoryManager duplicate cleanup', () => {
  const manager = new HistoryManager();
  const dummyUri = 'file:///tmp/test.ts';
  const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10));

  test('cleanupDuplicateRecords removes duplicates', async () => {
    const r1 = manager.createHistoryRecord(dummyUri, 'o', 'n', range, 'manual-replace');
    await manager.addRecord(r1);
    const r2 = manager.createHistoryRecord(dummyUri, 'o', 'n2', range, 'manual-replace');
    await manager.addRecord(r2);
    const r3 = manager.createHistoryRecord(dummyUri, 'o', 'n3', range, 'manual-replace');
    await manager.addRecord(r3);

    const removed = manager.cleanupDuplicateRecords(dummyUri);
    const records = manager.getRecordsForFile(dummyUri);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(removed, 2);
    assert.strictEqual(records[0].versionNumber, 3);
  });
});

suite('HistoryManager clear records', () => {
  const manager = new HistoryManager();
  const uri1 = 'file:///tmp/a.ts';
  const uri2 = 'file:///tmp/b.ts';
  const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));

  test('clearRecordsForFile removes records for specific file', async () => {
    const r1 = manager.createHistoryRecord(uri1, 'o', 'n', range, 'manual-replace');
    await manager.addRecord(r1);
    const r2 = manager.createHistoryRecord(uri2, 'o', 'n2', range, 'manual-replace');
    await manager.addRecord(r2);

    const result = manager.clearRecordsForFile(uri1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.clearedCount, 1);
    assert.strictEqual(manager.getRecordsForFile(uri1).length, 0);
    assert.strictEqual(manager.getRecordsForFile(uri2).length, 1);
  });
});
