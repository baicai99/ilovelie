import { ScannedComment } from '../comment/commentScanner';

/**
 * 注释格式化工具类
 * 统一处理不同类型注释的格式化逻辑，避免代码重复
 */
export class CommentFormatter {
    /**
     * 格式化注释，保持原有格式只替换内容
     * @param comment 扫描到的注释对象
     * @param newContent 新的注释内容（纯文本）
     * @returns 格式化后的完整注释字符串
     */
    static formatComment(comment: ScannedComment, newContent: string): string {
        const prefix = CommentFormatter.getPrefix(comment.indentation);
        switch (comment.format) {
            case 'single-line-slash':
                return `${prefix}// ${newContent}`;

            case 'single-line-hash':
                return `${prefix}# ${newContent}`;

            case 'multi-line-star':
                // 单行的多行注释
                if (comment.multiLinePosition === 'single') {
                    return `${prefix}/* ${newContent} */`;
                }
                // 多行注释块，使用统一结构避免替换失败
                return CommentFormatter.formatMultiLineBlock(prefix, newContent);

            case 'jsdoc-comment':
                return `${prefix}/** ${newContent} */`;

            case 'html-comment':
                return `${prefix}<!-- ${newContent} -->`;

            default:
                // 默认使用行注释格式
                return `${prefix}// ${newContent}`;
        }
    }

    /**
     * 根据注释类型格式化（简化版本，当没有 ScannedComment 对象时使用）
     * @param commentType 注释类型
     * @param newContent 新的注释内容
     * @param indentation 缩进（可选）
     * @returns 格式化后的注释字符串
     */
    static formatByType(
        commentType: 'line' | 'block' | 'documentation' | 'html',
        newContent: string,
        indentation: string = ''
    ): string {
        switch (commentType) {
            case 'line':
                return `${indentation}// ${newContent}`;
            case 'block':
                return `${indentation}/* ${newContent} */`;
            case 'documentation':
                return `${indentation}/** ${newContent} */`;
            case 'html':
                return `${indentation}<!-- ${newContent} -->`;
            default:
                return `${indentation}// ${newContent}`;
        }
    }

    /**
     * 从格式字符串转换为注释类型
     * @param format 格式字符串
     * @returns 注释类型
     */
    static formatToType(format: string): 'line' | 'block' | 'documentation' | 'html' {
        switch (format) {
            case 'single-line-slash':
            case 'single-line-hash':
                return 'line';
            case 'jsdoc-comment':
                return 'documentation';
            case 'multi-line-star':
                return 'block';
            case 'html-comment':
                return 'html';
            default:
                return 'line';
        }
    }

    private static formatMultiLineBlock(indentation: string, content: string): string {
        const lines = content.split(/\r?\n/);
        const formattedLines = lines.map(line => {
            return line.length > 0 ? `${indentation} * ${line}` : `${indentation} *`;
        });

        return `${indentation}/*\n${formattedLines.join('\n')}\n${indentation} */`;
    }

    private static getPrefix(indentation: string): string {
        return indentation.trim().length === 0 ? indentation : '';
    }
}
