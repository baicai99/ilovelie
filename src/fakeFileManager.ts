/**
 * .fake 文件管理器
 * 类似于 Git 的追踪机制，记录真话假话状态和文件修改信息
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TruthToggleState, HistoryRecord } from './types';

/**
 * .fake 文件中的单个文件记录
 */
export interface FakeFileRecord {
    /** 文件路径（相对于工作区） */
    filePath: string;
    /** 当前状态：真话还是假话 */
    currentState: TruthToggleState;
    /** 最后修改时间 */
    lastModified: number;
    /** 修改的行记录 */
    modifiedLines: ModifiedLineRecord[];
    /** 文件哈希值（用于检测文件是否被外部修改） */
    fileHash?: string;
}

/**
 * 修改的行记录
 */
export interface ModifiedLineRecord {
    /** 行号（从0开始） */
    lineNumber: number;
    /** 字符起始位置 */
    startCharacter: number;
    /** 字符结束位置 */
    endCharacter: number;
    /** 原始注释内容 */
    originalText: string;
    /** 假话注释内容 */
    fakeText: string;
    /** 修改时间 */
    modifiedTime: number;
    /** 修改类型 */
    modifyType: 'manual-replace' | 'dictionary-replace' | 'ai-replace' | 'ai-batch-replace' | 'ai-selective-replace' | 'hide-comment';
    /** 历史记录ID（关联到historyManager） */
    historyId: string;
}

/**
 * .fake 文件的完整结构
 */
export interface FakeFile {
    /** 版本号 */
    version: string;
    /** 创建时间 */
    createdAt: number;
    /** 最后更新时间 */
    lastUpdated: number;
    /** 工作区路径 */
    workspacePath: string;
    /** 文件记录 */
    files: FakeFileRecord[];
}

export class FakeFileManager {
    private static readonly FAKE_FILE_NAME = '.fake';
    private static readonly VERSION = '1.0.0';
    private fakeFilePath: string | null = null;
    private fakeData: FakeFile | null = null;

    constructor() {
        this.initializeFakeFile();
    }    /**
     * 初始化 .fake 文件
     */
    private async initializeFakeFile(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.warn('[FakeFileManager] 没有找到工作区文件夹');
            return;
        }

        this.fakeFilePath = path.join(workspaceFolder.uri.fsPath, FakeFileManager.FAKE_FILE_NAME);

        try {
            if (fs.existsSync(this.fakeFilePath)) {
                await this.loadFakeFile();
            } else {
                console.log('[FakeFileManager] .fake 文件不存在，创建新文件');
                await this.createNewFakeFile(workspaceFolder.uri.fsPath);
            }
        } catch (error) {
            console.error('[FakeFileManager] 初始化失败:', error);
            await this.createNewFakeFile(workspaceFolder.uri.fsPath);
        }
    }

    /**
     * 加载 .fake 文件
     */
    private async loadFakeFile(): Promise<void> {
        if (!this.fakeFilePath || !fs.existsSync(this.fakeFilePath)) {
            throw new Error('.fake 文件不存在');
        }

        const content = fs.readFileSync(this.fakeFilePath, 'utf8');
        this.fakeData = JSON.parse(content);

        // 验证版本兼容性
        if (this.fakeData?.version !== FakeFileManager.VERSION) {
            console.warn(`[FakeFileManager] .fake 文件版本不匹配: ${this.fakeData?.version} vs ${FakeFileManager.VERSION}`);
            // 可以在这里进行版本迁移逻辑
        }
    }

    /**
     * 创建新的 .fake 文件
     */
    private async createNewFakeFile(workspacePath: string): Promise<void> {
        this.fakeData = {
            version: FakeFileManager.VERSION,
            createdAt: Date.now(),
            lastUpdated: Date.now(),
            workspacePath: workspacePath,
            files: []
        };

        await this.saveFakeFile();
    }

    /**
     * 保存 .fake 文件
     */
    private async saveFakeFile(): Promise<void> {
        if (!this.fakeFilePath || !this.fakeData) {
            throw new Error('无法保存 .fake 文件：路径或数据为空');
        }

        this.fakeData.lastUpdated = Date.now();
        const content = JSON.stringify(this.fakeData, null, 2);
        fs.writeFileSync(this.fakeFilePath, content, 'utf8');
    }

    /**
     * 获取文件的相对路径
     */
    private getRelativePath(absolutePath: string): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return absolutePath;
        }

        return path.relative(workspaceFolder.uri.fsPath, absolutePath);
    }

    /**
     * 记录文件状态变更
     */
    public async recordFileStateChange(
        filePath: string,
        newState: TruthToggleState,
        modifiedLines: ModifiedLineRecord[] = []
    ): Promise<void> {
        if (!this.fakeData) {
            await this.initializeFakeFile();
        }

        const relativePath = this.getRelativePath(filePath);
        let fileRecord = this.fakeData!.files.find(f => f.filePath === relativePath);

        if (!fileRecord) {
            fileRecord = {
                filePath: relativePath,
                currentState: newState,
                lastModified: Date.now(),
                modifiedLines: [],
                fileHash: await this.calculateFileHash(filePath)
            };
            this.fakeData!.files.push(fileRecord);
        } else {
            fileRecord.currentState = newState;
            fileRecord.lastModified = Date.now();
            fileRecord.fileHash = await this.calculateFileHash(filePath);
        }

        // 更新修改的行记录
        for (const newLine of modifiedLines) {
            const existingLineIndex = fileRecord.modifiedLines.findIndex(
                line => line.lineNumber === newLine.lineNumber &&
                    line.startCharacter === newLine.startCharacter
            );

            if (existingLineIndex >= 0) {
                fileRecord.modifiedLines[existingLineIndex] = newLine;
            } else {
                fileRecord.modifiedLines.push(newLine);
            }
        }

        await this.saveFakeFile();
        console.log(`[FakeFileManager] 已记录文件状态变更: ${relativePath} -> ${newState}`);
    }

    /**
     * 记录历史变更到 .fake 文件
     */
    public async recordHistoryChange(historyRecord: HistoryRecord): Promise<void> {
        const modifiedLine: ModifiedLineRecord = {
            lineNumber: historyRecord.startPosition.line,
            startCharacter: historyRecord.startPosition.character,
            endCharacter: historyRecord.endPosition.character,
            originalText: historyRecord.originalText,
            fakeText: historyRecord.newText,
            modifiedTime: historyRecord.timestamp,
            modifyType: historyRecord.type,
            historyId: historyRecord.id
        };

        await this.recordFileStateChange(
            historyRecord.filePath,
            TruthToggleState.LIE,
            [modifiedLine]
        );
    }

    /**
     * 获取文件的当前状态
     */
    public getFileState(filePath: string): TruthToggleState {
        if (!this.fakeData) {
            return TruthToggleState.TRUTH;
        }

        const relativePath = this.getRelativePath(filePath);
        const fileRecord = this.fakeData.files.find(f => f.filePath === relativePath);
        return fileRecord?.currentState || TruthToggleState.TRUTH;
    }

    /**
     * 获取文件的修改记录
     */
    public getFileModifiedLines(filePath: string): ModifiedLineRecord[] {
        if (!this.fakeData) {
            return [];
        }

        const relativePath = this.getRelativePath(filePath);
        const fileRecord = this.fakeData.files.find(f => f.filePath === relativePath);
        return fileRecord?.modifiedLines || [];
    }

    /**
     * 检查文件是否有撒谎记录
     */
    public hasLiesInFile(filePath: string): boolean {
        const modifiedLines = this.getFileModifiedLines(filePath);
        return modifiedLines.length > 0;
    }

    /**
     * 获取所有有撒谎记录的文件
     */
    public getAllFilesWithLies(): string[] {
        if (!this.fakeData) {
            return [];
        }

        return this.fakeData.files
            .filter(file => file.modifiedLines.length > 0)
            .map(file => file.filePath);
    }

    /**
     * 清理文件记录（当文件被删除时）
     */
    public async cleanupFileRecord(filePath: string): Promise<void> {
        if (!this.fakeData) {
            return;
        }

        const relativePath = this.getRelativePath(filePath);
        const index = this.fakeData.files.findIndex(f => f.filePath === relativePath);

        if (index >= 0) {
            this.fakeData.files.splice(index, 1);
            await this.saveFakeFile();
            console.log(`[FakeFileManager] 已清理文件记录: ${relativePath}`);
        }
    }

    /**
     * 清理指定行的记录
     */
    public async cleanupLineRecord(filePath: string, lineNumber: number, startCharacter: number): Promise<void> {
        if (!this.fakeData) {
            return;
        }

        const relativePath = this.getRelativePath(filePath);
        const fileRecord = this.fakeData.files.find(f => f.filePath === relativePath);

        if (fileRecord) {
            const index = fileRecord.modifiedLines.findIndex(
                line => line.lineNumber === lineNumber && line.startCharacter === startCharacter
            );

            if (index >= 0) {
                fileRecord.modifiedLines.splice(index, 1);

                // 如果没有修改行了，更新状态为真话
                if (fileRecord.modifiedLines.length === 0) {
                    fileRecord.currentState = TruthToggleState.TRUTH;
                }

                await this.saveFakeFile();
                console.log(`[FakeFileManager] 已清理行记录: ${relativePath}:${lineNumber}`);
            }
        }
    }

    /**
     * 计算文件哈希值（简单实现）
     */
    private async calculateFileHash(filePath: string): Promise<string> {
        try {
            if (!fs.existsSync(filePath)) {
                return '';
            }

            const content = fs.readFileSync(filePath, 'utf8');
            // 简单的哈希算法
            let hash = 0;
            for (let i = 0; i < content.length; i++) {
                const char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            return hash.toString();
        } catch (error) {
            console.warn(`[FakeFileManager] 计算文件哈希失败: ${error}`);
            return '';
        }
    }

    /**
     * 检查文件是否被外部修改
     */
    public async checkFileIntegrity(filePath: string): Promise<boolean> {
        if (!this.fakeData) {
            return true;
        }

        const relativePath = this.getRelativePath(filePath);
        const fileRecord = this.fakeData.files.find(f => f.filePath === relativePath);

        if (!fileRecord || !fileRecord.fileHash) {
            return true; // 没有记录则认为完整
        }

        const currentHash = await this.calculateFileHash(filePath);
        return currentHash === fileRecord.fileHash;
    }

    /**
     * 获取 .fake 文件的统计信息
     */
    public getStatistics(): {
        totalFiles: number;
        filesWithLies: number;
        totalModifiedLines: number;
        createdAt: number;
        lastUpdated: number;
    } {
        if (!this.fakeData) {
            return {
                totalFiles: 0,
                filesWithLies: 0,
                totalModifiedLines: 0,
                createdAt: 0,
                lastUpdated: 0
            };
        }

        const filesWithLies = this.fakeData.files.filter(f => f.modifiedLines.length > 0);
        const totalModifiedLines = this.fakeData.files.reduce(
            (sum, file) => sum + file.modifiedLines.length,
            0
        );

        return {
            totalFiles: this.fakeData.files.length,
            filesWithLies: filesWithLies.length,
            totalModifiedLines,
            createdAt: this.fakeData.createdAt,
            lastUpdated: this.fakeData.lastUpdated
        };
    }

    /**
     * 导出 .fake 文件内容（用于调试或备份）
     */
    public exportFakeData(): FakeFile | null {
        return this.fakeData;
    }

    /**
     * 重新初始化（强制重新加载）
     */
    public async reinitialize(): Promise<void> {
        this.fakeData = null;
        this.fakeFilePath = null;
        await this.initializeFakeFile();
    }
}
