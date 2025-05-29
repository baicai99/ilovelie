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
   git clone https://github.com/yourusername/ilovelie.git
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

### 待开发功能

- ⏳ 字典替换
- ⏳ AI驱动替换
- ⏳ 隐藏注释

### 添加新功能

1. 在 `package.json` 的 `contributes.commands` 中添加命令
2. 在 `src/extension.ts` 中实现功能
3. 在 `activate` 函数中注册命令
4. 编写测试
5. 更新文档

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
