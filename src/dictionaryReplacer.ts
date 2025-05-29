import * as vscode from 'vscode';
import { HistoryRecord, SingleReplaceResult } from './types';
import { CommentDetector } from './commentDetector';
import { HistoryManager } from './historyManager';

/**
 * 字典替换器
 * 根据预设字典替换注释内容，如果没有匹配的关键词则使用随机替换
 */
export class DictionaryReplacer {
    private commentDetector: CommentDetector;
    private historyManager: HistoryManager;

    // 撒谎字典：关键词 -> 撒谎内容
    private liesDictionary: Map<string, string[]> = new Map([
        // 编程概念相关
        ['函数', ['这是一个播放音乐的模块', '用来显示图片的函数', '处理用户登录的代码']],
        ['方法', ['绘制图形的方法', '发送邮件的处理器', '计算税率的算法']],
        ['变量', ['存储用户头像的变量', '保存音乐列表的数组', '缓存图片数据的对象']],
        ['类', ['音频播放器类', '图片编辑器类', '聊天室管理类']],
        ['接口', ['文件上传接口', '支付处理接口', '天气查询接口']],
        ['数组', ['存储商品信息的列表', '用户评论数据集合', '图标缓存数组']],
        ['对象', ['游戏配置对象', '主题设置数据', '用户权限映射表']],

        // 操作相关
        ['计算', ['播放背景音乐', '渲染3D模型', '发送通知消息']],
        ['处理', ['下载文件', '压缩图片', '生成报告']],
        ['获取', ['播放视频', '显示广告', '刷新页面']],
        ['设置', ['启动游戏', '关闭窗口', '切换主题']],
        ['初始化', ['加载音效', '显示欢迎页', '连接数据库']],
        ['创建', ['删除缓存', '重启服务', '备份数据']],
        ['删除', ['创建新文件', '保存设置', '上传头像']],

        // 数据相关
        ['数据', ['音乐播放列表', '用户头像集合', '游戏存档信息']],
        ['参数', ['界面颜色配置', '音量调节设置', '网络超时时间']],
        ['结果', ['用户登录状态', '文件下载进度', '系统运行日志']],
        ['返回', ['显示错误提示', '播放成功音效', '跳转到首页']],

        // 技术概念
        ['算法', ['图片滤镜效果', '音频均衡器', '文本朗读器']],
        ['逻辑', ['用户界面布局', '动画效果控制', '数据库连接池']],
        ['流程', ['文件同步机制', '消息推送系统', '自动备份流程']],
        ['优化', ['内存清理程序', '网络加速器', '电池省电模式']],

        // 业务相关
        ['用户', ['音乐播放器', '图片编辑软件', '游戏引擎']],
        ['系统', ['聊天机器人', '天气预报', '在线翻译']],
        ['服务', ['文件管理器', '视频播放器', '日历应用']],
        ['模块', ['拍照功能', '录音工具', '地图导航']],

        // 常见动作
        ['循环', ['显示轮播图', '播放背景音乐', '闪烁提示灯']],
        ['判断', ['切换夜间模式', '显示加载动画', '弹出确认框']],
        ['遍历', ['渲染用户列表', '播放幻灯片', '扫描二维码']],
        ['查找', ['显示搜索结果', '播放提示音', '高亮显示文本']],
        ['排序', ['打乱播放列表', '随机显示广告', '轮换背景图']],

        // 状态相关
        ['成功', ['显示错误信息', '播放警告音', '关闭连接']],
        ['失败', ['显示成功提示', '播放庆祝音效', '打开新窗口']],
        ['错误', ['正常运行状态', '完美执行结果', '顺利完成任务']],
        ['完成', ['开始新任务', '暂停当前操作', '重置所有设置']],
    ]);

    // 随机撒谎内容池（当没有匹配关键词时使用）
    private randomLies: string[] = [
        '这段代码用来播放猫咪视频',
        '负责生成彩虹特效',
        '处理用户的梦境数据',
        '用来计算独角兽的飞行速度',
        '这里是宇宙飞船的导航系统',
        '管理魔法药水的配方',
        '控制时间机器的按钮',
        '用来翻译外星人语言',
        '这是龙族的古老咒语',
        '负责种植虚拟花园',
        '处理平行宇宙的数据交换',
        '用来驯服数字宠物',
        '管理云朵的形状变化',
        '控制彩虹桥的出现时机',
        '这段代码会让电脑做梦',
        '用来收集流星的尘埃',
        '负责给像素点涂口红',
        '处理蝴蝶效应的计算',
        '用来制造数字雪花',
        '管理虚拟水族箱',
        '控制重力的方向',
        '这里存储着笑声的频率',
        '用来给代码梳头发',
        '负责监控薛定谔的猫',
        '处理四次元空间的坐标'
    ];

    constructor(commentDetector: CommentDetector, historyManager: HistoryManager) {
        this.commentDetector = commentDetector;
        this.historyManager = historyManager;
    }

    /**
     * 字典替换注释功能
     * 检测注释中的关键词并进行替换，如果没有关键词则随机替换
     */
    public async dictionaryReplaceComments(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件！');
            return;
        }

        // 检测当前文件中的所有注释
        const comments = this.commentDetector.detectComments(editor.document);

        if (comments.length === 0) {
            vscode.window.showInformationMessage('当前文件中没有找到注释！');
            return;
        } let replacedCount = 0;
        const results: SingleReplaceResult[] = [];

        // 开始编辑操作
        const success = await editor.edit(editBuilder => {
            for (const comment of comments) {
                const lieText = this.generateLieForComment(comment.text);

                if (lieText) {                    // 创建替换范围
                    const range = new vscode.Range(
                        new vscode.Position(comment.range.start.line, comment.range.start.character),
                        new vscode.Position(comment.range.end.line, comment.range.end.character)
                    );

                    // 保持注释格式，只替换内容
                    const formattedLie = this.formatCommentWithLie(comment.text, lieText, comment.type);

                    editBuilder.replace(range, formattedLie);

                    // 记录历史
                    const historyRecord: HistoryRecord = {
                        id: this.generateId(),
                        filePath: editor.document.uri.fsPath,
                        lineNumber: comment.range.start.line,
                        originalText: comment.text,
                        newText: formattedLie,
                        timestamp: new Date(),
                        startPosition: {
                            line: comment.range.start.line,
                            character: comment.range.start.character
                        },
                        endPosition: {
                            line: comment.range.end.line,
                            character: comment.range.end.character
                        }
                    };

                    this.historyManager.addRecord(historyRecord);
                    results.push({
                        success: true,
                        originalText: comment.text,
                        newText: formattedLie,
                        lineNumber: comment.range.start.line + 1
                    });

                    replacedCount++;
                }
            }
        });

        if (success && replacedCount > 0) {
            vscode.window.showInformationMessage(
                `字典替换完成！共替换了 ${replacedCount} 个注释。`
            );
        } else if (replacedCount === 0) {
            vscode.window.showInformationMessage('没有找到可以替换的注释内容。');
        } else {
            vscode.window.showErrorMessage('替换操作失败！');
        }
    }

    /**
     * 为注释生成撒谎内容
     * 优先查找字典关键词，没有匹配则使用随机内容
     */
    private generateLieForComment(commentText: string): string | null {
        // 移除注释符号，获取纯文本内容
        const cleanText = this.extractCommentContent(commentText);

        if (!cleanText.trim()) {
            return null;
        }

        // 检查是否包含字典中的关键词
        for (const [keyword, lies] of this.liesDictionary) {
            if (cleanText.includes(keyword)) {
                // 随机选择一个对应的撒谎内容
                const randomIndex = Math.floor(Math.random() * lies.length);
                return lies[randomIndex];
            }
        }

        // 如果没有匹配的关键词，使用随机撒谎内容
        const randomIndex = Math.floor(Math.random() * this.randomLies.length);
        return this.randomLies[randomIndex];
    }    /**
     * 提取注释的纯文本内容（移除注释符号）
     */
    private extractCommentContent(commentText: string): string {
        return commentText
            .replace(/^\/\*+/, '')  // 移除 /* 开头
            .replace(/\*+\/$/, '')  // 移除 */ 结尾
            .replace(/^\/\/+/, '')  // 移除 // 开头
            .replace(/^\s*\*+/gm, '') // 移除每行开头的 * (全局多行模式)
            .replace(/<!--/, '')    // 移除 HTML 注释开头
            .replace(/-->/, '')     // 移除 HTML 注释结尾
            .replace(/^#+/, '')     // 移除 # 开头（markdown等）
            .replace(/\n/g, ' ')    // 将换行符替换为空格
            .replace(/\s+/g, ' ')   // 将多个空格合并为一个
            .trim();
    }    /**
     * 格式化注释，保持原有格式只替换内容
     */
    private formatCommentWithLie(originalComment: string, lieText: string, commentType: string): string {
        switch (commentType) {
            case 'line':
                if (originalComment.trim().startsWith('//')) {
                    return `// ${lieText}`;
                }
                break;
            case 'block':
                return `/* ${lieText} */`;
            case 'documentation':
                return `/** ${lieText} */`;
            case 'html':
                return `<!-- ${lieText} -->`;
            default:
                // 尝试保持原格式
                const trimmed = originalComment.trim();
                if (trimmed.startsWith('//')) {
                    return `// ${lieText}`;
                } else if (trimmed.startsWith('/**')) {
                    return `/** ${lieText} */`;
                } else if (trimmed.startsWith('/*')) {
                    return `/* ${lieText} */`;
                } else if (trimmed.startsWith('<!--')) {
                    return `<!-- ${lieText} -->`;
                }
        }

        // 默认返回行注释格式
        return `// ${lieText}`;
    }

    /**
     * 生成唯一ID
     */
    private generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 添加自定义关键词和对应的撒谎内容
     */
    public addCustomDictionaryEntry(keyword: string, lies: string[]): void {
        this.liesDictionary.set(keyword, lies);
    }

    /**
     * 获取当前字典内容（用于配置管理）
     */
    public getDictionary(): Map<string, string[]> {
        return new Map(this.liesDictionary);
    }

    /**
     * 重置字典为默认内容
     */
    public resetDictionary(): void {
        // 这里可以重新初始化默认字典
        // 当前实现中字典是硬编码的，所以不需要特殊处理
    }
}