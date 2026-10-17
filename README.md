# 音乐理论工作台

两套可直接在浏览器运行的静态学习系统：

- **和声推演台 Harmony Atlas**：和声进行、功能与声部连接、转调、和弦库、音级集合、理论地图，以及带教材页锚点的和声学手册。
- **配器推演台 Orchestration Atlas**：结构分层、乐器音域、频谱与掩蔽、力度与密度校验、历史阶段、配器机制卡，以及带教材页锚点的配器法手册。

## 在线入口

主页：<https://whoami1919810.github.io/music_theroy_learning/>

- 和声推演台：`/harmony_atlas/app/`
- 和声学手册：`/harmony_atlas/docs/和声学手册.html`
- 配器推演台：`/orchestration_atlas/app/`
- 配器法手册：`/orchestration_atlas/docs/配器法手册.html`

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
```

## 公开部署范围

和声系统本地完整资料约 1.6 GB，其中包含大量未引用扫描页、浏览器产物和缓存。公开版本不原样搬运这些内容，而是保留：

- 完整应用代码、理论手册与理论文本；
- 手册实际引用的全部 194 个教材页；
- 对应页的整页影印、页内论点锚点和 OCR；
- 结构化证据、定向 OCR 与测试工具。

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
```

配器系统的完整数据重建命令是 `npm run build`，依赖 Node.js 与 Python，并使用本地教材源文件；仓库中的部署数据已生成好，在线阅读不需要执行构建。

## 证据与边界

教材页码使用 PDF 物理页。手册中的引用链接会跳到具体论点锚点，而不是只打开书页顶部。OCR 用于检索和复制，谱例、临时记号、罗马数字与连线应以影印图为准。

推演工具是规则筛选器，不作曲、不替代试奏和总谱核对。和声与配器结论都应结合实际作品、演奏条件与听感复核。

## 版权说明

代码与原创说明按仓库 `LICENSE` 发布。教材扫描页、OCR 文本、谱例与引文的权利归原作者及出版方所有，仅用于学习、研究与论点核验；如权利人认为需要调整，请通过仓库 Issue 联系。