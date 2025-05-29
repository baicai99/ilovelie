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
    lineNumber: number;
    originalText: string;
    newText: string;
    timestamp: Date;
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
    errorMessage?: string;
}
