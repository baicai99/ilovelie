/**
 * .fake 文件命令管理器
 * 提供 .fake 文件的查看、管理和维护功能
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FakeFileManager } from './fakeFileManager';
import { HistoryManager } from './historyManager';

export class FakeFileCommands {
    private fakeFileManager: FakeFileManager;
    private historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
        this.fakeFileManager = historyManager.getFakeFileManager();
    }

    /**
     * 显示 .fake 文件状态
     */
    public async showFakeFileStatus(): Promise<void> {
        try {
            const stats = this.fakeFileManager.getStatistics();
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

            if (!workspaceFolder) {
                vscode.window.showErrorMessage('没有打开的工作区');
                return;
            }

            const fakeFilePath = path.join(workspaceFolder.uri.fsPath, '.fake');
            const fakeFileExists = fs.existsSync(fakeFilePath);

            let statusMessage = `📄 .fake 文件状态报告\n\n`;
            statusMessage += `文件位置: ${fakeFileExists ? '✅ 存在' : '❌ 不存在'}\n`;
            statusMessage += `路径: ${fakeFilePath}\n\n`;

            if (fakeFileExists) {
                statusMessage += `📊 统计信息:\n`;
                statusMessage += `• 总文件数: ${stats.totalFiles}\n`;
                statusMessage += `• 有撒谎记录的文件: ${stats.filesWithLies}\n`;
                statusMessage += `• 总修改行数: ${stats.totalModifiedLines}\n`;
                statusMessage += `• 创建时间: ${new Date(stats.createdAt).toLocaleString()}\n`;
                statusMessage += `• 最后更新: ${new Date(stats.lastUpdated).toLocaleString()}\n\n`;

                const allFilesWithLies = this.fakeFileManager.getAllFilesWithLies();
                if (allFilesWithLies.length > 0) {
                    statusMessage += `📝 有撒谎记录的文件列表:\n`;
                    allFilesWithLies.forEach(file => {
                        const modifiedLines = this.fakeFileManager.getFileModifiedLines(path.join(workspaceFolder.uri.fsPath, file));
                        statusMessage += `• ${file} (${modifiedLines.length} 行)\n`;
                    });
                }
            } else {
                statusMessage += `❓ .fake 文件不存在，可能是:\n`;
                statusMessage += `• 工作区还没有进行过撒谎操作\n`;
                statusMessage += `• .fake 文件被意外删除\n`;
                statusMessage += `• 插件初始化失败\n`;
            }

            // 显示状态信息
            const action = await vscode.window.showInformationMessage(
                statusMessage,
                { modal: true },
                '刷新状态',
                '打开.fake文件',
                '重新初始化'
            );

            if (action === '刷新状态') {
                await this.showFakeFileStatus();
            } else if (action === '打开.fake文件' && fakeFileExists) {
                const doc = await vscode.workspace.openTextDocument(fakeFilePath);
                await vscode.window.showTextDocument(doc);
            } else if (action === '重新初始化') {
                await this.reinitializeFakeFile();
            }

        } catch (error) {
            vscode.window.showErrorMessage(`显示 .fake 文件状态失败: ${error}`);
        }
    }

    /**
     * 清理 .fake 文件
     */
    public async cleanupFakeFile(): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('没有打开的工作区');
                return;
            }

            const action = await vscode.window.showWarningMessage(
                '🧹 清理 .fake 文件选项',
                { modal: true },
                '清理无效记录',
                '清理指定文件',
                '完全重置',
                '取消'
            );

            if (!action || action === '取消') {
                return;
            }

            if (action === '清理无效记录') {
                await this.cleanupInvalidRecords();
            } else if (action === '清理指定文件') {
                await this.cleanupSpecificFile();
            } else if (action === '完全重置') {
                await this.resetFakeFile();
            }

        } catch (error) {
            vscode.window.showErrorMessage(`清理 .fake 文件失败: ${error}`);
        }
    }

    /**
     * 导出 .fake 文件
     */
    public async exportFakeFile(): Promise<void> {
        try {
            const fakeData = this.fakeFileManager.exportFakeData();
            if (!fakeData) {
                vscode.window.showWarningMessage('没有可导出的 .fake 文件数据');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('没有打开的工作区');
                return;
            }

            const action = await vscode.window.showInformationMessage(
                '选择导出格式',
                'JSON格式',
                '可读格式',
                '备份文件',
                '取消'
            );

            if (!action || action === '取消') {
                return;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let fileName = '';
            let content = '';

            if (action === 'JSON格式') {
                fileName = `fake-export-${timestamp}.json`;
                content = JSON.stringify(fakeData, null, 2);
            } else if (action === '可读格式') {
                fileName = `fake-report-${timestamp}.txt`;
                content = this.formatFakeDataAsText(fakeData);
            } else if (action === '备份文件') {
                fileName = `fake-backup-${timestamp}.fake`;
                content = JSON.stringify(fakeData, null, 2);
            }

            const exportPath = path.join(workspaceFolder.uri.fsPath, fileName);
            fs.writeFileSync(exportPath, content, 'utf8');

            const openAction = await vscode.window.showInformationMessage(
                `✅ 导出成功: ${fileName}`,
                '打开文件',
                '显示在资源管理器'
            );

            if (openAction === '打开文件') {
                const doc = await vscode.workspace.openTextDocument(exportPath);
                await vscode.window.showTextDocument(doc);
            } else if (openAction === '显示在资源管理器') {
                vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(exportPath));
            }

        } catch (error) {
            vscode.window.showErrorMessage(`导出 .fake 文件失败: ${error}`);
        }
    }

    /**
     * 清理无效记录
     */    private async cleanupInvalidRecords(): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const allFilesWithLies = this.fakeFileManager.getAllFilesWithLies();
        let cleanedCount = 0;

        for (const relativeFilePath of allFilesWithLies) {
            const absolutePath = path.join(workspaceFolder.uri.fsPath, relativeFilePath);

            // 检查文件是否存在
            if (!fs.existsSync(absolutePath)) {
                await this.fakeFileManager.cleanupFileRecord(absolutePath);
                cleanedCount++;
                continue;
            }

            // 检查文件完整性
            const isIntact = await this.fakeFileManager.checkFileIntegrity(absolutePath);
            if (!isIntact) {
                const action = await vscode.window.showWarningMessage(
                    `文件 ${relativeFilePath} 已被外部修改，是否清理其记录？`,
                    '清理',
                    '保留',
                    '跳过所有'
                );

                if (action === '清理') {
                    await this.fakeFileManager.cleanupFileRecord(absolutePath);
                    cleanedCount++;
                } else if (action === '跳过所有') {
                    break;
                }
            }
        }

        vscode.window.showInformationMessage(`清理完成，共清理了 ${cleanedCount} 个无效记录`);
    }

    /**
     * 清理指定文件
     */
    private async cleanupSpecificFile(): Promise<void> {
        const allFilesWithLies = this.fakeFileManager.getAllFilesWithLies();
        if (allFilesWithLies.length === 0) {
            vscode.window.showInformationMessage('没有找到有撒谎记录的文件');
            return;
        }

        const items = allFilesWithLies.map(file => ({
            label: file,
            description: `${this.fakeFileManager.getFileModifiedLines(file).length} 行记录`
        }));

        const selectedFile = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要清理的文件'
        }); if (selectedFile) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const absolutePath = path.join(workspaceFolder.uri.fsPath, selectedFile.label);
            await this.fakeFileManager.cleanupFileRecord(absolutePath);

            vscode.window.showInformationMessage(`已清理文件 ${selectedFile.label} 的撒谎记录`);
        }
    }

    /**
     * 重置 .fake 文件
     */
    private async resetFakeFile(): Promise<void> {
        const confirmation = await vscode.window.showWarningMessage(
            '⚠️ 确定要完全重置 .fake 文件吗？这将删除所有撒谎记录且无法恢复！',
            { modal: true },
            '确认重置',
            '取消'
        ); if (confirmation === '确认重置') {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            const fakeFilePath = path.join(workspaceFolder.uri.fsPath, '.fake');

            try {
                if (fs.existsSync(fakeFilePath)) {
                    fs.unlinkSync(fakeFilePath);
                }

                await this.fakeFileManager.reinitialize();
                vscode.window.showInformationMessage('✅ .fake 文件已重置');
            } catch (error) {
                vscode.window.showErrorMessage(`重置失败: ${error}`);
            }
        }
    }

    /**
     * 重新初始化 .fake 文件
     */
    private async reinitializeFakeFile(): Promise<void> {
        try {
            await this.fakeFileManager.reinitialize();
            vscode.window.showInformationMessage('✅ .fake 文件已重新初始化');
        } catch (error) {
            vscode.window.showErrorMessage(`重新初始化失败: ${error}`);
        }
    }

    /**
     * 将 .fake 数据格式化为可读文本
     */
    private formatFakeDataAsText(fakeData: any): string {
        let report = '📄 .fake 文件报告\n';
        report += '=' + '='.repeat(50) + '\n\n';

        report += `版本: ${fakeData.version}\n`;
        report += `工作区: ${fakeData.workspacePath}\n`;
        report += `创建时间: ${new Date(fakeData.createdAt).toLocaleString()}\n`;
        report += `最后更新: ${new Date(fakeData.lastUpdated).toLocaleString()}\n\n`;

        report += `总文件数: ${fakeData.files.length}\n`;
        const filesWithLies = fakeData.files.filter((f: any) => f.modifiedLines.length > 0);
        report += `有撒谎记录的文件数: ${filesWithLies.length}\n\n`;

        if (filesWithLies.length > 0) {
            report += '📝 详细信息:\n';
            report += '-'.repeat(50) + '\n';

            for (const file of filesWithLies) {
                report += `\n📁 ${file.filePath}\n`;
                report += `   状态: ${file.currentState === 'truth' ? '真话' : '假话'}\n`;
                report += `   最后修改: ${new Date(file.lastModified).toLocaleString()}\n`;
                report += `   修改行数: ${file.modifiedLines.length}\n`;

                if (file.modifiedLines.length > 0) {
                    report += '   修改详情:\n';
                    for (const line of file.modifiedLines) {
                        report += `     • 第${line.lineNumber + 1}行 (${line.modifyType})\n`;
                        report += `       原文: ${line.originalText.substring(0, 50)}${line.originalText.length > 50 ? '...' : ''}\n`;
                        report += `       假话: ${line.fakeText.substring(0, 50)}${line.fakeText.length > 50 ? '...' : ''}\n`;
                        report += `       时间: ${new Date(line.modifiedTime).toLocaleString()}\n`;
                    }
                }
            }
        }

        return report;
    }
}
