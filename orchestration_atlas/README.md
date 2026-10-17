# 配器法理论地图与推演台

这个目录把 `E:\音乐学习笔记\配器法` 中的 7 册教材整理成一套可使用的工作台，而不是教材摘录：

- `app/`：交互式理论地图、技法卡、教材证据链和配器推演台。
- `docs/配器法手册.html`：可直接阅读的理论手册，包含历史阶段、声学判断、组合语法、实操流程和机制卡。
- `docs/books/`：按 PDF 物理页保存的教材原页、OCR 文本和论点锚点。
- `docs/assets/sources/snippets/`：从原页裁出的论点局部影印。
- `docs/assets/figures/`：由乐器数据生成的音域图和组合关系图。
- `corpus/`：定向 OCR 结果与书籍索引，不是全量 OCR。
- `evidence/`：网页和手册共享的结构化数据。
- `tests/`：数据完整性、推演规则、页码锚点和文案约束测试。

## 打开方式

在项目根目录运行：

```powershell
python tools/serve.py
```

然后打开 `http://127.0.0.1:8765/app/index.html`。手册入口是 `http://127.0.0.1:8765/docs/配器法手册.html`。服务器同时把 `/pdf/<book-id>#page=N` 映射到原教材 PDF 的对应页；不启动服务器时，静态页面、扫描图和局部影印仍然可以查看，原 PDF 链接不可用。

## 重新生成

完整流程：

```powershell
npm run build
npm test
```

也可以分步运行：

```powershell
node tools/export_data.js
python tools/build_figures.py
python tools/build_docs.py
python tools/build_snippets.py
```

`build_docs.py` 只渲染本手册实际引用的页面，并复用已有图片；`build_snippets.py` 只从这些页面裁切，不会重新光栅化或全量 OCR。若需要新增证据页，优先只处理明确页码，不要把整本书一次性送进 OCR。当前 `corpus/index.json` 的不完整标记是事实记录，不代表手册缺少已引用页的证据。

OCR 工具默认不选择任何书：必须明确传入 `--books`、`--ranges` 或 `--all`，否则会拒绝启动。先用 `--dry-run` 检查页码范围，再执行 OCR：

```powershell
python tools/ocr_books.py --ranges adler_1:16-17 --workers 1 --chunk 4 --scale 1.8 --dry-run
```

OCR 进程默认使用 1 个 worker、单线程数值库和 Windows 低优先级；只有显式增加 worker 才会提高并发。

## 证据口径

- **direct**：教材直接陈述，手册给出原文引句和页内锚点。
- **derived**：教材定义与声学条件合成的推论，手册明确标注，不把推论冒充原文。

页码一律以 PDF 物理页为准；书内印刷页码另列。点击手册或网页中的教材条目，会跳到对应论点锚点，而不是书页顶部。

## 边界

推演台是规则筛选器：它把结构层、角色、音区、力度、密度、持续和掩蔽转成候选方案，帮助排除明显冲突；它不作曲、不生成实际声部排列，也不代替试奏、总谱核对和厅堂判断。乐器音域与融合/穿透评级是工作数据，边缘音区和特殊技法仍须按具体演奏者核对。
