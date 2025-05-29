import * as vscode from 'vscode';
import { SupportedLanguage, CommentFormat, CommentInfo } from './types';

/**
 * 注释检测和处理器
 * 负责检测文本是否为注释，以及处理注释格式
 */
export class CommentDetector {

    /**
     * 检测文本是否为注释
     */
    public isComment(text: string, languageId: string): boolean {
        const trimmedText = text.trim();

        switch (languageId as SupportedLanguage) {
            case 'javascript':
            case 'typescript':
            case 'java':
            case 'csharp':
            case 'cpp':
            case 'c':
                return this.isSlashComment(trimmedText) || this.isMultiLineComment(trimmedText);

            case 'python':
            case 'ruby':
            case 'shell':
                return this.isHashComment(trimmedText);

            case 'html':
            case 'xml':
                return this.isHtmlComment(trimmedText);

            case 'css':
            case 'scss':
            case 'less':
                return this.isMultiLineComment(trimmedText);

            default:
                // 默认检测常见的注释格式
                return this.isSlashComment(trimmedText) ||
                    this.isHashComment(trimmedText) ||
                    this.isMultiLineComment(trimmedText) ||
                    this.isHtmlComment(trimmedText);
        }
    }

    /**
     * 获取注释格式类型
     */
    public getCommentFormat(text: string, languageId: string): CommentFormat {
        const trimmed = text.trim();

        if (this.isSlashComment(trimmed)) {
            return 'single-line-slash';
        }

        if (this.isHashComment(trimmed)) {
            return 'single-line-hash';
        }

        if (this.isMultiLineComment(trimmed)) {
            return 'multi-line-star';
        }

        if (this.isHtmlComment(trimmed)) {
            return 'html-comment';
        }

        // 默认返回单行斜杠注释
        return 'single-line-slash';
    }

    /**
     * 保持注释格式，只替换内容
     */
    public replaceCommentContent(originalComment: string, newContent: string, languageId: string): string {
        const trimmed = originalComment.trim();

        // JavaScript/TypeScript/Java/C#/C++ 单行注释
        if (this.isSlashComment(trimmed)) {
            return originalComment.replace(/\/\/\s*.*/, `// ${newContent}`);
        }

        // Python/Ruby/Shell 注释
        if (this.isHashComment(trimmed)) {
            return originalComment.replace(/#\s*.*/, `# ${newContent}`);
        }

        // 多行注释 /* */
        if (this.isMultiLineComment(trimmed)) {
            return originalComment.replace(/\/\*[\s\S]*?\*\//, `/* ${newContent} */`);
        }

        // HTML/XML 注释
        if (this.isHtmlComment(trimmed)) {
            return originalComment.replace(/<!--[\s\S]*?-->/, `<!-- ${newContent} -->`);
        }

        return originalComment;
    }

    /**
     * 提取注释内容（去除注释符号）
     */
    public extractCommentContent(text: string, languageId: string): string {
        const trimmed = text.trim();        // 处理 // 注释
        if (this.isSlashComment(trimmed)) {
            return trimmed.replace(/^\/\/\s*/, '').trim();
        }

        // 处理 # 注释
        if (this.isHashComment(trimmed)) {
            return trimmed.replace(/^#\s*/, '').trim();
        }

        // 处理 /* */ 注释
        if (this.isMultiLineComment(trimmed)) {
            return trimmed.replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '').trim();
        }

        // 处理 <!-- --> 注释
        if (this.isHtmlComment(trimmed)) {
            return trimmed.replace(/^<!--\s*/, '').replace(/\s*-->$/, '').trim();
        }

        return trimmed;
    }

    /**
     * 检测是否为斜杠注释 //
     */
    private isSlashComment(text: string): boolean {
        return text.startsWith('//');
    }

    /**
     * 检测是否为井号注释 #
     */
    private isHashComment(text: string): boolean {
        return text.startsWith('#');
    }

    /**
     * 检测是否为多行注释
     */
    private isMultiLineComment(text: string): boolean {
        return text.startsWith('/*') && text.endsWith('*/');
    }

    /**
     * 检测是否为HTML注释 <!-- -->
     */
    private isHtmlComment(text: string): boolean {
        return text.startsWith('<!--') && text.endsWith('-->');
    }    /**
     * 检测文档中的所有注释
     */
    public detectComments(document: vscode.TextDocument): CommentInfo[] {
        const comments: CommentInfo[] = [];
        const languageId = document.languageId;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();

            // 检测单行注释
            if (this.isSlashComment(text) || this.isHashComment(text) || this.isHtmlComment(text)) {
                let commentType = 'line';
                if (this.isHtmlComment(text)) {
                    commentType = 'html';
                }

                const startChar = line.firstNonWhitespaceCharacterIndex;
                const endChar = line.text.length;

                comments.push({
                    text: line.text.substring(startChar),
                    range: {
                        start: { line: i, character: startChar },
                        end: { line: i, character: endChar }
                    },
                    type: commentType
                });
            }
            // 检测多行注释的开始
            else if (text.includes('/*')) {
                const multiLineComment = this.detectMultiLineComment(document, i);
                if (multiLineComment) {
                    comments.push(multiLineComment);
                    // 跳过已处理的行
                    i = multiLineComment.range.end.line;
                }
            }
        }

        return comments;
    }

    /**
     * 检测多行注释块
     */
    private detectMultiLineComment(document: vscode.TextDocument, startLine: number): CommentInfo | null {
        const startLineText = document.lineAt(startLine).text;
        const startMatch = startLineText.match(/\/\*/);

        if (!startMatch) {
            return null;
        }

        const startChar = startMatch.index!;
        let endLine = startLine;
        let endChar = startLineText.length;
        let commentText = '';

        // 查找注释结束位置
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;

            if (i === startLine) {
                // 检查是否在同一行结束
                const endMatch = lineText.match(/\*\//);
                if (endMatch && endMatch.index! > startChar) {
                    endChar = endMatch.index! + 2;
                    commentText = lineText.substring(startChar, endChar);
                    break;
                } else {
                    commentText = lineText.substring(startChar);
                }
            } else {
                const endMatch = lineText.match(/\*\//);
                if (endMatch) {
                    endLine = i;
                    endChar = endMatch.index! + 2;
                    commentText += '\n' + lineText.substring(0, endChar);
                    break;
                } else {
                    commentText += '\n' + lineText;
                }
            }
        }

        // 确定注释类型
        let commentType = 'block';
        if (commentText.trim().startsWith('/**')) {
            commentType = 'documentation';
        }

        return {
            text: commentText,
            range: {
                start: { line: startLine, character: startChar },
                end: { line: endLine, character: endChar }
            },
            type: commentType
        };
    }
}
