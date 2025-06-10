# 我爱撒谎 (iLoveLie)

一个可以对代码注释撒谎的 VS Code 插件，让代码的真实含义只有你知道。

## 简介

这个扩展帮助你批量或选择性地修改注释内容，甚至可以利用 OpenAI 自动生成有趣的
"假话"。项目目前处于重写阶段，新的实验版本位于 `src/rewrite` 目录。

## 功能

- **手动替换**：输入任意内容替换注释，支持单行和多行格式。
- **字典替换**：根据关键词自动生成假话，可批量或选择性执行。
- **AI 智能替换**：通过 OpenAI API 生成注释，支持批量和选择模式，可自定义模型与
  Base URL，并在执行前提示可能产生的费用。
- **隐藏/显示注释**：一键切换所有注释的可见性。
- **历史记录**：记录每次替换，允许查看、恢复或清理指定文件的历史。
- **真话/假话切换**：在状态栏显示当前模式，随时切换回原始注释或再次应用假话。
- **多语言支持**：适用于常见编程语言的注释风格。

## 安装

### VS Code 扩展市场（推荐）
1. 打开 VS Code。
2. 按 `Ctrl+Shift+X` 打开扩展面板。
3. 搜索 "我爱撒谎" 或 "ilovelie" 并点击安装。

### 命令行
```bash
code --install-extension baicai99.ilovelie
```

### 手动安装
1. 从 [GitHub Releases](https://github.com/baicai99/ilovelie/releases)
   下载最新 `.vsix` 文件。
2. 在 VS Code 中执行 `Extensions: Install from VSIX...` 选择下载的文件。

## 使用

1. `Ctrl+Shift+P` 打开命令面板，输入下列命令之一：
   - **手动替换注释** (`ilovelie.replaceComment`)
   - **批量-字典替换注释** (`ilovelie.dictionaryReplaceComments`)
   - **多选-AI替换** (`ilovelie.aiSelectiveReplaceComments`)
   - **切换注释显示/隐藏** (`ilovelie.toggleCommentVisibility`)
   - **🔄 切换真话/假话** (`ilovelie.toggleTruthState`)
2. 也可以在编辑器右键菜单中找到相同的操作。

配置 AI 功能时，需要在设置中填写 `OpenAI API Key`、模型名称和 Base URL。

## 贡献

欢迎提 Issue 或 Pull Request！详细流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

[MIT](LICENSE)
