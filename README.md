# 我爱撒谎 (iLoveLie)

一个可以对代码注释撒谎的VS Code插件，让代码只有你可以维护！🤫

## 📖 简介

为了应对"能写好代码被裁员"的问题，这个插件可以帮你对代码注释撒谎，让代码变得只有你能维护，从而应对被开除的风险。

## ✨ 功能特性

### 已实现功能

- ✅ **手动替换注释**：手动输入想要撒谎的注释内容
- ✅ **选中替换**：右键选中的注释内容进行替换
- ✅ **多语言支持**：支持 JavaScript、TypeScript、Python、Java、C#、C++、HTML、CSS 等多种语言的注释格式

### 计划中功能（TODO）

- ⏳ **字典替换**：从注释中遍历字典关键字，然后替换掉注释
- ⏳ **AI替换**：由AI驱动的撒谎
- ⏳ **隐藏注释**：隐藏注释功能

## 🚀 使用方法

### 方法一：命令面板
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "手动替换注释" 或 "替换选中的注释"
3. 按照提示输入原注释和新注释内容

### 方法二：右键菜单
1. 选中一段注释文本
2. 右键选择 "替换选中的注释"
3. 输入新的撒谎内容

## 📝 使用示例

**原始注释：**
```javascript
// 这个函数用来计算两个数的和
function add(a, b) {
    return a + b;
}
```

**替换后：**
```javascript
// 这个函数用来播放背景音乐
function add(a, b) {
    return a + b;
}
```

现在其他人看到这个函数会以为它是用来播放音乐的！😈

## 🎯 支持的语言

- JavaScript / TypeScript (`//` 和 `/* */`)
- Python (`#`)
- Java / C# / C++ (`//` 和 `/* */`)
- HTML / XML (`<!-- -->`)
- CSS / SCSS / Less (`/* */`)
- Shell / Bash (`#`)

## 📋 系统要求

- VS Code 1.100.0 或更高版本
- 无其他特殊依赖

## ⚙️ 设置

此插件目前不需要任何配置设置，开箱即用！

## 🐛 已知问题

- 暂无已知问题

如果您发现任何问题，请在 [GitHub Issues](https://github.com/yourusername/ilovelie/issues) 中报告。

## 📄 更新日志

详细的更新日志请查看 [CHANGELOG.md](CHANGELOG.md)。

## 🤝 贡献

欢迎贡献代码！请阅读我们的贡献指南：

1. Fork 这个项目
2. 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📜 许可证

此项目使用 MIT 许可证 - 详情请查看 [LICENSE](LICENSE) 文件。

## ⚠️ 免责声明

此插件仅供娱乐和学习目的。请勿将其用于恶意目的或违法行为。使用此插件时请遵守您所在公司和地区的相关法律法规。

## 🎉 致谢

感谢所有为这个项目做出贡献的开发者！

---

**享受撒谎的乐趣吧！** 🤪
