/**
 * 类型定义文件
 * 包含插件所有的接口和类型定义
 */

/**
 * 真话假话切换状态枚举
 */
export enum TruthToggleState {
    /** 显示真话（原始注释） */
    TRUTH = 'truth',
    /** 显示假话（替换后的注释） */
    LIE = 'lie'
}

/**
 * 切换状态信息接口
 */
export interface ToggleStateInfo {
    /** 当前状态 */
    currentState: TruthToggleState;
    /** 上次切换时间 */
    lastToggleTime: number;
    /** 文档URI */
    documentUri: string;
    /** 是否已经应用了撒谎 */
    hasLies: boolean;
}

/**
 * 切换操作结果接口
 */
export interface ToggleResult {
    /** 操作是否成功 */
    success: boolean;
    /** 切换后的状态 */
    newState: TruthToggleState;
    /** 影响的注释数量 */
    affectedComments: number;
    /** 错误信息（如果有） */
    errorMessage?: string;
}

/**
 * 历史记录接口
 */
export interface HistoryRecord {
    id: string; // 唯一ID
    filePath: string;
    originalText: string;
    newText: string;
    timestamp: number;
    type: 'manual-replace' | 'dictionary-replace' | 'ai-replace' | 'ai-batch-replace' | 'ai-selective-replace' | 'hide-comment' | 'session-start';
    // 位置信息，使还原更准确
    startPosition: { line: number; character: number };
    endPosition: { line: number; character: number };
    // 会话ID，用于标识一批相关的操作
    sessionId?: string;
    // 是否为当前活跃会话的记录
    isActive?: boolean;
    // 会话结束时间（用于历史版本管理）
    sessionEndTime?: number;
    // 历史版本号（同一位置的多次修改）
    versionNumber?: number;
    // 当前文档快照，用于可靠还原
    fileSnapshot?: string;
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
