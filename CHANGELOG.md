# Changelog

All notable changes to the "我爱撒谎" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-02

### Security
- 🔒 Fixed 5 dependency security vulnerabilities (1 critical, 1 high, 1 moderate, 2 low)
- 🔒 Updated form-data, glob, js-yaml, @eslint/plugin-kit, and brace-expansion packages

### Features
- 🤖 AI-powered comment replacement using OpenAI GPT models
- 📚 Dictionary-based comment replacement with intelligent matching
- 🔄 Truth/Lie toggle functionality to switch between original and replaced comments
- 📊 Current status display showing lie session state
- ⚙️ Visual AI configuration center with test connection feature
- 🎯 Selective replacement - choose which comments to replace
- 📝 Comprehensive history management with session tracking
- 🔍 Advanced comment detection supporting multiple languages and formats

### Commands
- `我爱撒谎: 手动替换注释` - Manual comment replacement
- `我爱撒谎: AI替换选中注释` (Ctrl+Shift+A) - AI replace selected comment
- `我爱撒谎: 批量-AI替换注释` - Batch AI replacement
- `我爱撒谎: 多选-AI替换` - Selective AI replacement
- `我爱撒谎: 批量-字典替换注释` - Batch dictionary replacement
- `我爱撒谎: 多选-字典替换` - Selective dictionary replacement
- `我爱撒谎: 切换注释显示/隐藏` (Ctrl+Shift+H) - Toggle comment visibility
- `我爱撒谎: 🔄 切换真话/假话` (Ctrl+Shift+T) - Toggle truth/lie state
- `我爱撒谎: 📊 显示当前状态` - Show current status
- `我爱撒谎: 🤖 打开AI配置中心` - Open AI configuration center

### Supported Languages
- JavaScript/TypeScript
- Python
- Java
- C/C++/C#
- Ruby
- Shell
- HTML/XML
- CSS/SCSS/LESS

### Technical Details
- Built with TypeScript in strict mode
- Optimized with esbuild (bundle size: 586KB)
- OpenAI integration with support for GPT-4o-mini, GPT-4o, GPT-4-turbo, GPT-3.5-turbo
- Persistent history storage using VS Code global state
- Batch processing optimization for AI calls

### Requirements
- VS Code version ^1.100.0
- Node.js 18.x or higher
- OpenAI API Key (for AI features)

## [1.0.0] - Initial Release

### Features
- Basic comment replacement functionality
- Manual comment replacement
- Comment hiding functionality

---

## Release Notes

### v1.1.0 Highlights

**🔒 Security First**: This release includes critical security updates to all dependencies. Please update immediately if you're using v1.0.0.

**🤖 AI-Powered**: Integrated OpenAI GPT models to generate creative and professional-sounding fake comments. Configure your API key in the new configuration center.

**📊 Session Management**: Track your lie sessions and toggle between truth and lies seamlessly. Your history is preserved across VS Code sessions.

**🎯 Flexible Replacement**: Choose between:
- Manual replacement with custom text
- Dictionary-based replacement with 100+ predefined mappings
- AI-powered replacement for creative results
- Batch or selective processing

**Performance**: Optimized batch AI processing with fallback to individual processing when needed.
