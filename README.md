# 座舱知识银河

本仓库是独立的 **Obsidian 式 3D 座舱知识关系图**。它从公开的[座舱架构实践与座舱架构学习仓库](https://github.com/qiantao18817568425-art/Architecture_Learning-)生成图谱索引，帮助读者从一个主题找到架构章节、每日课程和每周复盘。正文仍保存在原仓库；点击图谱节点可以打开原文。

## 在线阅读入口

| 内容 | 在线地址 | 主要用途 |
| --- | --- | --- |
| **1、座舱知识银河** | [打开 3D 关系图](https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/) | 搜索主题、切换中心节点、查看关联和课程顺序。 |
| **2、座舱架构实践** | [打开架构章节](https://qiantao18817568425-art.github.io/Architecture_Learning-/architecture/index.html) | 阅读平台、运行域、模块职责与业务链路。 |
| **3、座舱架构学习** | [打开每日与每周课程](https://qiantao18817568425-art.github.io/Architecture_Learning-/) | 按 Day / Week 学习与复盘。 |
| **4、原始资料** | [打开分类目录](https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/raw-sources.html) | 按 15 个类别检索 299 份去重资料及其图谱关系；299 份原件均可下载。 |

图谱和原站均公开发布，无需 GitHub 登录即可阅读。GitHub Pages 使用本仓库 `main` 分支的 `docs/` 目录。

## 1、图谱里有什么

- **主题星系**：整机与平台、虚拟化、Android AAOS、Yocto Host、MCU、TBox、显示、Camera、音频、电源、跨域通信和诊断等入口。
- **电源细分链路**：10 类主题下展开 20 条路径，分别学习车辆输入与策略、MCU 握手、供电、Guest/Host/Hypervisor 准备、Suspend 各阶段、真实唤醒、TBox/RTC、业务恢复，以及“睡不下去”和“睡着后电流偏高”的不同证据。每条路径连接有对应内容的公开章节与课程。
- **架构章节**：索引原站的中文版架构正文。
- **原始资料**：独立主题与 15 个分类节点，连接相关架构章节，并提供 299 份去重资料的检索目录。资料是否适用于当前车型仍须按版本核对。
- **Day 课程与 Week 复盘**：索引原站公开的专题内容；页面左侧显示当前实际收录数量。
- **知识连线**：表示主题目录、主题细分、内容索引或课程顺序。连线**不代表**已验证的实车硬件连接、协议路径或故障因果。

车型、SoC、软硬件版本与真实接口仍须结合相应架构资料和本次项目证据核验；课程发布也不代表学习者已完成或掌握。

## 2、如何使用

1. 鼠标悬停星点可看到放大的标题、简短预览和突出显示的关联线；移开后恢复。点击星点后，它会平滑移动到画面中心；点击关联节点可以继续切换中心。
2. 左侧搜索主题、细分链路、章节或课程，或按节点类型筛选。点击“电源与生命周期”后，可依次进入 10 类主题及其下的 20 条路径。
3. 拖动旋转，滚轮或右下角按钮缩放；点击空白处或重置按钮返回总览。
4. 未选中节点且闲置约 10 秒后，银河缓慢旋转。可手动暂停，系统“减少动态效果”设置也会生效。
5. 在节点详情中打开公开阅读页：主题节点进入对应的入门章节，细分节点进入对应段落，章节和课程节点直达原文。原文在新标签页打开。

## 3、与原仓库的联动

数据源是原仓库公开发布的 `docs/index.html`、`docs/architecture/`、`docs/lessons/` 和 `content/learning-progress.json`。本仓库的 [GitHub Actions 更新流程](.github/workflows/update-graph.yml)会在北京时间 **20:45** 和次日 **09:35** 检查原仓库，重建并验证 `docs/graph.json`；索引有变化才提交，随后由 GitHub Pages 发布。也可在 Actions 页面手动运行该流程。定时任务可能受 GitHub 排队影响，因此更新不是实时的。

同步只读取这些公开页面和学习进度文件。原始资料目录由人工维护；自动更新不会覆盖它。本仓库不采集或上传私有日志、异常包、账号信息和内部项目证据。

电源分类由 [`content/power-taxonomy.json`](content/power-taxonomy.json)人工维护，来源链接只指向已公开的架构章节。原始资料分类由 [`content/raw-taxonomy.json`](content/raw-taxonomy.json)人工维护，分类目录在 `docs/raw-sources.json`；299 份原件均提供下载，其中 4 份大文件位于 [GitHub Release](https://github.com/qiantao18817568425-art/Cockpit_Knowledge_Galaxy/releases/tag/raw-sources-2026-10-16)。分类是学习索引，状态名、供电策略、跨域握手和唤醒线路是否适用于某辆车，仍须按车型、硬件、软件版本及实车证据确认。新增课程时，可在分类文件补充适用的细分链路；自动更新不会覆盖人工分类。

本地重建与检查：

```text
node scripts/build-graph.mjs --source <Architecture_Learning- 的本地路径>
node --test tests/graph.test.mjs
node scripts/serve.mjs
```
