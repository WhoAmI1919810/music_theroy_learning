# 音乐理论工作台

三套可直接在浏览器运行的静态学习系统：

- **和声推演台 Harmony Atlas**：和声进行、功能与声部连接、转调、和弦库、音级集合、理论地图，以及带教材页锚点的和声学手册。
- **配器推演台 Orchestration Atlas**：结构分层、乐器音域、频谱与掩蔽、力度与密度校验、历史阶段、配器机制卡，以及带教材页锚点的配器法手册。
- **复调教程与推演台 Counterpoint Atlas**：十课复调教程、五类对位、复对位、卡农、赋格结构骨架、声部检查器，以及按历史阶段组织、可回查 40 条论点的复调手册。

## 在线入口

主页：<https://whoami1919810.github.io/music_theroy_learning/>

- 和声推演台：`/harmony_atlas/app/`
- 和声学手册：`/harmony_atlas/docs/和声学手册.html`
- 配器推演台：`/orchestration_atlas/app/`
- 配器法手册：`/orchestration_atlas/docs/配器法手册.html`
- 复调推演台：`/counterpoint_atlas/app/`
- 复调教程：`/counterpoint_atlas/tutorial/`
- 复调音乐手册：`/counterpoint_atlas/docs/复调音乐手册.html`
- 复调教材证据：`/counterpoint_atlas/docs/books/`

所有计算在浏览器本地完成，不需要后端服务。

## 目录

```text
index.html                     响应式入口页
harmony_atlas/                 和声系统
  app/                         交互式推演台
  docs/和声学手册.html          理论手册
  docs/books/                  手册引用的教材页锚点
  docs/assets/books/           对应页影印
  evidence/ corpus/            结构化证据与 OCR
orchestration_atlas/           配器系统
  app/                         交互式推演台
  docs/配器法手册.html          理论手册
  docs/books/                  教材页锚点
  docs/assets/                 影印局部、图表与示例
  evidence/ corpus/            结构化证据与 OCR
counterpoint_atlas/            复调系统
  tutorial/                    十课复调教程
  app/                         五类对位、卡农、赋格与声部检查器
  docs/复调音乐手册.html        按历史阶段组织的理论手册
  docs/books/                  40 条论点的教材页锚点与扫描页
  docs/复调音乐理论体系.md      手册源文件
  evidence/ corpus/            结构化证据、书目与 OCR
```

## 公开部署范围

和声系统本地完整资料约 1.6 GB，其中包含大量未引用扫描页、浏览器产物和缓存。公开版本不原样搬运这些内容，而是保留：

- 完整应用代码、理论手册与理论文本；
- 手册实际引用的全部 194 个教材页；
- 对应页的整页影印、页内论点锚点和 OCR；
- 结构化证据、定向 OCR 与测试工具。

复调系统本地资料为 19 个 PDF 文件，去重后 18 本独立教材。新增的希格斯《赋格曲》是独立教材；另一个姚世泽文件与已有文件 SHA-256 相同，因此不重复计算。公开版保留手册实际引用的 10 本教材、46 个页面、40 条论点锚点和对应短引文，不上传整本 PDF。

`_work/`、`__pycache__/`、浏览器配置和未引用扫描页不进入仓库。

## 本地运行

在仓库根目录运行任意静态服务器：

```powershell
python -m http.server 8765
```

然后打开 `http://127.0.0.1:8765/`。

也可以分别运行：

```powershell
cd harmony_atlas
npm test

cd ..\orchestration_atlas
npm test

cd ..\counterpoint_atlas
npm test
```

配器系统的完整数据重建命令是 `npm run build`，依赖 Node.js 与 Python，并使用本地教材源文件；仓库中的部署数据已生成好，在线阅读不需要执行构建。

复调系统的 `npm run build` 会重建证据页、浏览器证据数据和理论手册。手册源文件使用少量 Markdown 扩展：标题可用 `{#anchor}` 指定锚点，`[[claim:claim-id]]` 会生成指向教材页具体论点的引用。

## 证据与边界

教材页码使用 PDF 物理页。手册中的引用链接会跳到具体论点锚点，而不是只打开书页顶部。OCR 用于检索和复制，谱例、临时记号、罗马数字与连线应以影印图为准。

推演工具是规则筛选器，不作曲、不替代试奏和总谱核对。和声、配器与复调结论都应结合实际作品、演奏条件与听感复核。复调生成器给出的是规则合格的结构骨架，不是完整可演奏作品。

## 版权说明

代码与原创说明按仓库 `LICENSE` 发布。教材扫描页、OCR 文本、谱例与引文的权利归原作者及出版方所有，仅用于学习、研究与论点核验；如权利人认为需要调整，请通过仓库 Issue 联系。
