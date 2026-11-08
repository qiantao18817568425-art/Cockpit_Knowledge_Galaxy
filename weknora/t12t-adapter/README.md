# T12T 优化版技能接入 WeKnora

本目录只包含适配工具和用法。原始 21 项技能及参考资料从你的本地目录读取，生成一个用于 WeKnora 的 ZIP；它们和生成的 ZIP 不提交到公开 GitHub 仓库。

## 生成技能包

需要 Python 3.10 或更新版本，无需安装依赖。在仓库根目录运行 PowerShell：

```powershell
$skillSource = 'F:\座舱日志分析\交付物\T12T诊断技能家族-优化版'
python .\weknora\t12t-adapter\build_bundle.py --source $skillSource --output .\weknora\t12t-adapter\t12t-cockpit-suite.zip
python -m unittest discover -s .\weknora\t12t-adapter\tests -v
```

若 F 盘源目录不可用，可将 `--source` 指向已经安装的 `C:\Users\<用户名>\.agents\skills`。选择一个完整来源；缺少任何入口或包内引用时，生成器会报错，不会自动混用两个目录。打包不会修改源文件。生成器仅收集指定的 21 个技能目录中的 Markdown 文件，忽略其他技能。

ZIP 根部的 `SKILL.md` 是 WeKnora 注册的整套入口。原始的 21 个 `SKILL.md` 和参考资料位于 `references/skills/<skill-name>/`；`references/source-manifest.json` 记录原始相对路径、字节数与 SHA-256。相同输入会得到相同 ZIP 字节。原有相对链接在包内保留。

## 导入 WeKnora

1. 在已部署的 WeKnora 中配置可用的 Docker、CubeSandbox 或 E2B 沙箱。Windows 上不依赖 Lite 的 macOS 本机沙箱。
2. 打开「工具箱 → 技能管理」，上传本地生成的 ZIP，把它安装到所选沙箱，等待安装状态为就绪。
3. 在智能体编辑器的「技能」区域选中该沙箱和 `t12t-cockpit-suite`，使用**智能推理**模式。提问时可用 `@t12t-cockpit-suite` 指明本技能。
4. 将允许入库的架构资料和已脱敏案例单独导入知识库，并按车型、SoC、软件/硬件版本组织。技能包提供分析方法；知识库提供可引用的案件资料。

WeKnora 的 [技能与沙箱文档](https://github.com/Tencent/WeKnora/blob/main/website-docs/03-features/22-skills-sandbox.md)说明了上传、安装及智能体选择流程。当前公开的 `Cockpit_Knowledge_Galaxy` 仓库体积较大，WeKnora 从 GitHub URL 导入时会下载整仓压缩包；这里使用本地 ZIP 上传。

## 现场验收

- 提问一条 T12T 架构链路，检查工具记录中是否先读取综合路由、日志分析和平台架构三个入口，再读取其余 18 个，并对相关参考资料深入查阅。回答应注明车型/版本未知项、各运行域边界和技能来源。
- 提供一份**已脱敏**的故障样本，检查回答是否保留原始文件位置、跨域时基与 boot/VM generation，区分直接失效和上游假设。只检索不到某个关键词时，回答应标为未观测。
- 检查本次 ZIP 中的 `references/source-manifest.json` 与你保留的本地源文件散列一致。技能更新后重新生成 ZIP 并在 WeKnora 升级安装。

目前的自动测试验证打包结构、原文件字节、断链拒绝和可重复生成；实际 WeKnora 安装及模型逐项读取行为，需要在你的实例中完成以上现场验收。

