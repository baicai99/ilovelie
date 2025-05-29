# 发布指南

## 📦 准备发布

### 1. 安装VSCE工具
```bash
npm install -g vsce
```

### 2. 检查项目
确保以下文件已正确配置：
- ✅ `package.json` - 包含正确的版本号和信息
- ✅ `README.md` - 包含完整的说明文档
- ✅ `CHANGELOG.md` - 包含版本更新信息
- ✅ `LICENSE` - 包含许可证信息

### 3. 运行完整测试
```bash
npm test
```

### 4. 打包插件
```bash
vsce package
```

这将生成一个 `.vsix` 文件。

### 5. 发布到VS Code市场

#### 首次发布
1. 创建Azure DevOps账号
2. 生成Personal Access Token
3. 登录vsce：
   ```bash
   vsce login your-publisher-name
   ```
4. 发布：
   ```bash
   vsce publish
   ```

#### 后续版本发布
```bash
# 自动增加补丁版本号并发布
vsce publish patch

# 自动增加次版本号并发布
vsce publish minor

# 自动增加主版本号并发布
vsce publish major

# 指定版本号发布
vsce publish 1.0.0
```

## 🏷️ 版本控制

遵循[语义化版本](https://semver.org/)：
- `MAJOR.MINOR.PATCH`
- MAJOR: 不兼容的API修改
- MINOR: 向后兼容的功能性新增
- PATCH: 向后兼容的问题修正

## 📋 发布清单

在发布前请确认：

- [ ] 所有功能都已测试
- [ ] 文档已更新
- [ ] 版本号已正确更新
- [ ] CHANGELOG.md已更新
- [ ] 所有测试都通过
- [ ] 代码已推送到Git仓库
- [ ] 创建了Git标签

## 🔖 创建Git标签

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## 📈 发布后

1. 在GitHub上创建Release
2. 更新README中的版本信息
3. 通知用户新版本
4. 监控用户反馈和问题

## 🚨 回滚版本

如果发现严重问题需要回滚：

```bash
vsce unpublish your-publisher-name.ilovelie@version
```

注意：回滚后72小时内不能重新发布同一版本号。
