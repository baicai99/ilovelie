import * as vscode from 'vscode';
import { CommentFormatter } from './commentFormatter';
import { ScannedComment } from '../comment/commentScanner';
import { HistoryManager } from '../manager/historyManager';
import { ToggleManager } from '../manager/toggleManager';
import { HistoryRecord } from '../types';

export interface CommentReplacement {
    comment: ScannedComment;
    newContent: string;
}

export interface ReplacementExecutionResult {
    success: boolean;
    replacedCount: number;
    historyRecords: HistoryRecord[];
}

export async function applyCommentReplacements(params: {
    editor: vscode.TextEditor;
    replacements: CommentReplacement[];
    historyManager: HistoryManager;
    recordType: HistoryRecord['type'];
    toggleManager?: ToggleManager;
}): Promise<ReplacementExecutionResult> {
    const { editor, replacements, historyManager, recordType, toggleManager } = params;

    if (replacements.length === 0) {
        return { success: true, replacedCount: 0, historyRecords: [] };
    }

    const historyRecords: HistoryRecord[] = [];
    const success = await editor.edit(editBuilder => {
        for (const replacement of replacements) {
            const formatted = CommentFormatter.formatComment(
                replacement.comment,
                replacement.newContent
            );
            editBuilder.replace(replacement.comment.range, formatted);

            historyRecords.push(
                historyManager.createHistoryRecord(
                    editor.document.uri.fsPath,
                    replacement.comment.content,
                    formatted,
                    replacement.comment.range,
                    recordType
                )
            );
        }
    });

    if (success && historyRecords.length > 0) {
        await historyManager.addRecords(historyRecords);
    }

    if (success && replacements.length > 0) {
        toggleManager?.notifyLiesAdded(editor.document.uri.fsPath);
    }

    return { success, replacedCount: replacements.length, historyRecords };
}
