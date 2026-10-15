# 座舱知识银河

独立的 Obsidian 式 3D 关系图工作台。图谱从[座舱架构学习公开站点](https://qiantao18817568425-art.github.io/Architecture_Learning-/architecture/index.html)提取 25 章中文架构正文及 67 条 Day/Week 课程，点击节点可打开原文。

## 使用

- 拖动画布旋转视角，滚轮或右下角按钮缩放。
- 搜索章节、课程与主题；搜索时自动旋转暂停。
- 点击节点查看来源和相邻节点；闲置约 10 秒后恢复缓慢旋转。
- 可筛选主题、章节、Day、Week，并单独显示课程顺序连线。
- 遵循系统的“减少动态效果”设置；可手动开启旋转。

图中的连线仅表示**主题目录、主题归类或课程顺序**。它们不表示已验证的实车硬件连接、协议关系或故障因果。车型、SoC、软件版本与实际链路应回到原文和本次项目证据核验。

## 数据与更新

`docs/graph.json` 由 `scripts/build-graph.mjs` 从已公开的 `Architecture_Learning-` 仓库生成。GitHub Actions 每日重新读取公开仓库，有变化时提交新索引。这个仓库不采集、不上传私有日志、原始异常包、账号或内部项目证据。

本地更新：

```text
node scripts/build-graph.mjs --source <Architecture_Learning- 的本地路径>
node --test tests/graph.test.mjs
node scripts/serve.mjs
```

GitHub Pages 发布目录：`main` 分支的 `docs/`。

