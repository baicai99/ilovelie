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
                return this.isSlashComment(trimmedText) || this.isJSDocComment(trimmedText) || this.isMultiLineComment(trimmedText);

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
                return this.isMultiLineComment(trimmedText); default:
                // 默认检测常见的注释格式
                return this.isSlashComment(trimmedText) ||
                    this.isHashComment(trimmedText) ||
                    this.isJSDocComment(trimmedText) ||
                    this.isMultiLineComment(trimmedText) ||
                    this.isHtmlComment(trimmedText);
        }
    }    /**
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

        if (this.isJSDocComment(trimmed)) {
            return 'jsdoc-comment';
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
        }        // Python/Ruby/Shell 注释
        if (this.isHashComment(trimmed)) {
            return originalComment.replace(/#\s*.*/, `# ${newContent}`);
        }

        // JSDoc 注释 /** */
        if (this.isJSDocComment(trimmed)) {
            return originalComment.replace(/\/\*\*[\s\S]*?\*\//, `/** ${newContent} */`);
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
        }        // 处理 # 注释
        if (this.isHashComment(trimmed)) {
            return trimmed.replace(/^#\s*/, '').trim();
        }

        // 处理 /** */ JSDoc注释
        if (this.isJSDocComment(trimmed)) {
            return trimmed.replace(/^\/\*\*\s*/, '').replace(/\s*\*\/$/, '').trim();
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
    }    /**
     * 检测是否为多行注释
     */
    private isMultiLineComment(text: string): boolean {
        return text.startsWith('/*') && text.endsWith('*/') && !text.startsWith('/**');
    }

    /**
     * 检测是否为JSDoc注释
     */
    private isJSDocComment(text: string): boolean {
        return text.startsWith('/**') && text.endsWith('*/');
    }    /**
     * 检测是否为HTML注释 <!-- -->
     */
    private isHtmlComment(text: string): boolean {
        return text.startsWith('<!--') && text.endsWith('-->');
    }    /**
     * 检测行是否为单行注释
     * 更严格的检查，确保注释符在行的有效位置，避免误识别代码
     * 支持行尾注释和行首注释
     */
    private isLineComment(lineText: string, languageId: string): boolean {
        const trimmed = lineText.trim();

        // 跳过空行
        if (!trimmed) {
            return false;
        }

        // 检查是否包含注释符
        const slashIndex = lineText.indexOf('//');
        const hashIndex = lineText.indexOf('#');
        const htmlStartIndex = lineText.indexOf('<!--');

        // 判断使用哪种注释符
        let commentSymbolIndex = -1;
        let isSlash = false;
        let isHash = false;
        let isHtml = false;

        if (slashIndex !== -1) {
            commentSymbolIndex = slashIndex;
            isSlash = true;
        } else if (hashIndex !== -1 && languageId !== 'csharp') {
            commentSymbolIndex = hashIndex;
            isHash = true;
        } else if (htmlStartIndex !== -1 && lineText.indexOf('-->') > htmlStartIndex) {
            commentSymbolIndex = htmlStartIndex;
            isHtml = true;
        }

        if (commentSymbolIndex === -1) {
            return false;
        }

        // 额外检查：如果是 // 注释，确保不在字符串中
        if (isSlash && this.isInStringLiteral(lineText, commentSymbolIndex)) {
            return false;
        }

        const beforeComment = lineText.substring(0, commentSymbolIndex);

        // 检查注释符之前的内容
        if (/^\s*$/.test(beforeComment)) {
            // 情况1: 注释符前只有空白字符（行首注释）
            return true;
        } else {
            // 情况2: 注释符前有代码（行尾注释）
            // 验证前面的代码是否看起来合理
            return this.isValidEndOfLineComment(beforeComment, languageId);
        }
    }

    /**
     * 验证行尾注释是否有效
     * 检查注释符前的代码是否看起来是合理的代码语句
     */
    private isValidEndOfLineComment(codeBeforeComment: string, languageId: string): boolean {
        const trimmedCode = codeBeforeComment.trim();

        // 空字符串不算有效的行尾注释
        if (!trimmedCode) {
            return false;
        }

        // 常见的有效行尾注释模式
        const validEndOfLinePatterns = [
            /\w+\s*\([^)]*\)\s*;?\s*$/,      // 函数调用: processId(123); 
            /\w+\s*=\s*[^;]+\s*;?\s*$/,      // 赋值语句: var x = value;
            /\w+\s*\+\+\s*;?\s*$/,           // 自增: i++;
            /\w+\s*--\s*;?\s*$/,             // 自减: i--;
            /\w+\s*\.\s*\w+\s*;?\s*$/,       // 属性访问: obj.prop;
            /\w+\s*\[\s*[^\]]*\s*\]\s*;?\s*$/, // 数组访问: arr[index];
            /return\s+[^;]*\s*;?\s*$/,       // return 语句
            /break\s*;?\s*$/,                // break 语句
            /continue\s*;?\s*$/,             // continue 语句
            /throw\s+[^;]*\s*;?\s*$/,        // throw 语句
            /\}\s*$/,                        // 代码块结束
            /\w+\s*:\s*[^,}]+\s*,?\s*$/,     // 对象属性: prop: value,
            /.*\)\s*\{\s*$/,                 // 函数/方法定义开始
            /.*\{\s*$/,                      // 代码块开始
            /if\s*\([^)]*\)\s*$/,            // if 语句（无花括号）
            /for\s*\([^)]*\)\s*$/,           // for 语句（无花括号）
            /while\s*\([^)]*\)\s*$/,         // while 语句（无花括号）
            /else\s*$/,                      // else 语句
            /case\s+[^:]*:\s*$/,             // switch case
            /default\s*:\s*$/,               // switch default
        ];

        // 检查是否匹配任何有效模式
        const matchesValidPattern = validEndOfLinePatterns.some(pattern => pattern.test(trimmedCode));

        if (matchesValidPattern) {
            return true;
        }

        // 额外的语言特定检查
        switch (languageId) {
            case 'javascript':
            case 'typescript':
                return this.isValidJSEndOfLineComment(trimmedCode);
            case 'python':
                return this.isValidPythonEndOfLineComment(trimmedCode);
            case 'java':
            case 'csharp':
                return this.isValidJavaEndOfLineComment(trimmedCode);
            default:
                // 对于未知语言，使用保守的方法
                // 如果看起来像代码并且不包含注释符，则认为是有效的
                return !this.containsCommentSymbols(trimmedCode) && this.looksLikeCode(trimmedCode);
        }
    }

    /**
     * 检查JavaScript/TypeScript的有效行尾注释
     */
    private isValidJSEndOfLineComment(codeBeforeComment: string): boolean {
        const jsEndOfLinePatterns = [
            /.*\)\s*=>\s*\{?\s*$/,           // 箭头函数
            /.*\?\s*[^:]*\s*:\s*[^;]*\s*;?\s*$/, // 三元操作符
            /.*&&\s*[^;]*\s*;?\s*$/,         // 逻辑与操作
            /.*\|\|\s*[^;]*\s*;?\s*$/,       // 逻辑或操作
            /await\s+[^;]*\s*;?\s*$/,        // await 语句
            /console\.\w+\([^)]*\)\s*;?\s*$/, // console 调用
        ];

        return jsEndOfLinePatterns.some(pattern => pattern.test(codeBeforeComment));
    }

    /**
     * 检查Python的有效行尾注释
     */
    private isValidPythonEndOfLineComment(codeBeforeComment: string): boolean {
        const pythonEndOfLinePatterns = [
            /\w+\([^)]*\)\s*$/,              // 函数调用
            /\w+\s*=\s*[^=][^#]*$/,          // 赋值语句
            /pass\s*$/,                      // pass 语句
            /return\s+[^#]*$/,               // return 语句
            /print\([^)]*\)\s*$/,            // print 函数
        ];

        return pythonEndOfLinePatterns.some(pattern => pattern.test(codeBeforeComment));
    }

    /**
     * 检查Java/C#的有效行尾注释
     */
    private isValidJavaEndOfLineComment(codeBeforeComment: string): boolean {
        const javaEndOfLinePatterns = [
            /System\.out\.\w+\([^)]*\)\s*;?\s*$/, // System.out 调用
            /\w+\.\w+\([^)]*\)\s*;?\s*$/,         // 方法调用
            /new\s+\w+\([^)]*\)\s*;?\s*$/,        // 对象创建
        ];

        return javaEndOfLinePatterns.some(pattern => pattern.test(codeBeforeComment));
    }

    /**
     * 检查文本是否包含注释符号
     */
    private containsCommentSymbols(text: string): boolean {
        return text.includes('//') || text.includes('/*') || text.includes('*/') ||
            text.includes('#') || text.includes('<!--') || text.includes('-->');
    }

    /**
     * 简单检查文本是否看起来像代码
     */
    private looksLikeCode(text: string): boolean {
        // 基本的代码特征
        const codeFeatures = [
            /[(){}[\]]/,                     // 括号
            /[=+\-*/%]/,                     // 操作符
            /[;,]/,                          // 分隔符
            /\w+\./,                         // 点操作符
            /\w+\(/,                         // 函数调用
        ];

        return codeFeatures.some(pattern => pattern.test(text));
    }

    /**
     * 检查文本是否包含明显的代码关键字，用于排除误识别的情况
     */
    private containsCodeKeywords(text: string, languageId: string): boolean {
        // 常见的代码关键字和模式
        const codePatterns = [
            /^import\s+/,           // import 语句
            /^export\s+/,           // export 语句  
            /^from\s+/,             // from 语句
            /^const\s+/,            // const 声明
            /^let\s+/,              // let 声明
            /^var\s+/,              // var 声明
            /^function\s+/,         // function 声明
            /^class\s+/,            // class 声明
            /^interface\s+/,        // interface 声明
            /^type\s+/,             // type 声明
            /^enum\s+/,             // enum 声明
            /^namespace\s+/,        // namespace 声明
            /^using\s+/,            // C# using 语句
            /^package\s+/,          // Java package 语句
            /^public\s+/,           // public 修饰符
            /^private\s+/,          // private 修饰符
            /^protected\s+/,        // protected 修饰符
            /^static\s+/,           // static 修饰符
            /^async\s+/,            // async 修饰符
            /^await\s+/,            // await 语句
            /^return\s+/,           // return 语句
            /^if\s*\(/,             // if 语句
            /^for\s*\(/,            // for 循环
            /^while\s*\(/,          // while 循环
            /^switch\s*\(/,         // switch 语句
            /^try\s*{/,             // try 语句
            /^catch\s*\(/,          // catch 语句
            /^finally\s*{/,         // finally 语句
            /^throw\s+/,            // throw 语句
            /^\w+\s*\(/,            // 函数调用
            /^\w+\.\w+/,            // 对象属性访问
            /^\w+\s*=/,             // 赋值语句
            /^.*\{.*\}.*$/,         // 包含花括号的语句
            /^.*\[.*\].*$/,         // 包含方括号的语句
            /^.*\(.*\).*$/,         // 包含圆括号的语句（但要排除注释）
        ];

        // 检查是否匹配任何代码模式
        for (const pattern of codePatterns) {
            if (pattern.test(text)) {
                // 如果匹配到模式，再次确认不是注释中的代码示例
                if (!text.startsWith('//') && !text.startsWith('#') && !text.startsWith('<!--')) {
                    return true;
                }
            }
        }

        // 特定语言的额外检查
        switch (languageId) {
            case 'javascript':
            case 'typescript':
                return this.containsJSCodeKeywords(text);
            case 'python':
                return this.containsPythonCodeKeywords(text);
            case 'java':
            case 'csharp':
                return this.containsJavaCodeKeywords(text);
            default:
                return false;
        }
    }

    /**
     * 检查JavaScript/TypeScript特定的代码关键字
     */
    private containsJSCodeKeywords(text: string): boolean {
        const jsPatterns = [
            /^require\s*\(/,        // require 语句
            /^module\.exports/,     // module.exports
            /^exports\./,           // exports.
            /^\w+\s*=>/,            // 箭头函数
            /^.*\?\s*.*:.*$/,       // 三元操作符
            /^.*&&.*$/,             // 逻辑与
            /^.*\|\|.*$/,           // 逻辑或
        ];

        return jsPatterns.some(pattern => pattern.test(text));
    }

    /**
     * 检查Python特定的代码关键字
     */
    private containsPythonCodeKeywords(text: string): boolean {
        const pythonPatterns = [
            /^def\s+/,              // 函数定义
            /^class\s+/,            // 类定义
            /^import\s+/,           // import 语句
            /^from\s+.*import/,     // from import 语句
            /^if\s+.*:/,            // if 语句
            /^elif\s+.*:/,          // elif 语句
            /^else\s*:/,            // else 语句
            /^for\s+.*in.*:/,       // for 循环
            /^while\s+.*:/,         // while 循环
            /^try\s*:/,             // try 语句
            /^except.*:/,           // except 语句
            /^finally\s*:/,         // finally 语句
        ];

        return pythonPatterns.some(pattern => pattern.test(text));
    }

    /**
     * 检查Java/C#特定的代码关键字
     */
    private containsJavaCodeKeywords(text: string): boolean {
        const javaPatterns = [
            /^@\w+/,                // 注解
            /^.*\s+throws\s+/,      // throws 语句
            /^.*extends\s+/,        // extends 语句
            /^.*implements\s+/,     // implements 语句
            /^.*new\s+\w+/,         // new 语句
        ];

        return javaPatterns.some(pattern => pattern.test(text));
    }

    /**
     * 获取单行注释的类型
     */
    private getLineCommentType(trimmedText: string): string {
        if (trimmedText.startsWith('//')) {
            return 'line';
        } else if (trimmedText.startsWith('#')) {
            return 'line';
        } else if (trimmedText.startsWith('<!--')) {
            return 'html';
        }
        return 'line';
    }    /**
     * 检测文档中的所有注释
     */
    public detectComments(document: vscode.TextDocument): CommentInfo[] {
        const comments: CommentInfo[] = [];
        const languageId = document.languageId;

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;
            const trimmedText = lineText.trim();

            // 跳过空行
            if (!trimmedText) {
                continue;
            }

            // 检测单行注释 - 支持行首注释和行尾注释
            if (this.isLineComment(lineText, languageId)) {
                const commentType = this.getLineCommentType(trimmedText);

                // 找到注释开始位置
                const commentStartIndex = this.findCommentStartIndex(lineText, languageId);
                if (commentStartIndex !== -1) {
                    const endChar = lineText.length;

                    comments.push({
                        text: lineText.substring(commentStartIndex),
                        range: {
                            start: { line: i, character: commentStartIndex },
                            end: { line: i, character: endChar }
                        },
                        type: commentType
                    });
                }
            }
            // 检测多行注释的开始
            else if (this.isValidMultiLineCommentStart(lineText)) {
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
     * 找到注释开始位置的索引
     */
    private findCommentStartIndex(lineText: string, languageId: string): number {
        const slashIndex = lineText.indexOf('//');
        const hashIndex = lineText.indexOf('#');
        const htmlStartIndex = lineText.indexOf('<!--');

        // 优先检查 // 注释
        if (slashIndex !== -1 && !this.isInStringLiteral(lineText, slashIndex)) {
            return slashIndex;
        }

        // 检查 # 注释（非C#语言）
        if (hashIndex !== -1 && languageId !== 'csharp' && !this.isInStringLiteral(lineText, hashIndex)) {
            return hashIndex;
        }

        // 检查 HTML 注释
        if (htmlStartIndex !== -1 && lineText.indexOf('-->') > htmlStartIndex) {
            return htmlStartIndex;
        }

        return -1;
    }/**
     * 验证行是否是有效的多行注释开始
     * 防止错误识别包含 /* 的代码行（如字符串、正则表达式等）
     */
    private isValidMultiLineCommentStart(lineText: string): boolean {
        const trimmed = lineText.trim();

        // 如果行为空或者不包含 /*，直接返回 false
        if (!trimmed || !trimmed.includes('/*')) {
            return false;
        }

        // 查找 /* 的位置
        const commentStartIndex = lineText.indexOf('/*');
        if (commentStartIndex === -1) {
            return false;
        }

        // 检查 /* 之前的内容
        const beforeComment = lineText.substring(0, commentStartIndex);

        // 1. 注释符之前只能有空白字符（标准情况）
        if (!/^\s*$/.test(beforeComment)) {
            return false;
        }

        // 2. 检查是否在字符串字面量中
        if (this.isInStringLiteral(lineText, commentStartIndex)) {
            return false;
        }

        // 3. 检查是否包含明显的代码模式
        if (this.containsCodeKeywords(trimmed, '')) {
            return false;
        }

        // 4. 简单的语法检查：如果行包含明显的代码语法，则可能不是注释
        const beforeCommentTrimmed = beforeComment.trim();
        if (beforeCommentTrimmed.length === 0) {
            // /* 在行开始（忽略空白），很可能是注释
            return true;
        }

        return false;
    }

    /**
     * 额外的代码行验证
     * 检查是否是明显的代码行而不是注释
     */
    private isObviousCodeLine(text: string): boolean {
        const trimmed = text.trim();

        // 检查是否是明显的代码模式
        const obviousCodePatterns = [
            /^import\s+.*from\s+['"`]/,        // import ... from "..."

            /^export\s+.*\{/,                  // export { ... }
            /^const\s+\w+\s*=/,                // const variable = 
            /^let\s+\w+\s*=/,                  // let variable =
            /^var\s+\w+\s*=/,                  // var variable =
            /^function\s+\w+\s*\(/,            // function name(
            /^class\s+\w+/,                    // class Name
            /^interface\s+\w+/,                // interface Name
            /^type\s+\w+\s*=/,                 // type Name =
            /^enum\s+\w+/,                     // enum Name
            /^\w+\s*\.\s*\w+\s*\(/,           // object.method(
            /^\w+\s*\(\s*.*\s*\)\s*\{/,       // function() {
            /^if\s*\(/,                        // if (
            /^for\s*\(/,                       // for (
            /^while\s*\(/,                     // while (
            /^return\s+/,                      // return 
            /^\}\s*else\s*\{/,                 // } else {
            /^\}\s*catch\s*\(/,                // } catch (
            /^\}\s*finally\s*\{/,              // } finally {
        ];

        return obviousCodePatterns.some(pattern => pattern.test(trimmed));
    }

    /**
     * 检查位置是否在字符串字面量中
     * 简单的启发式检查
     */
    private isInStringLiteral(lineText: string, position: number): boolean {
        const beforePosition = lineText.substring(0, position);

        // 计算前面未配对的引号数量
        let singleQuotes = 0;
        let doubleQuotes = 0;
        let backticks = 0;

        for (let i = 0; i < beforePosition.length; i++) {
            const char = beforePosition[i];
            const prevChar = i > 0 ? beforePosition[i - 1] : '';

            // 跳过转义字符
            if (prevChar === '\\') {
                continue;
            }

            switch (char) {
                case "'":
                    singleQuotes++;
                    break;
                case '"':
                    doubleQuotes++;
                    break;
                case '`':
                    backticks++;
                    break;
            }
        }

        // 如果有奇数个引号，说明在字符串中
        return (singleQuotes % 2 === 1) || (doubleQuotes % 2 === 1) || (backticks % 2 === 1);
    }/**
     * 检测多行注释块
     */
    private detectMultiLineComment(document: vscode.TextDocument, startLine: number): CommentInfo | null {
        const startLineText = document.lineAt(startLine).text;

        // 查找 /* 的位置，但要确保它是在有效位置
        const commentStartMatch = startLineText.match(/\/\*/);
        if (!commentStartMatch) {
            return null;
        }

        const startChar = commentStartMatch.index!;

        // 额外验证：确保 /* 之前只有空白字符
        const beforeComment = startLineText.substring(0, startChar);
        if (!/^\s*$/.test(beforeComment)) {
            // /* 前面有非空白字符，可能不是注释
            return null;
        }

        let endLine = startLine;
        let endChar = startLineText.length;
        let commentText = '';
        let foundEnd = false;

        // 查找注释结束位置
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const lineText = line.text;

            if (i === startLine) {
                // 检查是否在同一行结束
                const endMatch = lineText.substring(startChar).match(/\*\//);
                if (endMatch) {
                    const endIndex = startChar + endMatch.index! + 2;
                    endChar = endIndex;
                    commentText = lineText.substring(startChar, endChar);
                    foundEnd = true;
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
                    foundEnd = true;
                    break;
                } else {
                    commentText += '\n' + lineText;
                }
            }
        }

        // 如果没有找到结束标记，可能不是有效的注释
        if (!foundEnd) {
            return null;
        }

        // 验证提取的文本确实是注释格式
        const trimmedComment = commentText.trim();
        if (!trimmedComment.startsWith('/*') || !trimmedComment.endsWith('*/')) {
            return null;
        }

        // 确定注释类型
        let commentType = 'block';
        if (trimmedComment.startsWith('/**')) {
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
