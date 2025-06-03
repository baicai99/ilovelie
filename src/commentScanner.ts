/**
 * 注释扫描器类
 * 核心扫描类，负责扫描文档中的所有注释并返回结构化数据
 * 其他所有替换功能都基于此类的扫描结果进行操作
 */
import * as vscode from 'vscode';
import { CommentDetector } from './commentDetector';
import { SupportedLanguage, CommentFormat } from './types';

/**
 * 扫描到的注释项接口
 */
export interface ScannedComment {
    /** 注释原始内容 */
    content: string;
    /** 注释在文档中的范围 */
    range: vscode.Range;
    /** 注释所在行号（从0开始） */
    lineNumber: number;
    /** 注释类型（单行、多行等） */
    format: CommentFormat;
    /** 注释前的缩进 */
    indentation: string;
    /** 是否是多行注释的一部分 */
    isMultiLinePart: boolean;
    /** 如果是多行注释，标记是开始、中间还是结束 */
    multiLinePosition?: 'start' | 'middle' | 'end' | 'single';
    /** 纯净的注释文本（去除注释符号） */
    cleanText: string;
}

/**
 * 扫描结果接口
 */
export interface ScanResult {
    /** 扫描是否成功 */
    success: boolean;
    /** 找到的注释总数 */
    totalComments: number;
    /** 扫描到的所有注释 */
    comments: ScannedComment[];
    /** 扫描的文档信息 */
    documentInfo: {
        fileName: string;
        languageId: string;
        totalLines: number;
    };
    /** 错误信息（如果有） */
    errorMessage?: string;
}

/**
 * 注释扫描器
 */
export class CommentScanner {
    private commentDetector: CommentDetector;

    constructor() {
        this.commentDetector = new CommentDetector();
    }

    /**
     * 扫描当前活动文档中的所有注释
     * @returns 扫描结果
     */
    public async scanActiveDocument(): Promise<ScanResult> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                success: false,
                totalComments: 0,
                comments: [],
                documentInfo: {
                    fileName: '',
                    languageId: '',
                    totalLines: 0
                },
                errorMessage: '没有打开的活动文档'
            };
        }

        return this.scanDocument(editor.document);
    }    /**
     * 扫描指定文档中的所有注释
     * @param document 要扫描的文档
     * @returns 扫描结果
     */
    public async scanDocument(document: vscode.TextDocument): Promise<ScanResult> {
        try {
            const comments: ScannedComment[] = [];
            const languageId = document.languageId;
            const totalLines = document.lineCount;

            // 使用CommentDetector的detectComments方法来获取所有注释
            const detectedComments = this.commentDetector.detectComments(document);

            // 转换为ScannedComment格式
            for (const comment of detectedComments) {
                const startPos = new vscode.Position(comment.range.start.line, comment.range.start.character);
                const endPos = new vscode.Position(comment.range.end.line, comment.range.end.character);
                const range = new vscode.Range(startPos, endPos);

                // 获取注释的完整文本
                const commentText = document.getText(range);
                const format = this.commentDetector.getCommentFormat(commentText, languageId);

                // 获取缩进
                const startLine = document.lineAt(comment.range.start.line);
                const indentation = startLine.text.substring(0, comment.range.start.character);

                // 确定多行注释的位置信息
                let isMultiLinePart = false;
                let multiLinePosition: 'start' | 'middle' | 'end' | 'single' = 'single';

                if (comment.type === 'block' || comment.type === 'documentation') {
                    isMultiLinePart = comment.range.start.line !== comment.range.end.line;
                    if (isMultiLinePart) {
                        multiLinePosition = 'start'; // 对于多行注释，我们将整个块标记为start
                    }
                }

                const cleanText = this.extractCleanCommentText(commentText, format);

                const scannedComment: ScannedComment = {
                    content: commentText,
                    range: range,
                    lineNumber: comment.range.start.line,
                    format: format,
                    indentation: indentation,
                    isMultiLinePart: isMultiLinePart,
                    multiLinePosition: multiLinePosition,
                    cleanText: cleanText
                };

                comments.push(scannedComment);
            }

            return {
                success: true,
                totalComments: comments.length,
                comments: comments,
                documentInfo: {
                    fileName: document.fileName,
                    languageId: languageId,
                    totalLines: totalLines
                }
            };

        } catch (error) {
            return {
                success: false,
                totalComments: 0,
                comments: [],
                documentInfo: {
                    fileName: document.fileName,
                    languageId: document.languageId,
                    totalLines: document.lineCount
                },
                errorMessage: `扫描注释时发生错误: ${error}`
            };
        }
    }

    /**
     * 扫描指定范围内的注释
     * @param document 文档
     * @param range 扫描范围
     * @returns 扫描结果
     */
    public async scanRange(document: vscode.TextDocument, range: vscode.Range): Promise<ScanResult> {
        try {
            const fullScanResult = await this.scanDocument(document);
            if (!fullScanResult.success) {
                return fullScanResult;
            }

            // 过滤出在指定范围内的注释
            const commentsInRange = fullScanResult.comments.filter(comment => {
                return range.contains(comment.range);
            });

            return {
                ...fullScanResult,
                totalComments: commentsInRange.length,
                comments: commentsInRange
            };

        } catch (error) {
            return {
                success: false,
                totalComments: 0,
                comments: [],
                documentInfo: {
                    fileName: document.fileName,
                    languageId: document.languageId,
                    totalLines: document.lineCount
                },
                errorMessage: `扫描范围注释时发生错误: ${error}`
            };
        }
    }

    /**
     * 根据类型过滤注释
     * @param scanResult 扫描结果
     * @param formats 要保留的注释格式
     * @returns 过滤后的注释列表
     */
    public filterCommentsByFormat(scanResult: ScanResult, formats: CommentFormat[]): ScannedComment[] {
        return scanResult.comments.filter(comment => formats.includes(comment.format));
    }

    /**
     * 根据关键词过滤注释
     * @param scanResult 扫描结果
     * @param keywords 关键词列表
     * @param caseSensitive 是否大小写敏感
     * @returns 包含关键词的注释列表
     */
    public filterCommentsByKeywords(
        scanResult: ScanResult,
        keywords: string[],
        caseSensitive: boolean = false
    ): ScannedComment[] {
        return scanResult.comments.filter(comment => {
            const textToSearch = caseSensitive ? comment.cleanText : comment.cleanText.toLowerCase();
            const searchKeywords = caseSensitive ? keywords : keywords.map(k => k.toLowerCase());

            return searchKeywords.some(keyword => textToSearch.includes(keyword));
        });
    }

    /**
     * 获取扫描统计信息
     * @param scanResult 扫描结果
     * @returns 统计信息
     */
    public getStatistics(scanResult: ScanResult): {
        totalComments: number;
        singleLineComments: number;
        multiLineComments: number;
        formatBreakdown: Record<CommentFormat, number>;
    } {
        const stats = {
            totalComments: scanResult.totalComments,
            singleLineComments: 0,
            multiLineComments: 0,
            formatBreakdown: {} as Record<CommentFormat, number>
        };

        scanResult.comments.forEach(comment => {
            // 统计格式
            if (!stats.formatBreakdown[comment.format]) {
                stats.formatBreakdown[comment.format] = 0;
            }
            stats.formatBreakdown[comment.format]++;            // 统计单行/多行
            if (comment.format === 'multi-line-star' || comment.format === 'jsdoc-comment') {
                stats.multiLineComments++;
            } else {
                stats.singleLineComments++;
            }
        });

        return stats;
    }

    /**
     * 提取纯净的注释文本（去除注释符号）
     * @param commentText 原始注释文本
     * @param format 注释格式
     * @returns 清理后的文本
     */
    private extractCleanCommentText(commentText: string, format: CommentFormat): string {
        const trimmed = commentText.trim();

        switch (format) {
            case 'single-line-slash':
                return trimmed.replace(/^\/\/\s*/, ''); case 'single-line-hash':
                return trimmed.replace(/^#\s*/, '');

            case 'jsdoc-comment':
                // 处理JSDoc注释
                let jsdocClean = trimmed;
                if (jsdocClean.startsWith('/**')) {
                    jsdocClean = jsdocClean.substring(3);
                }
                if (jsdocClean.endsWith('*/')) {
                    jsdocClean = jsdocClean.substring(0, jsdocClean.length - 2);
                }
                // 移除每行开头的 * 符号
                jsdocClean = jsdocClean.split('\n').map(line => {
                    const cleanLine = line.trim();
                    return cleanLine.startsWith('*') ? cleanLine.substring(1).trim() : cleanLine;
                }).join('\n');
                return jsdocClean.trim();

            case 'multi-line-star':
                // 处理多行注释
                let clean = trimmed;
                if (clean.startsWith('/*')) {
                    clean = clean.substring(2);
                }
                if (clean.endsWith('*/')) {
                    clean = clean.substring(0, clean.length - 2);
                }
                if (clean.startsWith('*')) {
                    clean = clean.substring(1);
                }
                return clean.trim();

            case 'html-comment':
                return trimmed.replace(/^<!--\s*/, '').replace(/\s*-->$/, '');

            default:
                return trimmed;
        }
    }
}