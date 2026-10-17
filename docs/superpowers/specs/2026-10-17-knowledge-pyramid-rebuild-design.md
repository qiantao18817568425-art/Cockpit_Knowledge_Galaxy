# 座舱知识银河金字塔重建设计规格

日期：2026-10-17  
状态：用户已通过，实施完成，等待 GitHub Pages 发布  
目标站点：`https://qiantao18817568425-art.github.io/Cockpit_Knowledge_Galaxy/`

## 1. 用户目标

把当前以平面关系和资料分类为主的知识银河，重建成可以逐层下钻的座舱知识工作台。用户点击任一知识点时，应先理解它在整机中的位置，再沿功能、子系统、组件、接口、机制、观测和证据逐层深入。页面必须解释技术关系如何形成以及引用为什么能支撑该关系，不能只把“属于某分类”改写成一句通用文案。

成功体验具有三个特征：

1. 用户始终知道“我现在位于哪一层、从哪里进入、下一层能看什么”。
2. 每个技术节点都回答“输入是什么、在本层做什么、输出给谁、如何观测、依据在哪里”。
3. 分类、技术链和证据链各司其职，分类关系不再冒充技术解释。

## 2. 当前问题与基线

当前发布图谱有 631 个节点，其中 586 个没有层级字段；只有 45 个电源或原始资料节点带 `parentId`。关系中有 710 条 `belongs_to`，而控制、数据、电源、状态和观测关系的数量远少于分类关系。

以“物理屏 / SerDes”为例，现有技术子图只有：

```text
Android HWC / SurfaceFlinger
        ↓ carries_data_to
Yocto DRM / Weston
        ↓ carries_data_to
物理屏 / SerDes
```

其余直接关联是“显示与触控、MT8668、MT8676”的分类关系。因此，现有阅读器即使增加“为什么有关”，也只能重复解释分类，不能提供系统位置、上下游机制和下一层知识。

## 3. 设计原则

### 3.1 一条主下钻路径

每个公开节点除根节点外必须有且只有一个 `primaryParentId`。主路径用于学习和导航；平台适用范围、运行域以及跨域技术关系使用独立字段或横向边表达，不通过多个父节点破坏树形路径。

### 3.2 主金字塔与横向技术链并存

- 金字塔回答“它属于哪一层、下一层是什么”。
- 技术链回答“控制、数据、电源或状态如何流动”。
- 证据链回答“哪份资料的哪一页支持哪条陈述”。

三类关系分开存储、分开展示、分别校验。

### 3.3 证据先于断言

技术解释来自结构化知识陈述和已绑定证据。只有分类信息时，页面显示“该节点已完成归类，但技术内容尚待吸收”，不生成看似完整的通用解释。

### 3.4 平台与版本是范围，不是默认父节点

MT8668、MT8676、T12T、PVT 和当前车型版本作为适用范围或变体关系展示。共享能力只建立一个知识节点，通过平台范围说明适用性；只有实现确有差异时才建立平台变体节点。

### 3.5 运行域边界必须可见

Android Guest、Yocto Host、MCU、TBox、Hypervisor 和物理设备边界在技术链上明确标识。跨域边必须显示协议或接口；未知时保持“待确认”，不猜测协议、VMID、GPIO、设备编号或时序。

## 4. 金字塔层级

### L0：知识根节点

- 座舱知识

### L1：知识入口

- 整机与平台
- 功能域
- 业务流程
- 跨域与生命周期
- 诊断与证据
- 原始资料
- 架构课程

### L2：领域或能力族

示例：显示与 HMI、Camera / AVM、音频与语音、电源与生命周期、虚拟化、Android AAOS、Yocto Host、MCU、TBox、网络、USB 与存储、安全与 TEE、稳定性与性能。

### L3：子系统或端到端业务链

示例：显示输出链、触摸输入链、AVM 视频流、Audio Playback、STR 进入、Resume 恢复、跨域消息交付、冷启动与 HMI Ready。

### L4：组件、接口与链路阶段

示例：SurfaceFlinger、HWC、DRM / Weston、SerDes、Panel、Binder、Vsock、SPI / IPCL、SleepManager、PMIC。

### L5：机制、状态、观测和失效表现

示例：validate / present、atomic commit、link lock、首帧 submit / present、STR 状态迁移、wakeup source、virtqueue callback、黑屏或 noirq abort。

### L6：知识陈述与原始证据

- 关系陈述
- 原始资料
- 文档版本
- 页码或章节
- 证据状态
- 适用范围和限制

课程与复盘节点放在“架构课程”分支；原始文档放在“原始资料”分支，同时通过 `supported_by` 与技术陈述连接。它们不混入功能域的主层级。

L0-L6 是功能知识分支的完整深度。原始资料和架构课程属于索引分支，可以在更浅层到达文件或课程；其 `hierarchyLevel` 仍按实际父链逐级递增，不用空节点强行补齐到 L6。

## 5. 节点数据结构

每个发布节点增加：

```json
{
  "primaryParentId": "chain:display-output",
  "hierarchyLevel": 4,
  "hierarchyOrder": 30,
  "branchType": "component",
  "knowledge": {
    "role": "该节点在所属链路中的职责",
    "input": ["上游输入或触发"],
    "mechanism": ["本节点处理或状态变化"],
    "output": ["下游输出或用户结果"],
    "observations": ["可验证输入、状态和输出的观测点"],
    "limits": ["版本、范围和未确认项"]
  }
}
```

规则：

- 根节点没有 `primaryParentId`，其余发布节点必须恰好有一个。
- `hierarchyLevel` 必须比父节点大 1。
- `knowledge.role` 不能只重复标题。
- 技术节点至少具有 input、mechanism、output 中的两类；缺失项显式标记为“资料尚未吸收”，不自动补写。
- observation 和 failure mode 必须说明其观测对象或失效对象。
- source 与 evidence 节点保留下载链接、版本、页码和证据状态。

## 6. 关系数据结构

### 6.1 层级关系

新增 `primary_contains`，只由 `primaryParentId` 生成，用于面包屑和逐层展开。旧的 `主题目录`、`主题归类`、`内容索引` 和大部分 `belongs_to` 不再进入技术解释区。

### 6.2 技术关系

保留并校验：

- `controls`
- `sends_to`
- `publishes`
- `carries_data_to`
- `powers`
- `depends_on`
- `transitions_to`
- `runs_on`
- `observed_by`
- `fails_as`
- `variant_of`
- `conflicts_with`

每条技术关系增加结构化解释：

```json
{
  "why": "这条边在正常业务中的技术含义",
  "input": "上游交付的对象",
  "handoff": "跨越的接口或边界",
  "output": "下游收到或产生的结果",
  "verification": ["两端可验证的日志、计数器或状态"]
}
```

没有 `why` 或没有证据状态的技术关系不进入默认发布层。

### 6.3 证据关系

`supported_by` 连接知识陈述与 evidence，evidence 再连接 source。引用区必须说明：

- 它具体支撑哪条技术关系或知识陈述。
- 是直接证据还是相邻链路背景。
- 页码和文档版本。
- `confirmed_current`、`documented_reference`、`inferred_mapping`、`conflicting` 或 `needs_visual_review`。
- 该证据不能证明什么。

## 7. 阅读与下钻交互

### 7.1 默认视图

中心保持“座舱知识”。只显示 L1 和少量高价值入口；空闲时保持现有 3D 银河旋转。

### 7.2 点击节点

点击后：

1. 选中节点成为视觉中心。
2. 显示祖先路径、同层少量相关节点和直接子节点。
3. 其余远层节点降低透明度或暂时隐藏。
4. 再次点击子节点进入下一层。
5. 面包屑支持逐级返回；主页按钮返回 L0。

### 7.3 详情面板顺序

1. **所在层级**：面包屑和层级名称。
2. **本层职责**：role、input、mechanism、output。
3. **继续向下钻**：直接子节点卡片及其承担的问题。
4. **正常技术链**：控制、数据、电源和状态分别显示，不混为一个列表。
5. **跨域边界**：两端运行域、接口和待确认项。
6. **如何验证**：观测点、正常预期和证据缺口。
7. **引用与证据**：支持的陈述、页码、状态、加载和下载。
8. **导航关系**：折叠显示，仅用于说明归类。

### 7.4 禁止的页面行为

- 不把“归入某知识域”放在技术解释首位。
- 不把平台标签解释成物理连接。
- 不用同一模板为所有关系生成“为什么有关”。
- 不因存在资料链接就宣称已完成内容吸收。
- 不把单一观测点正常解释成端到端正常。

## 8. 显示与 SerDes 验收样板

### 8.1 主下钻路径

```text
座舱知识
└─ 功能域
   └─ 显示与 HMI
      └─ 显示输出链
         ├─ Android HWC / SurfaceFlinger
         ├─ Yocto DRM / Weston
         ├─ 物理屏 / SerDes
         └─ 背光
```

上述四个 L4 组件继续向 L5 展开接口、机制、状态、观测点和失效表现；原始资料与页码作为 L6 证据，不在 L3 与 L4 之间额外插入无技术内容的分组节点。

### 8.2 正常数据链

```text
Android HWC / SurfaceFlinger
        ↓ 图层合成与提交
Yocto DRM / Weston
        ↓ scanout / 显示数据输出
物理屏 / SerDes
        ↓
用户可见画面
```

### 8.3 当前可发布证据边界

现有 `MT8676_Hypervisor_Display_User_Manual_V1.3.pdf` 第 16 页已绑定：

- Android HWC / SurfaceFlinger → Yocto DRM / Weston
- Yocto DRM / Weston → 物理屏 / SerDes
- Android HWC / SurfaceFlinger → 首帧 submit / present
- MCU → 背光

这些关系当前状态为 `documented_reference`。页面可以说明它们在资料中的参考链路，但不能据此固定当前车型的物理屏编号、SerDes 器件型号、接线、GPIO、displayId 或完整时序。

### 8.4 样板通过条件

- “物理屏 / SerDes”的首屏不再出现分类模板作为主要解释。
- 用户能从根节点逐级进入该节点，也能返回任一祖先层。
- 页面明确给出职责、上游、下游、跨域边界、观测点和证据页。
- 控制链、数据链、背光/电源链分开展示。
- 缺少页级依据的 SerDes 子结构显示为待吸收，不生成确定性描述。

## 9. 全图迁移策略

1. 建立 L0-L6 层级字典和唯一父节点校验器。
2. 为现有 root、topic、subtopic、domain、platform、component、interface、state、process、observation、failure mode、course、source 和 evidence 建立主父节点。
3. 将平台和运行域从重复分类边转为范围字段和横向关系。
4. 将领域包中的标题复述型 description 替换为 role/input/mechanism/output 结构；证据不足的节点标记为待吸收。
5. 先完成显示与 SerDes 样板并通过自动测试和浏览器验收。
6. 按相同模型迁移电源、虚拟化、跨域、MCU、Camera、音频、网络、USB、稳定性、性能、安全与 TEE 等领域。
7. 重建 `docs/graph.json`，保留旧链接和下载入口。

迁移期间构建产物不得出现孤立节点、循环父链、跳级父子关系或分类边进入技术解释区。

## 10. 前端和构建边界

### 数据与构建

- 新增 `content/hierarchy.json` 保存主层级节点和排序。
- 扩展 `content/domain-packs/*.json` 的节点知识字段和关系解释字段。
- `scripts/build-graph.mjs` 合并层级、技术关系、证据和资料索引，并执行发布校验。
- `docs/graph.json` 继续作为静态页面唯一运行时数据入口。

### 前端

- `docs/graph-model.js` 生成面包屑、子节点、分路径技术链和证据模型。
- `docs/app.js` 管理逐层聚焦、可见节点集合和详情面板。
- `docs/index.html` 增加面包屑、本层职责、向下钻、正常链路、如何验证和折叠导航区。
- `docs/style.css` 保持现有银河与节点风格，增加金字塔层级和路径分组样式。
- Markdown 下载必须与网页包含相同层级、技术解释和证据边界。

不引入后端服务和新框架，继续使用静态 GitHub Pages、原生 JavaScript、Canvas 和 JSON。

## 11. 验证与测试

### 构建校验

- 除 root 外每个发布节点恰好一个 `primaryParentId`。
- 父节点存在，层级连续，父链无循环。
- 所有发布节点可从 root 到达。
- 技术关系与分类关系类型分离。
- 默认发布的技术关系具有 `why` 和证据状态。
- evidence 能回溯到 source、页码或章节及下载链接。

### 模型测试

- 面包屑顺序正确。
- 点击只展开直接子层和必要横向技术邻居。
- 分类边不进入技术解释列表。
- 控制、数据、电源、状态和诊断路径分组正确。
- 缺少技术内容的节点显示待吸收状态。
- 页面与 Markdown 输出一致。

### 样板测试

- “座舱知识 → 功能域 → 显示与 HMI → 显示输出链 → 物理屏 / SerDes”完整可达。
- Android HWC / SurfaceFlinger → Yocto DRM / Weston → 物理屏 / SerDes 顺序不被分类边打乱。
- 第 16 页证据只支撑已绑定关系，不能自动扩展为具体器件或接线事实。
- MCU → 背光位于控制/电源相关区，不与像素数据链合并。

### 浏览器验收

- 桌面和移动端都能逐级进入、返回和继续展开。
- 3D 自动旋转、拖动、缩放、悬停放大和搜索保持可用。
- 详情区首屏能回答职责、上下游和证据，不以分类提示占据主体。
- GitHub Pages 部署后抽样显示、虚拟化、电源和原始资料分支。

## 12. 交付阶段

1. 层级数据模型、校验器和面包屑模型。
2. 显示与 SerDes 完整样板。
3. 逐层 3D 聚焦与详情面板重构。
4. 其余领域全图迁移。
5. 全量测试、独立代码复审、GitHub 提交和 Pages 线上验证。

每一阶段都采用测试驱动：先写会失败的行为测试，再实现最小代码使其通过。只有样板通过后才批量迁移其他领域。

## 13. T12T 技能覆盖与证据限制

本规格按用户指定的 F 盘路径读取并检查全部 21 个 T12T 优化版技能。实际深入应用：

- `t12t-platform-architecture`：层级、运行域、控制/数据/电源路径和观测点。
- `t12t-display-black-freeze`：显示四层、物理屏映射、SerDes、背光和首帧观测边界。
- `t12t-cross-domain-msg`、`t12t-virtualization-tee`：Android Guest、Yocto Host 与虚拟化边界。
- `t12t-power-sleep-str`、`t12t-mcu`：屏幕电源、背光控制和 MCU 边界。
- `t12t-log-analysis`、`t12t-tpm-triage`：证据分级、缺失证据、责任和验证边界。

其余专项用于全图领域适用性检查和后续迁移约束。现有领域包中的页级关系多为资料参考状态；本次重建改善知识结构和解释方式，不把尚未重新核对的原始资料提升为当前车型已确认事实。

