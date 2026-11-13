# EVE 风格桌面端知识星图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 将现有首页升级为可旋转、缩放、聚焦与路径追踪的桌面端三维知识星图。

**Architecture:** 保留 `docs/app.js` 的阅读器、搜索与筛选。`docs/space-scene.js` 提供确定性星区布局、语义缩放和真实层级路线；Canvas 绘制按三维深度排序，交互在现有动画循环中平滑推进。

**Tech Stack:** 原生 JavaScript、Canvas 2D、Node 测试运行器。

**Spec:** `docs/superpowers/specs/2026-11-13-eve-inspired-desktop-starmap.md`

## Global Constraints

- 仅实现桌面端新视觉，保留现有窄屏布局。
- 星点和关系取自 `docs/graph.json`，不编造知识路径。
- 保留现有阅读器、搜索、筛选和资料页行为。
- 减少动态效果偏好应停用巡航、进场和路径动画。

## Review Focus

- 无选中节点时，17 个维度与其下知识点应在画面中心形成不规则而稳定的三维分布。
- 选中没有父级或父级缺失的节点时，路线计算应安全终止。
- 搜索或平台筛选后，星点、标签、路线应与可见集合一致。
- 多次拖拽、缩放和重置后，镜头仍在可用范围内。
- 长时间打开页面和后台恢复时，动画不应造成明显性能退化。

---

### Task 1: 星区布局与真实路线

**Files:** `docs/space-scene.js`, `tests/space-scene.test.mjs`

**Interfaces:** 新增 `buildStarmapLayout(graph)`、`starmapOverviewIds(graph,{zoom})`、`hierarchyRoute(graph,id)`；供首页使用。

- [x] 写确定性布局、中心密度、层级邻近、缩放可见性和路线边界测试。
- [x] 运行新测试，确认因缺失功能失败。
- [x] 实现布局与路线函数。
- [x] 运行新测试和现有空间场景测试，确认通过。

### Task 2: 星图渲染与镜头交互

**Files:** `docs/app.js`, `docs/index.html`, `docs/ui-polish.css`, `tests/space-scene.test.mjs`

**Interfaces:** 使用 Task 1 的布局、可见集合和路线；保留 `showNode`、`clearSelection` 与阅读器接口。

- [x] 增加关于入口文案、真实路线和 reduced-motion 的行为测试，确认新测试失败。
- [x] 调整首页星点、关系线、景深、星尘与标签的渲染。
- [x] 加入初始推进、平滑缩放、节点聚焦和沿线光点；更新桌面端操作提示。
- [x] 运行定向测试、JavaScript 语法检查和完整测试，记录结果。

### Task 3: 审核与交付

**Files:** 草稿 PR #2 的同一分支。

- [x] 检查 diff 与数据映射，确保没有移动端新流程或伪造关系。
- [x] 运行最终测试并核对 GitHub 分支提交。
- [x] 更新草稿 PR 描述，注明可验证的交互与视觉验收限制。

## Verification record

- 定向测试：38/38 通过；JavaScript 语法和 git diff --check 通过。
- 全套测试：164 项中 158 通过，6 项失败。失败来自稀疏检出缺少的课程/原始资料文件，以及该分支尚未启用的另一套 Three.js 混合预览断言；它们与本次星图改动无关。
- 浏览器实时视觉验收受当前环境的 origin 策略限制，草稿 PR 保留供桌面浏览器复核。
