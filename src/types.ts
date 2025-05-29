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
 * 临时还原状态接口
 */
export interface TempRestoreState {
    filePath: string;
    restoredRecords: HistoryRecord[];
    isTemporarilyRestored: boolean;
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
