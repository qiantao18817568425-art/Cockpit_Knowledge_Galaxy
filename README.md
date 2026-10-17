# 座舱知识银河

本仓库是独立的 **Obsidian 式 3D 座舱知识关系图**。它把公开架构课程与 299 份去重原始资料整理为可追溯的实体、接口、状态、流程、观测点和失效模式。每条默认显示的技术关系带有来源和页码证据，并区分资料参考、推断映射、冲突和待视觉核对。

## 在线阅读入口

| 内容 | 在线地址 | 主要用途 |
| --- | --- | --- |
| **1、座舱知识银河** | [打开 3D 关系图](https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/) | 搜索主题、切换中心节点、查看关联和课程顺序。 |
| **2、座舱架构实践** | [打开架构章节](https://qiantao18817568425-art.github.io/Architecture_Learning-/architecture/index.html) | 阅读平台、运行域、模块职责与业务链路。 |
| **3、座舱架构学习** | [打开每日与每周课程](https://qiantao18817568425-art.github.io/Architecture_Learning-/) | 按 Day / Week 学习与复盘。 |
| **4、原始资料** | [打开分类目录](https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/raw-sources.html) | 按 15 个类别检索 299 份去重资料及其图谱关系；299 份原件均可下载。 |
| **5、知识覆盖报告** | [打开覆盖报告](https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/knowledge-coverage.html) | 查看 299 份资料的处理状态、平台、分类、压缩包成员与视觉核对队列。 |

图谱和原站均公开发布，无需 GitHub 登录即可阅读。GitHub Pages 使用本仓库 `main` 分支的 `docs/` 目录。

## 1、图谱里有什么

- **主题星系**：整机与平台、虚拟化、Android AAOS、Yocto Host、MCU、TBox、显示、Camera、音频、电源、跨域通信和诊断等入口；主题采用球面分布，配合多层星云、视差星尘和景深形成深空星图。
- **电源细分链路**：10 类主题下展开 20 条路径，分别学习车辆输入与策略、MCU 握手、供电、Guest/Host/Hypervisor 准备、Suspend 各阶段、真实唤醒、TBox/RTC、业务恢复，以及“睡不下去”和“睡着后电流偏高”的不同证据。每条路径连接有对应内容的公开章节与课程。
- **架构章节**：索引原站的中文版架构正文。
- **原始资料**：独立主题与 15 个分类节点，连接相关架构章节，并提供 299 份去重资料的检索目录。资料是否适用于当前车型仍须按版本核对。
- **Day 课程与 Week 复盘**：索引原站公开的专题内容；页面左侧显示当前实际收录数量。
- **语义知识层**：包含 106 个平台、域、组件、接口、状态、流程、观测点和失效模式实体，以及 72 条带证据的技术关系；手册版本差异会保留为 `conflicting`。
- **MT8668 / MT8676 平台关系**：共享模块同时挂接两个平台，平台专属模块保留单平台范围；两个平台通过带双份资料证据的共同族关系直接相连。
- **完整导航桥接**：座舱知识入口经主题连接知识域，知识域连接实体，平台连接适用实体，299 份来源连接其 `knowledgeIds`，避免出现无归属节点。
- **控制、数据、电源和诊断路径**：四类连线分色显示，可单独筛选。
- **证据层**：默认隐藏；选中知识点后点击“展开所选节点证据”，只显示相关页码证据和原始资料，避免 299 个来源节点淹没主图。

车型、SoC、软硬件版本与真实接口仍须结合相应架构资料和本次项目证据核验；课程发布也不代表学习者已完成或掌握。

## 2、如何使用

1. 鼠标悬停星点可看到放大的标题、简短预览和突出显示的关联线；移开后恢复。点击星点后，它会平滑移动到画面中心；点击关联节点可以继续切换中心。
2. 左侧可按别名搜索，按 MT8668/MT8676 平台或控制、数据、电源、诊断路径筛选。点击“电源与生命周期”可查看 MCU、Yocto、Hypervisor、Guest、Kernel、ATF、SPM、PMIC 和 MT6363 的分层关系。
3. 银河旋转时只显示转到镜头前方的一组节点名称；其他节点保留为发光星点，悬停、搜索或点击时立即显示完整名称。拖动会产生惯性，滚轮或右下角按钮可缩放；点击空白处或重置按钮返回总览。
4. 未选中节点且闲置约 10 秒后，银河以三轴轻微漂移的方式缓慢巡航。可手动暂停，系统“减少动态效果”设置也会生效。
5. 详情面板显示运行域、平台范围、证据状态、来源、页码和下载链接。`documented_reference` 表示资料描述，不能直接当作当前车辆已确认事实。

## 3、与原仓库的联动

数据源是原仓库公开发布的 `docs/index.html`、`docs/architecture/`、`docs/lessons/` 和 `content/learning-progress.json`。本仓库的 [GitHub Actions 更新流程](.github/workflows/update-graph.yml)会在北京时间 **20:45** 和次日 **09:35** 检查原仓库，重建并验证 `docs/graph.json`；索引有变化才提交，随后由 GitHub Pages 发布。也可在 Actions 页面手动运行该流程。定时任务可能受 GitHub 排队影响，因此更新不是实时的。

同步只读取这些公开页面和学习进度文件。原始资料目录由人工维护；自动更新不会覆盖它。本仓库不采集或上传私有日志、异常包、账号信息和内部项目证据。

知识实体和证据位于 [`content/domain-packs`](content/domain-packs)，299 份资料的公开处理登记位于 [`content/source-register.json`](content/source-register.json)。原始资料分类由 [`content/raw-taxonomy.json`](content/raw-taxonomy.json)维护；4 份大文件位于 [GitHub Release](https://github.com/qiantao18817568425-art/Cockpit_Knowledge_Galaxy/releases/tag/raw-sources-2026-10-16)。状态名、供电策略、跨域握手和唤醒线路是否适用于某辆车，仍须按车型、硬件、软件版本及实车证据确认。

本地重建与检查：

```text
node scripts/build-graph.mjs --source <Architecture_Learning- 的本地路径>
node --test tests/graph.test.mjs
node scripts/serve.mjs
```

