import * as vscode from 'vscode';
import { RewrittenCommentReplacer } from './replacer';

let replacer: RewrittenCommentReplacer;

export function activate(context: vscode.ExtensionContext) {
    replacer = new RewrittenCommentReplacer();
    const disposable = vscode.commands.registerCommand('ilovelie.rewriteReplace', async () => {
        await replacer.replaceComment();
    });
    context.subscriptions.push(disposable);
}

export function deactivate() {
    // no-op
}
