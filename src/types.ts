/**
 * 类型定义文件
 * 包含插件所有的接口和类型定义
 */

/**
 * 历史记录接口
 */
export interface HistoryRecord {
    id: string; // 唯一ID
    filePath: string;
    originalText: string;
    newText: string;
    timestamp: number;
    type: 'manual-replace' | 'dictionary-replace' | 'ai-replace' | 'ai-batch-replace' | 'ai-selective-replace' | 'hide-comment';
    // 位置信息，使还原更准确
    startPosition: { line: number; character: number };
    endPosition: { line: number; character: number };
}

/**
 * 支持的编程语言类型
 */
export type SupportedLanguage =
    | 'javascript'
    | 'typescript'
    | 'java'
    | 'csharp'
    | 'cpp'
    | 'c'
    | 'python'
    | 'ruby'
    | 'shell'
    | 'html'
    | 'xml'
    | 'css'
    | 'scss'
    | 'less'
    | 'other';

/**
 * 注释格式类型
 */
export type CommentFormat =
    | 'single-line-slash' // //
    | 'single-line-hash'  // #
    | 'multi-line-star'   // /* */
    | 'jsdoc-comment'     // /** */
    | 'html-comment';     // <!-- -->

/**
 * 注释信息接口
 */
export interface CommentInfo {
    text: string;
    range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    type: string;
}

/**
 * 单个注释替换结果接口
 */
export interface SingleReplaceResult {
    success: boolean;
    originalText: string;
    newText: string;
    lineNumber: number;
}

/**
 * 替换结果接口
 */
export interface ReplaceResult {
    success: boolean;
    replacedCount: number;
    errorMessage?: string;
}

/**
 * 恢复结果接口
 */
export interface RestoreResult {
    success: boolean;
    restoredCount: number;
    restoredRecords?: HistoryRecord[]; // 实际成功还原的记录列表
    errorMessage?: string;
}

/**
 * 扫描到的注释项接口
 */
export interface ScannedComment {
    /** 注释原始内容 */
    content: string;
    /** 注释在文档中的范围 */
    range: any; // vscode.Range
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
