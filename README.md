# Circuit Lab · GitHub Pages 网页版

这个文件夹是**可以直接上传到 GitHub 仓库根目录**的 GitHub Pages 版本。  
上传后，iPhone / iPad / 电脑都可以通过一个 HTTPS 网址打开；iPhone Safari 还能“添加到主屏幕”当 PWA 用。

> 19 关、教学卡、仿真器、Canvas 画面和 PWA 离线缓存都已经在里面。  
> 不是 App Store 原生应用，但不需要 Mac、不需要 Apple ID。

---

## 方法一：网页上传 + 分支部署（最简单，不需要 Git）

1. 登录 GitHub，新建一个 **Public** 仓库，例如 `circuit-lab`。
2. 在仓库首页点 **Add file → Upload files**。
3. 把本文件夹里的**全部内容**拖进去：
   - `index.html`、`defs.js`、`levels.js`、`engine.js`、`ui.js`、`styles.css`
   - `manifest.webmanifest`、`sw.js`、`icons/`
   - `.nojekyll`
   - `.github/`（可选；用方法二时需要）
4. Commit changes。
5. 仓库 **Settings → Pages**：
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` + `/ (root)`
   - Save
6. 等待 1～2 分钟，打开：

   ```
   https://<你的用户名>.github.io/circuit-lab/
   ```

7. iPhone Safari 打开后：**分享 → 添加到主屏幕**。

> 如果仓库名不是 `circuit-lab`，URL 里的路径换成你的仓库名。

---

## 方法二：GitHub Actions 自动部署（推荐长期使用）

仓库里已经包含 `.github/workflows/pages.yml`。

1. 按方法一把文件上传到仓库；
2. **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；
3. 以后每次 push 到 `main`，或手动运行 **Deploy Circuit Lab PWA**，都会自动部署；
4. Actions 完成后的 `page_url` 就是网页地址。

这种方式不需要修改任何路径，也不需要构建命令。

---

## iPhone 上安装

1. Safari 打开 GitHub Pages 地址；
2. 点击底部分享按钮；
3. **添加到主屏幕**；
4. 从主屏幕图标启动，全屏运行。

首次通过 HTTPS 打开后，Service Worker 会缓存游戏资源；之后可以离线打开。

---

## 更新游戏

如果以后修改了 `app/src/main/assets/` 里的游戏代码：

1. 重新同步到 `web/`（或在本地重新生成网页包）；
2. 把新的 `web/` 内容覆盖到 GitHub 仓库根目录；
3. 修改 `sw.js` 里的 `CACHE` 版本（例如 `circuitlab-pwa-1.5`），让旧缓存失效；
4. commit。

---

## 常见问题

**页面 404**
- 确认仓库 Settings → Pages 已经启用；
- 分支选的是 `main` / root；
- 文件在仓库根目录，而不是多套了一层文件夹。

**一直显示旧版本**
- 修改 `sw.js` 的 `CACHE` 版本；
- Safari 设置里清除网站数据，或从主屏幕删除后重新添加。

**添加到主屏幕后不是全屏**
- 确认使用的是 HTTPS 地址；
- iOS 的 PWA 支持因版本而异，但 19 关和存档都能正常使用。

**需要完全原生 App**
- 回到包含 `ios/` 的完整项目，按 `ios/README.md` 的“没有 Mac 也行”操作；
- 或者使用完整项目里的 GitHub Actions iOS 工作流 + Sideloadly。
