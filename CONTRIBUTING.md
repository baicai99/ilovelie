# 贡献指南

感谢您有兴趣为"我爱撒谎"项目做出贡献！🎉

## 🚀 开始贡献

### 前置要求

- Node.js 18.x 或更高版本
- npm 或 yarn
- VS Code
- Git

### 开发环境设置

1. **Fork 并克隆仓库**
   ```bash
   git clone https://github.com/baicai99/ilovelie.git
   cd ilovelie
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   ```bash
   npm run watch
   ```

4. **在 VS Code 中打开项目**
   ```bash
   code .
   ```

5. **调试插件**
   - 按 `F5` 启动调试
   - 这会打开一个新的 VS Code 窗口，插件已加载

## 📝 开发指南

### 项目结构

```
ilovelie/
├── src/
│   ├── extension.ts          # 主要插件逻辑
│   └── test/
│       └── extension.test.ts # 测试文件
├── package.json              # 插件配置和依赖
├── tsconfig.json            # TypeScript 配置
├── eslint.config.mjs        # ESLint 配置
└── esbuild.js               # 构建配置
```

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 使用有意义的变量和函数名
- 添加必要的注释
- 编写单元测试

### 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` 修复bug
- `docs:` 文档变更
- `style:` 代码格式（不影响代码运行的变动）
- `refactor:` 重构（即不是新增功能，也不是修改bug的代码变动）
- `test:` 增加测试
- `chore:` 构建过程或辅助工具的变动

示例：
```
feat: 添加字典替换功能
fix: 修复多行注释替换问题
docs: 更新README使用说明
```

## 🔧 功能开发

### 当前功能

- ✅ 手动替换注释
- ✅ 选中文本替换
- ✅ 字典智能替换
- ✅ AI智能替换
- ✅ 隐藏注释功能
- ✅ 完整的历史记录系统
- ✅ 临时状态管理

### 核心模块

**核心文件结构：**
```
src/
├── extension.ts              # 主扩展入口
├── aiReplacer.ts            # AI替换核心模块
├── commentDetector.ts       # 注释检测器
├── commentHider.ts          # 注释隐藏管理器
├── commentReplacer.ts       # 手动替换器
├── dictionaryReplacer.ts    # 字典替换器
├── historyManager.ts        # 历史记录管理器
├── restoreManager.ts        # 恢复管理器
├── tempStateManager.ts      # 临时状态管理器
├── liesDictionary.ts        # 撒谎词典
├── types.ts                 # 类型定义
└── commands/
    └── index.ts             # 命令注册器
```

### 添加新功能

1. **在 `package.json` 中添加命令定义**：
   ```json
   {
     "command": "ilovelie.yourNewCommand",
     "title": "你的新功能",
     "category": "我爱撒谎"
   }
   ```

2. **创建功能模块**：
   - 在 `src/` 目录下创建新的 `.ts` 文件
   - 实现功能逻辑
   - 导出主要的类或函数

3. **在命令注册器中注册**：
   - 在 `src/commands/index.ts` 中添加命令处理
   - 在 `CommandRegistrar` 类的 `registerCommands` 方法中注册

4. **更新主入口**：
   - 在 `src/extension.ts` 中导入新模块
   - 在 `activate` 函数中初始化

5. **编写测试**：
   - 在对应的测试文件中添加单元测试

6. **更新文档**：
   - 更新 README.md
   - 更新 CHANGELOG.md
   - 如有必要，更新 QUICKSTART.md

### AI功能开发注意事项

如果要开发AI相关功能，请注意：

1. **API密钥安全**：
   - 永远不要在代码中硬编码API密钥
   - 使用VS Code的配置系统存储敏感信息
   - 确保API密钥只保存在本地

2. **错误处理**：
   - 实现完善的错误处理机制
   - 提供用户友好的错误提示
   - 处理网络连接问题和API限制

3. **费用控制**：
   - 在进行批量操作前提醒用户可能的费用
   - 提供取消机制
   - 实现智能回退策略

4. **配置管理**：
   - 提供直观的配置界面
   - 支持连接测试
   - 允许用户自定义模型和参数

## 🧪 测试

### 运行测试

```bash
npm test
```

### 编写测试

在 `src/test/` 目录下添加测试文件，使用 Mocha 和 VS Code 测试 API。

示例测试：
```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(0, [1, 2, 3].indexOf(1));
    });
});
```

## 📋 Pull Request 流程

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **进行开发**
   - 编写代码
   - 添加测试
   - 更新文档

3. **验证更改**
   ```bash
   npm run lint
   npm run check-types
   npm test
   npm run compile
   ```

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 描述你的更改"
   ```

5. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写详细的描述
   - 等待代码审查

## 🐛 报告 Bug

如果您发现了 bug，请：

1. 检查是否已有相关 issue
2. 如果没有，创建新的 issue
3. 提供详细的重现步骤
4. 包含相关的错误信息和截图

## 💡 功能建议

我们欢迎新的功能建议！请：

1. 在 Issues 中描述您的想法
2. 解释为什么这个功能有用
3. 如果可能，提供实现方案

## 📜 行为准则

- 尊重他人
- 保持友好和专业
- 欢迎新手贡献者
- 遵循开源社区最佳实践

## 🎯 开发建议

### 调试技巧

1. 使用 `console.log()` 进行调试
2. 利用 VS Code 调试器设置断点
3. 查看开发者控制台的错误信息

### 性能考虑

- 避免阻塞主线程
- 合理使用异步操作
- 优化大文件处理

### 用户体验

- 提供清晰的错误信息
- 添加进度指示器
- 保持界面响应

## 🙏 致谢

感谢所有贡献者的努力！您的贡献让这个项目变得更好。

---

有任何问题？欢迎在 Issues 中讨论！
