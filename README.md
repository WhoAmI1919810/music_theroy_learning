# 音乐理论工作台

四套可直接在浏览器运行的静态学习系统：

- **和声推演台 Harmony Atlas**：和声进行、功能与声部连接、转调、和弦库、音级集合、理论地图，以及带教材页锚点的和声学手册。
- **曲式理论地图 Form Atlas**：从动机、乐句、终止与调性布局出发，连接二部、三部、回旋、变奏、奏鸣与套曲等类型；用概念关系图、结构条带、作品案例和教材页依据组织分析。
- **配器推演台 Orchestration Atlas**：结构分层、乐器音域、频谱与掩蔽、力度与密度校验、历史阶段、配器机制卡，以及带教材页锚点的配器法手册。
- **复调教程与推演台 Counterpoint Atlas**：十课复调教程、五类对位、复对位、2–6 声部多轮卡农、可录入带时值主题的赋格逐段计划、声部检查器，以及按历史阶段组织、可回查 40 条论点的复调手册。

## 在线入口

主页：<https://whoami1919810.github.io/music_theroy_learning/>

- 和声推演台：`/harmony_atlas/app/`
- 和声学手册：`/harmony_atlas/docs/和声学手册.html`
- 曲式理论地图：`/form_atlas/app/`
- 曲式学手册：`/form_atlas/docs/曲式学手册.html`
- 曲式教材证据：`/form_atlas/docs/books/`
- 配器推演台：`/orchestration_atlas/app/`
- 配器法手册：`/orchestration_atlas/docs/配器法手册.html`
- 复调推演台：`/counterpoint_atlas/app/`
- 复调教程：`/counterpoint_atlas/tutorial/`
- 复调音乐手册：`/counterpoint_atlas/docs/复调音乐手册.html`
- 复调教材证据：`/counterpoint_atlas/docs/books/`

所有计算在浏览器本地完成，不需要后端服务。

全站页面顶部共用 `site-nav.js` 菜单：可返回上一页，也可直接跳转到工作台、四套系统、理论手册与教材证据索引。菜单在滚动时保持吸顶，使用相对路径适配 GitHub Pages 的项目子路径，并在窄屏下折叠为两列跳转面板。

四套系统的理论手册均配有与其论证结构相符的图示：和声的转调网络、配器的层次与音域图、复调的阶段与对位网络、曲式的概念关系图与结构条带。需要原表核对时保留“展开原始表格”，便于复制和打印。和声 6.3 的转调图覆盖 32 个目标调式，可按关系筛选，并展开每条路线的完整和弦链。

## 目录

```text
index.html                     响应式入口页
manual-visuals/                复调与配器手册共享的表图脚本与样式
harmony_atlas/                 和声系统
  app/                         交互式推演台
  docs/和声学手册.html          理论手册
  docs/books/                  手册引用的教材页锚点
  docs/assets/books/           对应页影印
  evidence/ corpus/            结构化证据与 OCR
form_atlas/                    曲式系统
  app/                         曲式理论地图与作品案例
  docs/曲式学手册.html          理论手册与教材依据
  docs/books/                  7 本教材的 48 个引用页锚点
  docs/assets/books/           对应页影印
  evidence/ corpus/            概念网络、案例、教材证据与 OCR
orchestration_atlas/           配器系统
  app/                         交互式推演台
  docs/配器法手册.html          理论手册
  docs/books/                  教材页锚点
  docs/assets/                 影印局部、图表与示例
  evidence/ corpus/            结构化证据与 OCR
counterpoint_atlas/            复调系统
  tutorial/                    十课复调教程
  app/                         五类对位、多声部卡农、自定义主题赋格与声部检查器
  docs/复调音乐手册.html        按历史阶段组织的理论手册
  docs/books/                  40 条论点、76 个引用页的教材页锚点与扫描页
  docs/复调音乐理论体系.md      手册源文件
  evidence/ corpus/            结构化证据、书目与 OCR
```

## 公开部署范围

和声系统本地完整资料约 1.6 GB，其中包含大量未引用扫描页、浏览器产物和缓存。公开版本不原样搬运这些内容，而是保留：

- 完整应用代码、理论手册与理论文本；
- 和声与曲式手册实际引用的全部 374 个教材页；
- 对应页的整页影印、页内论点锚点和 OCR；
- 结构化证据、定向 OCR 与测试工具。

复调系统本地资料为 19 个 PDF 文件，去重后 18 本独立教材。新增的希格斯《赋格曲》是独立教材；另一个姚世泽文件与已有文件 SHA-256 相同，因此不重复计算。公开版保留手册实际引用的 18 本教材、76 个页面、83 条引用、40 条论点锚点和对应短引文，不上传整本 PDF。

曲式系统收录钱亦平《音乐作品分析简明教程》上下册、该丘斯《大型曲式学》、李吉提《曲式与作品分析》、李贞华《曲式与作品分析实用教程》、吴祖强《曲式与作品分析》和勋伯格 *Fundamentals of Musical Composition* 共 7 本教材。公开版保留 17 条论点、10 种曲式、19 个作品案例、19 个概念节点与 23 条关系边，以及 48 个实际引用页的整版影印和 OCR。

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

cd ..\form_atlas
npm test
```

配器系统的完整数据重建命令是 `npm run build`，依赖 Node.js 与 Python，并使用本地教材源文件；仓库中的部署数据已生成好，在线阅读不需要执行构建。

复调系统的 `npm run build` 会重建证据页、浏览器证据数据和理论手册。手册源文件使用少量 Markdown 扩展：标题可用 `{#anchor}` 指定锚点，`[[claim:claim-id]]` 会生成指向教材页具体论点的引用。曲式系统的 `npm run build` 会从同一份证据数据重建理论数据、教材页和手册；运行前需准备本地教材 PDF。

和声、配器与复调的构建命令会在最后运行 `tools/inject_site_nav.py`；曲式构建器直接写入共享菜单和主题标签。仓库根目录的 `tools/check_site.py` 可检查四套系统的导航覆盖、内部链接和锚点。

## 证据与边界

教材页码使用 PDF 物理页。手册中的引用链接会跳到具体论点锚点，而不是只打开书页顶部。OCR 用于检索和复制，谱例、临时记号、罗马数字与连线应以影印图为准。

推演工具是规则筛选器，不作曲、不替代试奏和总谱核对。和声、配器与复调结论都应结合实际作品、演奏条件与听感复核。曲式系统不替用户判定曲式；它把材料、终止、调性、比例与教材案例放在同一条证据链上，最终判断仍须回到完整乐谱和听觉体验。复调生成器给出的是规则合格的结构骨架：卡农会展开全部声部与轮次，赋格会规划主题、答题、对题候选和每个段落的任务，但仍不生成完整可演奏作品。

## 版权说明

代码与原创说明按仓库 `LICENSE` 发布。教材扫描页、OCR 文本、谱例与引文的权利归原作者及出版方所有，仅用于学习、研究与论点核验；如权利人认为需要调整，请通过仓库 Issue 联系。
