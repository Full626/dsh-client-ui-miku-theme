# dsh-client-ui-miku-theme

以「初音ミク」插画为背景的 **DSH Web GUI 主题插件**（Hatsune Miku theme plugin for the DeepSeek Harness Web GUI）。

设计思路一句话：**插画是房间的光，UI 是玻璃。**

- **浅色模式**：插画保持真实色彩、清晰可见（视口固定）。只在承载文字的那一列上方
  加一层很宽的柔光提亮，于是画面边缘依旧锐利，正文却不会被图案干扰。
- **深色模式**：不铺照片（照片压在深色面上会盖住 UI），改用三点「舞台光」——
  左上是品牌青绿、右上是薄荷、下方中央是「01」徽章的洋红余晖。

配色一律通过 DSH 官方主题扩展点 `ctx.theme.overrideTokens` 覆盖整套 `--dsw-*`
语义色：青绿（#39c5bb）、薄荷、深墨绿，洋红作点缀。

> ### ⚠️ 关于插画版权
> 背景插画**作者为 @fieed**（依插画中的水印），版权归原作者所有。本仓库**未取得书面授权**，
> 收录它只是为了演示这个粉丝向的非官方主题；**一旦权利人提出要求，会立即移除**。
> 详情与移除方式见 [CREDITS.md](CREDITS.md)。
> 换成你自己的图片只需一步：替换 `assets/miku-background.jpg` 后重新构建
> （见 [自定义](#自定义)）。

## 效果

| 区域 | 变化 |
| --- | --- |
| 全局背景（浅色） | 插画以真实色彩铺满视口；正文列有一层柔光提亮，四周边缘保持锐利 |
| 全局背景（深色） | 不铺照片：青绿 / 薄荷 / 洋红三点舞台光，撑出空间感 |
| 应用框架 / 侧边栏 | 基础面半透明，让插画或光晕透出来 |
| 品牌色、按钮、链接、焦点环 | 初音青绿 |
| 文本、边框、悬停层、代码块、滚动条、提示气泡 | 统一改为青绿系 |
| 顶部 3px 光条 | 青绿 → 薄荷 → 洋红，两端淡出 |
| 文本选区 | 青绿高亮 |
| 图片查看遮罩 | 墨青底，而非默认灰黑 |

浅色（Appearance → 浅色）和深色（深色 / 跟随系统）两套底色都已适配，
每一枚被覆盖的 token 都同时提供了 light / dark 两个值，切换外观不会失效。

**可读性是有保证的，不是感觉上「还行」**：所有遮罩都是无色的，正文列上方的柔光把
插画压到约 30%，叠加半透明面板后，正文对比度仍 >12:1、次级文字 >5:1（WCAG AA 是 4.5:1）。
插画在边缘约 50% 露出，那里以留白和边框为主，不会和文字打架。

## 安装

### 方式一：一键脚本（推荐）

```powershell
# 在插件目录下执行；$env:DSH_HOME 未设置时必须显式传入
.\install.ps1 -DshHome 'D:\AgentData\dsh_data'
```

脚本会：

0. 首次改写 `cordis.patch.yml` 前，先把原始内容备份到 `cordis.patch.yml.miku-backup`；
1. 把插件包复制到 `$DSH_HOME/profiles/web/node_modules/dsh-client-ui-miku-theme`；
2. 在 `$DSH_HOME/profiles/web/cordis.patch.yml` 里插入（幂等、带注释标记的）加载行：

   ```yaml
   - insert:
       - id: ui-miku-theme
         name: dsh-client-ui-miku-theme
   ```

3. `patchReload: live` 的 profile 会**热加载**这份 patch，通常无需重启 `dsh web`。

其他参数：`-Profile <名字>`（默认 `web`）、`-DryRun`（只打印将要做的改动）、
`-Uninstall`（移除加载行与插件目录）。

### 方式二：手工安装

```powershell
$pkg = 'dsh-client-ui-miku-theme'
$dst = Join-Path $env:DSH_HOME "profiles\web\node_modules\$pkg"
New-Item -ItemType Directory -Force $dst | Out-Null
Copy-Item package.json, lib, assets, README.md $dst -Recurse -Force
```

然后在 `$DSH_HOME/profiles/web/cordis.patch.yml`（顶层 YAML 数组）里追加：

```yaml
- insert:
    - id: ui-miku-theme
      name: dsh-client-ui-miku-theme
```

刷新浏览器页面即可。

### 卸载

```powershell
.\install.ps1 -DshHome 'D:\AgentData\dsh_data' -Uninstall
```

删掉那一行 patch + 插件目录后，刷新页面即可恢复默认外观。

## 验证

安装后（或改动后）可以用三条命令确认一切正常：

```powershell
node scripts/build.mjs          # 构建产物（校验占位符与图片）
node scripts/test-client.mjs    # 29 项契约冒烟测试（含真实 cordis Context 挂载）
node scripts/check-live.mjs     # 直连运行中的 dsh web，确认插件已发布并可下载
```

`check-live.mjs` 走的是 `GET /plugins/events`（client-hmr 的 SSE 事件通道，
不需要启动令牌）。它的第一帧就是当前客户端模块图，因此能直接回答
「profile patch 的热重载是否生效」：

```
miku-theme: live graph rev 605ef847d12b with 54 browser entries
miku-theme: published — {"id":"dsh-client-ui-miku-theme","url":"/plugins/??…&rev=…","inject":[…]}
miku-theme: served bundle 200 text/javascript; charset=utf-8 385.4 KiB
```

如果输出 `NOT published`，说明热重载没有接上，重启 `dsh web` 即可。

## 自定义

- **换图**：替换 `assets/miku-background.jpg`，然后重新构建。
- **改配色**：编辑 `src/client/bundle.tmpl.js` 里的 `MIKU_TOKENS`（token → `{ light, dark }`），
  可用 token 名单见 `dsh-client-ui-theme` 的 `exportInspectTokens()`。
- **调浅色背景强弱** `src/client/theme.css`：插画露出比例 ≈ `(1 − 各层遮罩 alpha) × (1 − 浅色 bg-base 不透明度)`，
  当前**边缘约 50% / 正文区约 30%**。主旋钮是 `body` 规则里那两层遮罩的白色 alpha：
  想更清晰就调小（如 `0.30 → 0.18`），想更淡就调大。
  **遮罩务必保持无色**——带绿或带蓝会把插画糊成一整片「葱绿」，这正是踩过的坑。
- **调深色氛围**：`body[data-ds-dark-theme]` 里那三条 radial-gradient
  （青绿 / 薄荷 / 洋红）决定光晕；`bundle.tmpl.js` 里深色 `--dsw-alias-bg-base`
  的不透明度（当前 `0.58`）决定玻璃有多透，调到接近 `1` 就变回纯色底。
- **想让深色也放插画**：在 `body[data-ds-dark-theme]` 的 `background-image` 末尾补一层
  `var(--miku-artwork)`，并把深色 `bg-base` 提到 `0.85` 左右——约 8% 强度，只当纹理用。

改完执行：

```powershell
node scripts/build.mjs    # 重新生成 lib/client.js 与 lib/index.js
node scripts/test-client.mjs   # 无浏览器冒烟测试
```

## 目录结构

```
dsh-client-ui-miku-theme/
├─ package.json              # dsh.client 声明（platform: web，inject ui-theme）
├─ install.ps1               # 安装/卸载入口
├─ LICENSE                   # MIT（仅覆盖代码）
├─ CREDITS.md                # 插画致谢、版权与移除策略
├─ .gitignore
├─ assets/
│  └─ miku-background.jpg    # 原始插画（构建时内联进 bundle）
├─ src/
│  ├─ index.js               # host 半侧（空 apply，给 Loader 一个可挂载的行）
│  └─ client/
│     ├─ bundle.tmpl.js      # 浏览器半侧模板（构建时替换两个占位符）
│     └─ theme.css           # 背景层次、舞台光与点缀样式
├─ scripts/
│  ├─ build.mjs              # 把图内联成 data URI，生成 lib/
│  ├─ test-client.mjs        # 真实 cordis Context 下的冒烟测试
│  ├─ check-live.mjs         # 检查运行中的 dsh web 是否已发布本插件
│  └─ install.mjs            # 安装逻辑
└─ lib/                      # 构建产物（Loader 实际加载的东西）
   ├─ index.js
   └─ client.js
```

## 实现说明

DSH 的 Web 客户端插件以「惰性 CJS factory」形式注册到启动加载器
（`window.__ModuleLoader__.load({ id, factory })`），因此本仓库直接产出
`lib/client.js`，不依赖 DSH 源码树或 `pnpm run build`。

配色不能靠普通样式表覆盖：`ui-layout` 的主题呈现器会把
`snapshot.active.tokens` **内联**写到 `body.style` 上，样式表规则的优先级更低。
所以颜色走官方扩展点 `ctx.theme.overrideTokens(source, tokens)`（它会折进
snapshot，再被内联写回），而背景图这类 token 表达不了的部分才由插件自己的
`<style>` 承担。

插件未声明必需的 `theme` 服务为**静态注入**，而是在 `apply` 里用
`ctx.inject(['theme'], …)`：这样即使某个组合没有装载 `ui-theme`，
背景图依然生效，只是少了配色覆盖。

## 已知限制

- **插画版权归原作者 @fieed**，本仓库未获书面授权，仅作粉丝向非官方演示与个人使用；
  权利人要求即移除。替换成自己的图很容易，见 [自定义](#自定义)。
- 插件是「常开」的：没有独立的设置开关，卸载或注释掉 patch 行即可关闭。
- 背景图以 data URI 内联，`lib/client.js` 约 400 KiB；宿主会 gzip 后提供。
- 需要组合中包含 `@deepseek-ai/dsh-host-webserver`（Web 界面）与
  `@deepseek-ai/dsh-client-ui-theme`（配色覆盖）。
- `lib/client.js` 体积较大（约 387 KiB，其中 375 KiB 是内联的 base64 插画），
  用体积换「克隆即可用、无需构建」。想瘦身就换成更小的图。

## 许可

- **代码**：MIT，见 [LICENSE](LICENSE)。`Copyright (c) 2026 Full626`。
- **插画 `assets/miku-background.jpg`**：**不在 MIT 覆盖范围内**，版权归原作者
  **@fieed**，本仓库未获书面授权。见 [CREDITS.md](CREDITS.md)。
- **角色**：「初音ミク / Hatsune Miku」是 Crypton Future Media, INC. 的注册商标与角色，
  本项目与 Crypton 无任何关联。
