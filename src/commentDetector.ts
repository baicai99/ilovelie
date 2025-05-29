import { SupportedLanguage, CommentFormat } from './types';

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
    }
}
