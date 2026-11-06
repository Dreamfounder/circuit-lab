# Circuit Lab v1.5 网页升级包（图标在根目录）

适用于当前仓库：图标已上传在仓库根目录，没有 `icons/` 文件夹。

## 升级步骤

1. 把本文件夹里的全部文件上传到 GitHub 仓库根目录，覆盖同名文件。
2. Commit changes。
3. 等 GitHub Pages 构建 1～2 分钟。
4. 强制刷新网页：
   - Windows：Ctrl + F5
   - Mac：Cmd + Shift + R
   - iPhone：从主屏幕删除旧图标，再重新“添加到主屏幕”。

## 这版新增

- 三输入门：AND3 / OR3 / NAND3 / NOR3 / XOR3 / XNOR3
- 调色板新增“三输入门”分区
- F1 = x·y·z′ 可以直接用一个 AND3，也可以用两个 AND 级联
- Service Worker 缓存升级为 `circuitlab-pwa-1.5`

## 文件说明

- `defs.js`、`ui.js`：三输入门逻辑与符号
- `index.html`、`manifest.webmanifest`、`sw.js`：根目录图标路径 + v1.5 缓存
- `engine.js`、`levels.js`、`styles.css`：与 v1.5 Android 版同步
