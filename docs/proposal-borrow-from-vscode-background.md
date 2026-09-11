# 借鉴 shalldie/vscode-background 的特性方案

> 分析对象：`shalldie/vscode-background`（v3.1.0，2026-09 发布，源码已 clone 到 `/tmp/vscode-background-ref` 逐文件核对）
> 分析目标：找出其中**底层机制**与**体验细节**层面、且适用于本项目（vscode-background-cover）的特性，给出可落地的方案。
> 结论：本项目功能面已远超参考项目（视频、粒子、宠物、多窗口、在线图库、缓存管理等均为参考项目没有的），
> 参考项目真正值得借鉴的是**打补丁的健壮性机制**和**少量渲染层体验细节**，共 8 项，分 P0/P1/P2 三档。

---

## 一、总体对比（哪些已有 / 哪些值得借鉴）

| 能力 | 参考项目 | 本项目 | 结论 |
| --- | --- | --- | --- |
| 修改内核文件注入背景 | ✅ workbench.html 内联 script | ✅ workbench js 注入 bootstrap + 外置动态脚本（更现代，绕开 Trusted Types） | 已有，保留 |
| 热更新（不重启生效） | ✅ | ✅ | 已有 |
| 多窗口独立背景 | ❌ | ✅ 3.6.x | 本项目领先 |
| 分区背景（editor/sidebar/panel/auxiliarybar/fullscreen） | ✅ 五种分区，配置驱动 | ❌ 仅全屏一种 | **值得借鉴（B1）** |
| 图片预加载、切换过渡动画 | ✅ 预加载 + transition | ❌ 直接换图，会闪 | **值得借鉴（A5/A6）** |
| 校验和"安装损坏"提示自动屏蔽 | ✅ CSS `:has()` 屏蔽，16 语言 | ❌ README 让用户手动点"不再提示" | **值得借鉴（A2）** |
| 补丁状态检测（文件内容标记 → None/Legacy/Latest） | ✅ 状态机 | ⚠️ 用 globalState 记 VS Code 版本号做代理判断 | **值得借鉴（A1）** |
| 路径 `~`/环境变量展开 + 文件夹自动扫描 | ✅ | ⚠️ 仅 randomImageFolder 支持目录 | **值得借鉴（A3）** |
| 主题感知混合模式 | ✅ 纯 CSS 变量 + `:has()`，无 JS | ⚠️ 监听主题变化 → 弹窗确认 → 重打补丁重载 | **值得借鉴（A4）** |
| 每张图独立样式 / 自定义 CSS | ✅ `style` + `styles[]`，且排除 pointer-events/z-index | ❌ 只有固定旋钮（透明度/模糊/尺寸/混合） | **值得借鉴（B2）** |
| 补丁预览 / 调试命令 | ✅ Preview Patch | ❌ | **值得借鉴（B3）** |
| 状态栏快捷入口 | ✅ | ✅ | 已有 |
| 欢迎页 / 更新说明 | ✅ | ✅ 更新提示 | 已有 |
| l10n 框架（package.nls.json + l10n 目录） | ✅ | ⚠️ 硬编码中英双语 | 低优先（B5） |

---

## 二、P0 —— 底层健壮性（低成本、收益直接，建议下个版本就做）

### A1. 补丁状态机：按文件内容标记检测，替代"记版本号"的代理判断

**参考实现**（`src/background/PatchFile/PatchFile.base.ts`、`Background.ts`）：
- 每次启动读取实际内核文件，按标记判断三态：
  - `Latest`：包含 `background.ver.<当前版本>` → 已按当前版本打过补丁；
  - `Legacy`：包含 `background.ver` 但版本旧 → 打过旧版补丁；
  - `None`：无标记 → 文件是原始状态（VS Code 更新 / 用户手动还原后）。
- 状态为 `Legacy`/`None` 且扩展启用时，弹"Apply and Reload"，`beforeReload` 先打补丁、失败则不重载（v3.0.1 修复过这点）。

**本项目现状**（`src/extension.ts` `checkVSCodeVersionChanged`）：
- 用 `globalState['vscode_version']` 与当前 VS Code 版本比对来猜测"补丁可能丢了"；
- 用 `!fs.existsSync(CUSTOM_JS_FILE_PATH)` 判断"核心文件未初始化"。
- 两个都是**代理指标**：同一版本重装 VS Code、或 `workbench.desktop.main.js` 被还原但 `js-background-cover.js` 还在时，都会漏检/误检。

**方案**：在 `FileDom` 增加
```ts
type PatchState = 'latest' | 'legacy' | 'none';
async function detectPatchState(): Promise<PatchState>
```
读 `workbench.desktop.main.js`（含 additionalBundles），按
`/*ext-backgroundCover-start*/` + `/*ext.backgroundCover.bootstrap.<BOOTSTRAP_VERSION>*/` 标记判定：
- 无 `ext-backgroundCover-start` → `none`；
- 有标记但 bootstrap 版本号不等于当前 → `legacy`；
- 完全一致 → `latest`。
启动时只对 `none`/`legacy` 弹"重新应用"提示（保留现有 `vscode_version` 提示作为兜底）。旧版 bootstrap 自动升级到当前版本，不再依赖"VS Code 恰好升了版本"。

**成本/风险**：改动集中在 `extension.ts` + `FileDom` 各一个函数；只读不写，风险低。

---

### A2. 自动屏蔽"安装似乎损坏"校验和提示（CSS `:has()`，16 语言全覆盖）

**参考实现**（`src/background/PatchGenerator/PatchGenerator.checksums.ts`）：
- 不修改校验和文件，只往注入的 CSS 里追加（16 种语言文案全覆盖，含 qps-ploc）：
```css
.notification-toast-container:has([aria-label*='安装似乎损坏']) { display: none; }
```
- 选择器直接命中"安装损坏"通知 toast，用户完全无感。

**本项目现状**：README 里写"初次安装/更新：如遇『安装损坏』提示，请点击【不再提示】"——把第一个使用摩擦留给了用户，且不少用户会误以为扩展搞坏了 VS Code。

**方案**：在 `FileDom.getCss()` 的输出末尾追加同样的规则块（本项目 CSS 经 loader 注入 `<style id="background-cover-style">`，`:has()` 在渲染进程同样生效）。文案表照抄参考项目 16 条翻译，放进 `src/checksumToast.ts` 常量文件。顺带把 README 第 2 条注意事项改成"已自动屏蔽"。

**成本/风险**：纯追加 CSS，零风险；注意 `:has()` 需要 VS Code ≥ 1.62 左右的 Chromium（本项目引擎声明 `^1.38.0`，实际现代版本都支持；可加 `@supports selector(:has(...))` 兜底）。

---

### A3. 本地路径能力对齐：`~`/`${ENV}`/`$ENV` 展开 + 文件夹自动扫描

**参考实现**（`src/background/PatchGenerator/PatchGenerator.base.ts`）：
- `expandPathVariables()`：展开 `~/`、`${ENV}`、`$ENV`；
- 无扩展名的路径按**文件夹**处理，`fast-glob` 递归扫描 `svg,png,jpg,jpeg,gif,bmp,webp,mp4,otf,ttf`（大小写不敏感），再逐张归一化为 `vscode-file://vscode-app` 协议 URL（v1.51.1 后 file:// 在 sandbox 下不可用的兼容处理）；
- `data:image/*;base64,...` 直接透传。

**本项目现状**（`FileDom.initializeImage`）：`imagePath` 支持 http/data/单文件，`localImgToVsc()` 已用 `vscode-file://vscode-app` 协议（✅ 已覆盖参考项目的关键兼容点）；但**不展开 `~`/环境变量**，`imagePath` 直接填文件夹也不支持（目录只能走 `randomImageFolder`）。

**方案**：抽一个 `src/pathUtil.ts`：
```ts
export function expandPathVariables(p: string): string;   // ~/ ${ENV} $ENV
export function isFolderPath(p: string): boolean;         // 无扩展名视为目录
export async function resolveImagesFromInput(input: string): Promise<string[]>; // 文件→自身，目录→递归扫描
```
在 `initializeImage()` 入口先展开再判断。让用户可以直接把 `~/Pictures/wallpapers`、`${HOME}/pics` 填进背景源；`PickList` 的目录随机分支复用同一工具函数，避免两套路径逻辑漂移。

**成本/风险**：新增一个工具模块 + 改动 `initializeImage` 入口；纯路径处理，风险低。

---

## 三、P1 —— 渲染层体验（中低成本，对观感提升明显）

### A4. 主题感知混合模式改为纯 CSS 变量（干掉弹窗 + 重打补丁）

**参考实现**（`src/background/PatchGenerator/PatchGenerator.theme.ts`）：
```css
body { --background-css-mix-blend-mode: unset; }                    /* 浅色：不混合 */
body:has(> .monaco-workbench.vs-dark) { --background-css-mix-blend-mode: screen; } /* 深色：screen */
```
背景层写 `mix-blend-mode: var(--background-css-mix-blend-mode)`。主题切换**由 CSS 即时生效，零 JS、零重打补丁**。

**本项目现状**（`PickList.autoUpdateBlendModel` + `extension.ts` 监听 `onDidChangeActiveColorTheme`）：
- 切主题 → 弹窗"主题模式发生变更，是否更新背景混合模式？"→ 用户点 YES → 重打 CSS + `reloadWindow`。
- 每次切主题都会打断一次用户，还要重启窗口，体验很重。

**方案**：当 `blendModel === 'auto'`（当前默认）时，CSS 输出改为：
```css
body { --background-cover-blend: unset; }
body:has(> .monaco-workbench.vs-dark) { --background-cover-blend: screen; }
body::before { ... mix-blend-mode: var(--background-cover-blend); ... }
```
视频分支（`applyVideo`）同样改用 `var(--background-cover-blend)`。`auto` 模式下不再走 JS 弹窗/重载路径；显式 `multiply`/`lighten` 保持原逻辑。最后删掉 `autoUpdateBlendModel` 的弹窗分支（`BlendHelper` 保留给非 auto 场景）。

**成本/风险**：CSS 生成逻辑小改 + 删除一个弹窗路径；`BlendHelper.autoBlendModel()` 的判定（可能含主题名判断）需要与 CSS 变量选择器语义对齐（深色=screen）。建议保留 JS 判定仅用于**校验一致性**。

---

### A5. 轮播/换图前的图片预加载（消除首帧闪烁）

**参考实现**（`PatchGenerator.base.ts` `getPreload()`）：≤10 张图时在隐藏容器里 `background-image: url(...),url(...)` 预解码，切图时直接命中缓存。

**本项目现状**：自动轮播（`autoInterval`）在 loader 里直接换 CSS `background-image`，新图首帧可能白一下/闪一下；`body::before` 无 `transition`（见 A6），闪烁更明显。

**方案**：在动态脚本的换图流程里加预加载：
```js
function preloadImage(url) {
    if (typeof Image === 'undefined') return Promise.resolve();
    return new Promise(res => {
        const img = new Image();
        img.onload = img.onerror = res;
        img.src = url;
    });
}
// 轮播下一次换图前 await preloadImage(nextUrl)，再写 CSS
```
放在 loader 的轮播调度器（`PickList` 定时换图对应的注入逻辑）中；预加载只对「即将要换的那张」做，不预加载整池，避免流量浪费。视频背景换源同理可预创建 `video` 元素。

**成本/风险**：纯注入脚本逻辑，不动补丁机制；注意 fetch 的 CSS 引用的是本地缓存路径（desktop）/相对路径（web），`Image.src` 直接用同一 URL 即可。

---

### A6. 背景切换过渡动画（opacity/filter transition）

**参考实现**：编辑器背景 `transition: 0.3s`，全屏背景 `transition: 1s`，切图有淡入淡出。

**本项目现状**（`FileDom.getCss()`）：`body::before` 无 transition，换图瞬间替换，生硬。

**方案**：`body::before` 增加：
```css
transition: opacity .5s ease, filter .5s ease;
```
并在 Studio「装饰/高级」加一个开关（默认开），关掉则输出无 transition 的 CSS。视频分支在 `applyVideo` 里给 `video` 元素加同样的 transition。此改动还能顺带让"透明度/模糊度滑杆"的调整从突变变为渐变，体感提升明显。

**成本/风险**：一行 CSS + 一个开关；低风险。

---

## 四、P2 —— 功能扩展（可选 / 分阶段）

### B1. 分区背景（editor / sidebar / panel / auxiliarybar / fullscreen）

**参考实现**：五种分区各自独立配置，关键选择器已打磨成熟：
- `body::after`（fullscreen）；
- `.split-view-view > .part.sidebar::after` / `.part.panel::after` / `.part.auxiliarybar::after`；
- editor 用 `.part.editor .split-view-view .editor-instance > .monaco-editor ... ::after`（同时覆盖浮动编辑器窗口），`useFront` 决定 `::after` 还是 `::before`（图在代码之上/之下），配 `pointer-events:none` + `z-index` 保证不挡点击。

**本项目现状**：仅全屏一种（`body::before` 铺满）。

**方案**（建议作为 3.7 的功能项）：新增设置 `backgroundCover.section`：`fullscreen`（默认）| `sidebar` | `panel` | `editor`，Studio「高级」下拉选择。实现上只需在 `getCss()` 里把 `body::before` 换成对应选择器（`FileDom` 已有按 window 独立写 CSS 文件的机制，选择器替换即可复用）；sidebar/panel 建议默认 `position: fixed` + `inset` 控制到该分区。editor 分区可作为进阶子项：`useFront`（图在代码上方，类似水印）做成开关。

**成本/风险**：这是唯一较大的新功能；选择器直接抄参考项目已验证的方案，风险可控。注意 sidebar/panel 在部分主题下有独立背景色，需要把 `background` 置 `none` 的选择器一起带上（参考项目编辑器选择器里有这条）。

---

### B2. 每张图片独立样式 / 自定义 CSS（带安全排除）

**参考实现**：`style`（共用自定义样式）+ `styles[]`（逐图），合并进每条图片规则；**始终排除 `pointer-events` 和 `z-index`**，防止用户样式破坏点击穿透与层级。

**本项目现状**：无自定义 CSS 入口，只有固定旋钮。

**方案**：Studio「外观」加一个"自定义 CSS"文本域（存 `globalState` 或 settings 的 `backgroundCover.customCss`），在 `getCss()` 里把用户样式**追加重叠**到 `body::before` 规则后（用户可覆盖 position/size/filter 等）；序列化时过滤 `pointer-events`、`z-index`。轮播多图场景可按索引提供数组版（P2 的 P2）。

**成本/风险**：低；过滤字段保证安全。

---

### B3. 调试命令：预览当前注入补丁（Preview Patch）

**参考实现**：`Background.previewPatch()` 把生成的脚本写进临时 `.md` 并 `markdown.showPreviewToSide`。

**方案**：新增命令 `backgroundCover.debugPatch`：
- 输出当前生成的 bootstrap JS + 动态 JS（含粒子/宠物配置摘要）+ CSS 到临时 md；
- 附带诊断信息：目标文件路径、检测到的 `PatchState`、版本号、perWindow 开关、缓存目录文件数。
- 目的：用户报 issue 时（本项目权限/路径类 issue 很多）能一键给出关键信息，大幅降低排查成本。

**成本/风险**：低；纯只读 + 临时文件。

---

### B5.（低优先）l10n 框架

参考项目用 `package.nls.json` + `l10n.t()`；本项目硬编码"中文 / English"。短期不值得全面改造；若要加日语等多语言或上架本地化，可先只把 `package.json` 的 contributes 文案迁移到 `package.nls.json`。

---

## 五、不建议引入的项（附原因）

| 参考项目特性 | 不建议原因 |
| --- | --- |
| 往 workbench.html 内联 `<script>` + 改 CSP `unsafe-inline` | 本项目 3.5.3 已改为「稳定 bootstrap + 外置动态脚本 + dynamic import()」，绕开 Trusted Types，是更现代的方案；参考项目 v3.1.0 还在修 CSP 注入 bug（#631），没必要倒退。 |
| 配置对象化（`background.editor`/`background.fullscreen` 等整段 JSON 配置） | 本项目已有可视化 Studio 面板，JSON 对象配置对多数用户是倒退；仅 B1 需要时可仿照。 |
| 逐分区独立 interval/random 轮播 | 本项目轮播/随机已在全局实现，分区化后如需再做。 |
| `data URL` 透传 | 本项目已有 `imageToBase64()` 内联方案（code-server 场景）。 |

---

## 六、路线图建议

- **3.7.0（P0）**：A1 补丁状态机 + A2 校验和提示屏蔽 + A3 路径变量/文件夹。
- **3.7.1 / 3.8.0（P1）**：A4 混合模式 CSS 变量化 + A5 预加载 + A6 过渡动画。
- **3.9.0（P2）**：B1 分区背景（先 sidebar/panel）+ B2 自定义 CSS + B3 调试命令。

每项都保持向后兼容：旧补丁在下次应用时由 A1 的 `legacy` 分支自动升级，不要求用户手动还原。
