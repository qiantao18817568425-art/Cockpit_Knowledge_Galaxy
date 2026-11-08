# WeKnora T12T 整套技能适配设计

日期：2026-11-08

## 目的与范围

让用户在 WeKnora 的智能推理模式中使用本地 T12T 优化版 21 项诊断技能。GitHub 仓库只保存适配工具、示例和说明；21 项技能正文及 25 份参考资料只从用户指定的本地目录读取，在本地生成 ZIP，不提交到公开仓库。原始日志、异常包和车辆资料也不由此工具上传。

## 方案选择

- **采用：一个整套技能 ZIP。** 根部只有一个供 WeKnora 注册的 `SKILL.md`；21 项原始入口与参考资料作为包内资源保存。这样可以一次安装，并在同一包里保持专项间相对引用。
- 备选：21 个独立 ZIP。需要分别安装与维护，跨技能参考资料容易断链。
- 备选：从现有 GitHub 仓库 URL 直接安装。该仓库体积较大，而 WeKnora 的 GitHub 导入会下载整仓归档，可能触及技能包上限；同时用户要求不公开原始技能。

## 交付结构

在本仓库新增 `weknora/t12t-adapter/`：

- `build_bundle.py`：仅用 Python 标准库，从显式指定的本地技能家族目录读取 21 个 `SKILL.md` 和对应资料，生成单个 ZIP。
- `tests/test_build_bundle.py`：用临时合成素材验证完整打包、缺少入口、断开的相对引用、路径安全和可重复生成。
- `README.md`：Windows 运行示例、WeKnora 导入步骤、验收示例及局限。
- `.gitignore`：防止本地 ZIP 误入仓库。

ZIP 根部为 `SKILL.md`，原有资料在 `references/skills/<skill-name>/...`，另有 `references/source-manifest.json` 记录每个文件的相对路径与 SHA-256。生成时不改写原始入口和资料；专项间的 `../...` 链接保持可解析。ZIP 的根入口说明 WeKnora 通过 `read_file(path="skill://t12t-cockpit-suite/...")` 读取包内资源。

## 行为要求

每次座舱日志或架构分析先读取综合路由、日志分析、平台架构三个入口，再读取其余 18 个并检查适用性；仅深入读取相关参考资料。结论必须区分当前证据、假设与缺口，保留车型/SoC/版本、跨域时间与 boot/VM generation；不得把知识库检索不到视为事件未发生，不根据包内命令自行操作设备。结果说明技能来源、21 项覆盖情况和实际深入的专项。

生成器对缺失入口、缺失参考文件、非法路径、符号链接和断开的包内相对引用立即失败，不输出可误导的“完整”ZIP。重复打包同一批输入得到相同 ZIP 字节。

## 验收

1. 用合成目录先看到缺失/断链用例失败，再运行完整测试通过。
2. 对用户本地 F 盘优化版执行打包，确认 ZIP 有根入口、21 项入口、25 份参考资料与 manifest，包内引用全部可解析，原始文件散列与输入一致。
3. 核查 GitHub 分支与 PR 中只有适配代码、示例和设计文档，没有原始技能、日志或生成的 ZIP。
4. WeKnora 实例未提供时，实际安装、沙箱状态和模型是否逐项读取 21 项只能列为待现场验证，不宣称已通过。

WeKnora 技能包依据：[官方技能与沙箱文档](https://github.com/Tencent/WeKnora/blob/main/website-docs/03-features/22-skills-sandbox.md)、[ZIP 解析源码](https://github.com/Tencent/WeKnora/blob/main/internal/application/service/tenant_skill_bundle.go)。
