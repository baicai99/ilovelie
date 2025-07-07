# 我爱撒谎 (ilovelie)

一款可以对代码注释撒谎的 VS Code 插件

<!-- PROJECT SHIELDS -->

[![Contributors][contributors-shield]][contributors-url]  [![Forks][forks-shield]][forks-url] [![Stargazers][stars-shield]][stars-url]  [![Issues][issues-shield]][issues-url]  [![MIT License][license-shield]][license-url] [![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />

<p align="center">
  <a href="https://github.com/baicai99/ilovelie">
    <img src="icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">我爱撒谎 VS Code 插件</h3>
  <p align="center">
    一个让注释胡言乱语的插件
    <br />
    <a href="https://github.com/baicai99/ilovelie"><strong>探索本项目的文档 »</strong></a>
    <br />
    <br />
    <a href="https://github.com/baicai99/ilovelie">查看Demo</a>
    ·
    <a href="https://github.com/baicai99/ilovelie/issues">报告Bug</a>
    ·
    <a href="https://github.com/baicai99/ilovelie/issues">提出新特性</a>
  </p>

</p>

本篇README.md面向开发者

## 目录

- [我爱撒谎 (ilovelie)](#我爱撒谎-ilovelie)
  - [目录](#目录)
    - [上手指南](#上手指南)
          - [开发前的配置要求](#开发前的配置要求)
          - [**安装步骤**](#安装步骤)
    - [文件目录说明](#文件目录说明)
    - [开发的架构](#开发的架构)
    - [使用到的框架](#使用到的框架)
    - [贡献者](#贡献者)
      - [如何参与开源项目](#如何参与开源项目)
    - [版本控制](#版本控制)
    - [作者](#作者)
    - [版权说明](#版权说明)
    - [鸣谢](#鸣谢)

### 上手指南

###### 开发前的配置要求

1. Node.js 18.x
2. 由于不知名限制，需要使用最新版的vscode，如果提示无法安装请从官网从新下载vscode。

###### **安装步骤**

从 [这里](https://github.com/baicai99/ilovelie/releases/) 下载最新的 .vsix 文件，在vscode扩展中安装。

### 文件目录说明
eg:

```
.
├── LICENSE
├── LLM.md
├── README.md
├── background.png
├── icon.png
├── esbuild.js
├── eslint.config.mjs
├── package-lock.json
├── package.json
├── tsconfig.json
├── scripts/
│   └── setup-tests.sh
└── src/
    ├── commands/
    ├── comment/
    ├── data/
    ├── manager/
    ├── replacer/
    └── extension.ts
```

### 开发的架构

请阅读[ARCHITECTURE.md](https://github.com/baicai99/ilovelie/blob/master/ARCHITECTURE.md) 查阅为该项目的架构。

### 使用到的框架

- [TypeScript](https://www.typescriptlang.org)
- [VS Code API](https://code.visualstudio.com/api)
- [esbuild](https://esbuild.github.io)

### 贡献者

请阅读**CONTRIBUTING.md** 查阅为该项目做出贡献的开发者。

#### 如何参与开源项目

贡献使开源社区成为一个学习、激励和创造的绝佳场所。你所作的任何贡献都是**非常感谢**的。

1. Fork 本项目
2. 克隆 Fork 的项目到本地(`git clone yours/ilovelie`)
3. 创建并切换到新的 git 分支，并使用功能模块命名。 (`git checkout -b feature/AmazingFeature`)
4. 提交变化 (`git commit -m 'Add some AmazingFeature'`)
5. 提交 PR 到主分支

### 版本控制

该项目使用Git进行版本管理。您可以在repository参看当前可用版本。

### 作者

1637083533@qq.com

### 版权说明

该项目签署了MIT 授权许可，详情请参阅 [LICENSE](https://github.com/baicai99/ilovelie/blob/master/LICENSE)

### 鸣谢

<!-- links -->
[your-project-path]:baicai99/ilovelie
[contributors-shield]: https://img.shields.io/github/contributors/baicai99/ilovelie.svg?style=flat-square
[contributors-url]: https://github.com/baicai99/ilovelie/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/baicai99/ilovelie.svg?style=flat-square
[forks-url]: https://github.com/baicai99/ilovelie/network/members
[stars-shield]: https://img.shields.io/github/stars/baicai99/ilovelie.svg?style=flat-square
[stars-url]: https://github.com/baicai99/ilovelie/stargazers
[issues-shield]: https://img.shields.io/github/issues/baicai99/ilovelie.svg?style=flat-square
[issues-url]: https://github.com/baicai99/ilovelie/issues
[license-shield]: https://img.shields.io/github/license/baicai99/ilovelie.svg?style=flat-square
[license-url]: https://github.com/baicai99/ilovelie/blob/master/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=flat-square&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/baicai99
