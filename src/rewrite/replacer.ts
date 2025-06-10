import * as vscode from 'vscode';
import { SimpleCommentDetector } from './simpleDetector';

export class RewrittenCommentReplacer {
    private detector: SimpleCommentDetector;

    constructor() {
        this.detector = new SimpleCommentDetector();
    }

    async replaceComment(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }
        const document = editor.document;
        const line = document.lineAt(editor.selection.active.line);
        if (!this.detector.isComment(line.text)) {
            vscode.window.showInformationMessage('Current line is not a comment');
            return;
        }
        const replacement = await vscode.window.showInputBox({
            prompt: 'Enter new comment text'
        });
        if (replacement === undefined) {
            return;
        }
        await editor.edit(edit => {
            edit.replace(line.range, `// ${replacement}`);
        });
    }
}
