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
