# 桌面端 WebGL 知识星图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将桌面端当前 Canvas 星图与界面整体切换成 EVE 风格的 WebGL 三维知识星图，并保留现有知识功能。

**Architecture:** `boot.js` 选择 Three.js 或 Canvas。新的 `starmap-webgl.js` 从 `space-scene.js` 读取真实坐标、可见节点与路线；`app-three.js` 将当前 `app.js` 的搜索、筛选和阅读器事件连接到 WebGL 场景。`ui-polish.css` 负责桌面航图视觉。

**Tech Stack:** 原生 JavaScript、仓库自带 Three.js 180、CSS、Node 测试运行器。

**Spec:** `docs/superpowers/specs/2026-11-13-full-webgl-desktop-starmap-design.md`

## Global Constraints

- 桌面端默认 WebGL，WebGL 失败时保留 Canvas 回退。
- 三维可点击节点与路线均来自 `docs/graph.json`。
- 保留当前搜索、筛选、阅读器、证据及资料操作；不新增移动端流程。
- 减少动态效果偏好关闭自动动态。

## Review Focus

- WebGL 初始化失败或窗口缩窄：Canvas 回退或正在运行的 WebGL 画布必须仍能显示和操作。
- WebGL 上下文丢失：不得继续渲染，必须给出切换路径。
- 搜索和筛选后：三维可见点、路线和阅读器必须保持同一图谱状态。
- 读者聚焦后：路线只经过已公开的真实父级边，不显示伪造因果关系。
- 稀疏检出：不得把缺少的原始资料与课程文件归因于 UI 改动。

---

### Task 1: WebGL 星区模型与场景

**Files:** `docs/starmap-webgl.js`, `tests/starmap-webgl.test.mjs`

**Interfaces:** `createStarmapScene({THREE,canvas,graph,onHover,onSelect,onContextLost,reducedMotion,rendererFactory,frameScheduler})` 返回 `setState`, `resize`, `zoomBy`, `resetView`, `setCruising`, `dispose`, `inspect`。

- [x] 编写真实节点与边、过滤、路线、减少动态效果、上下文丢失测试，并确认新测试因功能缺失失败。
- [x] 用现有三维布局建立星点、低亮度关系线、背景星尘与路径光点。
- [x] 实现镜头推进、平滑聚焦、拖拽惯性、缩放与巡航。
- [x] 运行场景及现有星区模型定向测试。

### Task 2: 启动与阅读器桥接

**Files:** `docs/boot.js`, `docs/app-three.js`, `docs/app.js`, `docs/index.html`, `tests/asset-versioning.test.mjs`, `tests/three-ui.test.mjs`

**Interfaces:** `app.js` 在 WebGL 主机模式暴露 `__GALAXY_BRIDGE__`，发布选择、搜索与筛选事件；Canvas 渲染器只在回退模式启动。

- [x] 编写 WebGL 默认、Canvas 回退与 DOM 桥接测试，并确认其失败。
- [x] 接入新的 Three.js 场景和当前阅读器；同步搜索、筛选、点击与关闭。
- [x] 更新单入口脚本、状态与回退控件，保留全部阅读器 DOM 合约。
- [x] 运行启动、阅读器、资源版本测试。

### Task 3: 桌面航图视觉与交付

**Files:** `docs/ui-polish.css`, `docs/content-polish.css`, `docs/index.html`, `docs/raw-sources.html`, `docs/knowledge-coverage.html`, `tests/galaxy-atlas.test.mjs`, 草稿 PR #2。

- [x] 替换桌面外观：场景标题、星区标签、侧栏、关系图例、阅读器、控制条、原始资料目录与覆盖报告。
- [x] 更新旧视觉快照断言，使其检查实际发布的 WebGL 界面。
- [x] 运行定向与全套测试、语法和 diff 检查，记录视觉验收限制。
- [x] 提交到现有草稿 PR 分支并更新说明。

## Verification record

- WebGL 模型、启动、阅读器与空间场景定向测试全部通过；JavaScript 语法检查和 git diff --check 通过。
- 全套测试：171 项，169 通过，2 项因隔离工作树稀疏检出缺少原始资料与课程文件失败。
- 独立代码审查发现的着色器、窄窗、指针取消、暂停后的渲染、按钮状态和回退文案问题均已修复。
- 真实浏览器视觉验收受当前环境的 origin 策略限制，草稿 PR 保留人工视觉验收。
