# 我爱撒谎 (iLoveLie)

一个可以对代码注释撒谎的VS Code插件，让代码只有你可以维护！🤫

## 📖 简介

为了应对"能写好代码被裁员"的问题，这个插件可以帮你对代码注释撒谎，让代码变得只有你能维护，从而应对被开除的风险。

## ✨ 功能特性

### 已实现功能

- ✅ **手动替换注释**：手动输入想要撒谎的注释内容
- ✅ **选中替换**：右键选中的注释内容进行替换
- ✅ **字典替换**：智能识别注释中的关键词并自动替换
  - **批量替换**：一键替换文件中的所有注释
  - **选择替换**：预览并选择要替换的特定注释
  - **关键词匹配**：检测注释中的编程术语（函数、变量、计算、处理等）
  - **智能替换**：根据关键词提供对应的撒谎内容
  - **随机备选**：没有匹配关键词时使用有趣的随机内容
  - **多行注释支持**：完美支持单行和多行注释块的替换
- ✅ **完整恢复系统**：
  - **撤销上次撒谎**：精确撤销最后一次的注释替换
  - **查看撒谎历史**：查看所有的撒谎记录（持久化存储）
  - **从历史中还原**：从历史记录中选择特定的记录进行精确还原
  - **清除所有历史**：一键清除所有撒谎记录
- ✅ **智能恢复功能**：
  - 精确位置还原，支持内容变化后的智能搜索
  - 跨文件操作提醒和确认
  - 历史记录持久化，重启VS Code后不丢失
- ✅ **多语言支持**：支持 JavaScript、TypeScript、Python、Java、C#、C++、HTML、CSS 等多种语言的注释格式
- ✅ **隐藏注释功能**：一键隐藏/显示所有注释，让代码看起来更"干净"
  - **Toggle切换**：使用 `Ctrl+Shift+H` 快捷键或命令快速切换
  - **智能恢复**：记住隐藏的注释，可以完美恢复
  - **文件级管理**：每个文件独立管理隐藏状态

- ✅ **AI智能替换**：基于OpenAI GPT-4o-mini的智能撒谎功能
  - **单个AI替换**：选中注释后使用AI生成创意撒谎内容
  - **批量AI替换**：一键使用AI替换文件中的所有注释（支持批量优化模式）
  - **选择性AI替换**：预览并选择要进行AI替换的特定注释
  - **配置中心**：完整的OpenAI API配置界面，支持自定义模型和Base URL
  - **混合处理模式**：批量失败时自动回退到单个处理，确保成功率
  - **API费用控制**：替换前明确提示可能产生的费用
  - **智能内容清理**：自动清理AI返回内容中的注释符号，避免格式问题

## 📦 安装方法

### 方法一：VS Code 扩展市场（推荐）
1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 "我爱撒谎" 或 "ilovelie"
4. 点击安装按钮
5. 重启 VS Code 即可使用

### 方法二：命令行安装
```bash
code --install-extension baicai99.ilovelie
```

### 方法三：手动安装 VSIX 文件
1. 从 [GitHub Releases](https://github.com/baicai99/ilovelie/releases) 下载最新的 `.vsix` 文件
2. 打开 VS Code
3. 按 `Ctrl+Shift+P` 打开命令面板
4. 输入 "code --install-extension （ilovelie-版本号.vsix）"
5. 选择下载的 `.vsix` 文件进行安装
6. 重启 VS Code

**安装成功后，你可以通过以下方式验证：**
- 按 `Ctrl+Shift+P` 打开命令面板
- 输入 "手动替换注释" 或 "字典替换注释"
- 如果能看到相关命令，说明安装成功！

## 🚀 使用方法

### 方法一：命令面板
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入相关命令：
   - "手动替换注释" - 批量替换注释
   - "字典替换注释" - 智能关键词替换
   - "替换选中的注释" - 替换选中的注释
   - "切换注释显示/隐藏" - 一键隐藏或显示所有注释
   - "撤销上次撒谎" - 撤销最后一次操作
   - "查看撒谎历史" - 查看所有历史记录
   - "AI单个替换" - 对选中的注释使用AI生成撒谎内容
   - "AI批量替换" - 使用AI批量替换文件中所有注释
   - "AI选择性替换" - 选择特定注释进行AI替换
   - "🤖 打开AI配置中心" - 配置OpenAI API设置

### 方法二：右键菜单
**替换注释：**
1. 在编辑器中右键，选择：
   - "替换选中的注释" - 替换选中的注释文本
   - "字典替换注释" - 自动替换当前文件的所有注释
   - "切换注释显示/隐藏" - 一键隐藏或显示所有注释
2. 或选中一段注释文本后右键选择对应功能
3. 根据提示输入新内容（手动替换）或等待自动完成（字典替换）

**恢复操作：**
1. 在编辑器中右键，可以看到以下选项：
   - "撤销上次撒谎" - 精确撤销最后一次操作
   - "查看撒谎历史" - 查看所有历史记录
   - "AI单个替换" - 对选中的注释使用AI生成撒谎内容
   - "AI批量替换" - 使用AI批量替换文件中所有注释  
   - "AI选择性替换" - 选择特定注释进行AI替换
   - "🤖 打开AI配置中心" - 配置OpenAI API设置

### 方法三：快捷键
- `Ctrl+Shift+H` - 快速切换注释显示/隐藏状态
- `Ctrl+Shift+T` - 切换真话/撒谎状态  
- `Ctrl+Shift+Alt+T` - 临时还原所有撒谎
- `Ctrl+Shift+R` - 恢复撒谎状态

## 📝 使用示例

### 手动替换示例

**原始注释：**
```javascript
// 这个函数用来计算两个数的和
function add(a, b) {
    return a + b;
}
```

**手动替换后：**
```javascript
// 这个函数用来播放背景音乐
function add(a, b) {
    return a + b;
}
```

### 字典替换示例

**原始代码：**
```javascript
// 这是一个计算函数
function calculate(data) {
    return data.reduce((sum, item) => sum + item, 0);
}

/*
这个方法用来处理用户数据
包含数据验证和格式化
*/
function processUserData(userData) {
    return userData.filter(item => item.isValid);
}

/**
 * 优化算法实现
 * @param {Array} array - 输入数组
 */
function optimizeAlgorithm(array) {
    return array.sort();
}
```

**字典替换后：**
```javascript
// 渲染3D模型
function calculate(data) {
    return data.reduce((sum, item) => sum + item, 0);
}

/* 压缩图片 */
function processUserData(userData) {
    return userData.filter(item => item.isValid);
}

/** 音频均衡器 */
function optimizeAlgorithm(array) {
    return array.sort();
}
```

**智能匹配规则：**
- "计算" → "渲染3D模型"、"播放背景音乐"、"发送通知消息"
- "处理" → "下载文件"、"压缩图片"、"生成报告"
- "优化" → "内存清理程序"、"网络加速器"、"电池省电模式"
- "函数"、"方法"、"算法" 等都有对应的撒谎内容库
- 如果没有匹配关键词，会使用有趣的随机内容（如"用来驯服数字宠物"）

现在其他人看到这些函数会完全搞不懂它们的真实用途！😈

### 隐藏注释示例

**隐藏前：**
```javascript
// 这个函数用来计算两个数的和
function add(a, b) {
    return a + b;
}

/* 
 * 数据处理函数
 * 用来验证用户输入
 */
function validateInput(data) {
    return data.length > 0;
}
```

**按 `Ctrl+Shift+H` 隐藏后：**
```javascript
function add(a, b) {
    return a + b;
}

function validateInput(data) {
    return data.length > 0;
}
```

**再次按 `Ctrl+Shift+H` 恢复：**
```javascript
// 这个函数用来计算两个数的和
function add(a, b) {
    return a + b;
}

/* 
 * 数据处理函数
 * 用来验证用户输入
 */
function validateInput(data) {
    return data.length > 0;
}
```

现在代码看起来非常"干净"，没有任何注释痕迹！当需要时可以一键恢复所有隐藏的注释。

### AI智能替换示例

**原始代码：**
```javascript
// 这个函数计算用户的年龄
function calculateAge(birthYear) {
    return new Date().getFullYear() - birthYear;
}

// 数据库连接初始化
function initDatabase() {
    return new Database();
}
```

**AI替换后（使用gpt-4o-mini）：**
```javascript
// 这个函数播放背景音效
function calculateAge(birthYear) {
    return new Date().getFullYear() - birthYear;
}

// 图像渲染处理器
function initDatabase() {
    return new Database();
}
```

**AI的优势：**
- 🤖 **创意内容**：AI可以生成更多样化和创意的撒谎内容
- 🎯 **语境理解**：AI能理解注释的语境，生成相关但错误的描述
- 🚀 **批量处理**：支持批量模式，大幅提高处理效率
- 🔄 **智能回退**：批量失败时自动回退到单个处理模式

## 🎯 支持的语言和注释格式

- **JavaScript / TypeScript**：`//` 单行注释、`/* */` 多行注释、`/** */` 文档注释
- **Python**：`#` 注释
- **Java / C# / C++**：`//` 单行注释、`/* */` 多行注释
- **HTML / XML**：`<!-- -->` 注释
- **CSS / SCSS / Less**：`/* */` 注释
- **Shell / Bash**：`#` 注释

**特殊支持：**
- ✅ 跨行多行注释块的完整检测和替换
- ✅ 保持原有注释格式（不会改变注释符号类型）
- ✅ 智能内容提取（自动移除注释符号进行关键词匹配）

## 🧠 字典替换功能详解

### 内置关键词库

**编程概念类：**
- 函数、方法、变量、类、接口、数组、对象

**操作类：**
- 计算、处理、获取、设置、初始化、创建、删除

**数据类：**
- 数据、参数、结果、返回

**技术概念类：**
- 算法、逻辑、流程、优化

**业务类：**
- 用户、系统、服务、模块

**动作类：**
- 循环、判断、遍历、查找、排序

**状态类：**
- 成功、失败、错误、完成

### 随机撒谎内容池

当注释中没有匹配的关键词时，会从以下内容中随机选择：
- "这段代码用来播放猫咪视频"
- "负责生成彩虹特效"
- "处理用户的梦境数据"
- "用来计算独角兽的飞行速度"
- "管理魔法药水的配方"
- "控制时间机器的按钮"
- "负责监控薛定谔的猫"
- ...还有更多有趣的内容！

## 📋 系统要求

- VS Code 1.100.0 或更高版本
- 无其他特殊依赖

## ⚙️ 配置设置

### AI功能配置

要使用AI智能替换功能，需要配置OpenAI API：

1. **打开配置中心**：
   - 使用命令面板搜索"🤖 打开AI配置中心"
   - 或在右键菜单中选择"🤖 打开AI配置中心"

2. **配置API Key**：
   - 在 [OpenAI平台](https://platform.openai.com/api-keys) 获取API Key
   - 在配置界面输入你的API Key
   - API Key只保存在本地，不会上传到服务器

3. **选择模型**（可选）：
   - **gpt-4o-mini**（推荐）：性价比最高，速度快，费用低
   - **gpt-4o**：性能更强，费用较高
   - **gpt-4-turbo**：平衡性能和费用
   - **gpt-3.5-turbo**：经济实惠

4. **自定义Base URL**（可选）：
   - 支持使用代理或其他兼容的OpenAI API服务
   - 默认为：`https://api.openai.com/v1`

**配置完成后即可使用AI功能！**

### 基础功能

基础的字典替换、手动替换和隐藏功能无需任何配置，开箱即用！

**字典替换的工作原理：**
1. 自动扫描当前文件中的所有注释
2. 提取注释的纯文本内容（移除注释符号）
3. 检查是否包含内置关键词
4. 优先使用匹配关键词对应的撒谎内容
5. 如果没有匹配，使用随机有趣内容
6. 保持原有注释格式进行替换

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
