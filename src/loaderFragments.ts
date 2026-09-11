/**
 * 注入到工作台页面的动态脚本片段（借鉴 shalldie/vscode-background 的图片预加载）：
 * 换图前先用 Image 元素预加载目标图片，避免轮播/切图时首帧闪烁。
 *
 * 两个正则副本：
 * - BACKGROUND_IMAGE_URL_REGEX           ：TS 侧测试用，支持单/双引号；
 * - BACKGROUND_IMAGE_URL_REGEX_EMBEDDED  ：注入 loader 用。loader 源码里 RegExp 字符串
 *   会先被「loader 源码的字符串字面量」解析一次（`\\s` → `\s`），因此每个反斜杠都要翻倍；
 *   且只匹配单引号（本项目生成的 CSS 固定 `url('...')`），避免把 `"` 嵌进字符串字面量。
 */

/** TS 侧正则（测试用）：匹配 `background-image: url('...')` / `url("...")` 的地址。 */
export const BACKGROUND_IMAGE_URL_REGEX = 'background-image:\\s*url\\(\\s*[\'"]?([^\'")]+)[\'"]?\\s*\\)';

/**
 * 注入端专用副本（String.raw 让双反斜杠可读）：值即 loader 源码里字符串字面量的
 * 内容，浏览器解析后得到 `background-image:\s*url\(\s*'?([^')]+)'?\s*\)`。
 */
export const BACKGROUND_IMAGE_URL_REGEX_EMBEDDED = String.raw`background-image:\\s*url\\(\\s*'?([^')]+)'?\\s*\\)`;

/** TS 侧实现，供单元测试验证正则正确性。 */
export function extractBackgroundImageUrl(css: string): string {
    if (!css) {
        return '';
    }
    const match = new RegExp(BACKGROUND_IMAGE_URL_REGEX, 'i').exec(css);
    return match && match[1] ? match[1] : '';
}

/**
 * 注入到 loader 的预加载函数（只用单引号/字符串拼接，避免与外部模板字面量冲突）。
 * 阻塞换图的最长时间 2000ms：正常图片（本地缓存/较快网络）几乎瞬间完成，
 * 损坏或不可达的图片也不会让背景永远不更新。
 */
export const PRELOAD_IMAGE_JS = `
function preloadBackgroundImage(css) {
    try {
        if (typeof Image === 'undefined') { return Promise.resolve(); }
        var m = new RegExp("${BACKGROUND_IMAGE_URL_REGEX_EMBEDDED}", "i").exec(css);
        if (!m || !m[1]) { return Promise.resolve(); }
        var url = m[1];
        if (url.indexOf('data:') === 0) { return Promise.resolve(); }
        return new Promise(function (resolve) {
            var done = false;
            var timer = null;
            var finish = function () {
                if (done) { return; }
                done = true;
                if (timer) { clearTimeout(timer); }
                resolve();
            };
            timer = setTimeout(finish, 2000);
            var img = new Image();
            img.onload = finish;
            img.onerror = finish;
            img.src = url;
        });
    } catch (e) {
        return Promise.resolve();
    }
}
`;

/**
 * A6 修复片段：`background-image` 是 CSS 不可过渡的属性（discrete，不能插值），
 * 换图本身是瞬间切换。此前用临时 div 层 + opacity 动画做交叉淡化，但
 * mix-blend-mode / filter 在 opacity 动画期间被合成器提升后混合会退化，
 * 导致新图瞬间以原色（normal）显示——表现为"切过来的一瞬间亮度特别高"。
 *
 * 现在改为**图片级交叉淡化**：不动 div、不动 opacity，全程 body::before 保持
 * 完整规则（blend / blur / opacity 恒定），只逐帧把 background-image 换成
 * `cross-fade(url(旧图) p%, url(新图) q%)`，由浏览器在图片层做混合——
 * 亮度、混合模式与最终状态完全一致，无任何瞬时异常。
 *   1. 换图时记录旧图 URL，用 cross-fade 从「旧图 100%」逐帧过渡到「新图 100%」；
 *   2. 完成帧后写入新 CSS（与最后一帧内容相同，无感知切换）；
 *   3. prefers-reduced-motion / 首次应用 / 无旧图 / 视频 → 直接切换。
 * 状态（lastUrl / fade timer）挂在 targetWindow 上按窗口隔离。
 */
export const IMAGE_FADE_JS = `
var BGC_FADE_FRAME_MS = 16;
var BGC_FADE_FRAMES = 12;
function bgcExtractImageUrl(css) {
    try {
        var m = new RegExp("${BACKGROUND_IMAGE_URL_REGEX_EMBEDDED}", "i").exec(css);
        return m && m[1] ? m[1] : '';
    } catch (e) {
        return '';
    }
}
function bgcShouldReduceMotion() {
    try {
        return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
        return false;
    }
}
function bgcExtractBeforeRule(css) {
    try {
        var m = /body::before\\s*\\{([\\s\\S]*?)\\}/.exec(css);
        return m ? m[1] : '';
    } catch (e) { return ''; }
}
function bgcGetFadeLayer(doc) {
    try {
        var layer = doc.getElementById('background-cover-fade-layer');
        if (!layer) {
            layer = doc.createElement('div');
            layer.id = 'background-cover-fade-layer';
            layer.style.pointerEvents = 'none';
            doc.body.appendChild(layer);
        }
        return layer;
    } catch (e) { return null; }
}
function bgcRemoveFadeLayer(doc) {
    try {
        var layer = doc && doc.getElementById('background-cover-fade-layer');
        if (layer && layer.parentNode) { layer.parentNode.removeChild(layer); }
    } catch (e) {}
}
function bgcApplyStyleWithFade(targetWindow, style, css) {
    try {
        if (targetWindow.__bgcPendingCss === css) { return; }
        if (targetWindow.__bgcFadeTimer) {
            clearTimeout(targetWindow.__bgcFadeTimer);
            targetWindow.__bgcFadeTimer = null;
        }
        if (targetWindow.__bgcPendingCss) {
            style.textContent = targetWindow.__bgcPendingCss;
            targetWindow.__bgcLastImageUrl = bgcExtractImageUrl(style.textContent);
            targetWindow.__bgcPendingCss = null;
        }
        bgcRemoveFadeLayer(targetWindow.document);
        if (style.textContent === css) { return; }
        var url = bgcExtractImageUrl(css);
        var lastUrl = targetWindow.__bgcLastImageUrl || '';
        var imageChanged = !!url && url !== lastUrl;
        // 首次应用/未换图/减少动态效果/视频无背景图 → 直接应用
        if (!imageChanged || bgcShouldReduceMotion() || !lastUrl || !url) {
            style.textContent = css;
            if (url) { targetWindow.__bgcLastImageUrl = url; }
            return;
        }
        var beforeRule = bgcExtractBeforeRule(css);
        var oldCss = style.textContent;
        var doc = targetWindow.document;
        var layer = beforeRule && doc ? bgcGetFadeLayer(doc) : null;
        if (!layer) {
            style.textContent = css + '\\nbody::before{opacity:0!important;transition:opacity .18s ease!important;}';
            targetWindow.__bgcPendingCss = css;
            targetWindow.__bgcFadeTimer = setTimeout(function () {
                targetWindow.__bgcFadeTimer = null;
                style.textContent = css;
                targetWindow.__bgcPendingCss = null;
                targetWindow.__bgcLastImageUrl = url;
            }, 200);
            return;
        }
        var opacityMatch = /(?:^|;)\\s*opacity\\s*:\\s*([^;]+)/i.exec(beforeRule);
        var targetOpacity = opacityMatch && opacityMatch[1] ? opacityMatch[1].trim() : '1';
        // 严格做等透明度交叉淡化：旧层 opacity = target*(1-p)，新层 opacity = target*p。
        // 两层的总覆盖强度不会超过用户配置的 targetOpacity，避免切入第一瞬间过亮。
        layer.setAttribute('style', beforeRule);
        layer.style.transition = 'none';
        layer.style.opacity = '0';
        if (doc.body) { void doc.body.offsetHeight; }
        var frame = 0;
        var frames = 10;
        var targetOpacityNumber = parseFloat(targetOpacity);
        if (!isFinite(targetOpacityNumber)) { targetOpacityNumber = 1; }
        targetWindow.__bgcPendingCss = css;
        var step = function () {
            frame++;
            var p = Math.min(frame / frames, 1);
            var oldOpacity = (targetOpacityNumber * (1 - p)).toFixed(4);
            var newOpacity = (targetOpacityNumber * p).toFixed(4);
            // 主层仅覆盖 opacity，旧图保持到交叉淡化结束；关闭 transition 避免额外闪烁。
            style.textContent = oldCss + '\\nbody::before{opacity:' + oldOpacity + '!important;transition:none!important;}';
            layer.style.opacity = newOpacity;
            if (p >= 1) {
                // 在 transition:none 生效时计算最终透明度，再恢复 transition。
                // 仅同步写两次 textContent 不够：浏览器会合并样式更新并再次触发淡入。
                style.textContent = css + '\\nbody::before{opacity:' + targetOpacityNumber.toFixed(4) + '!important;transition:none!important;}';
                targetWindow.__bgcLastImageUrl = url;
                targetWindow.__bgcPendingCss = null;
                targetWindow.__bgcFadeTimer = null;
                if (doc.body) {
                    if (typeof targetWindow.getComputedStyle === 'function') {
                        void targetWindow.getComputedStyle(doc.body, '::before').opacity;
                    } else {
                        void doc.body.offsetHeight;
                    }
                }
                bgcRemoveFadeLayer(doc);
                style.textContent = css;
                return;
            }
            targetWindow.__bgcFadeTimer = setTimeout(step, 16);
        };
        step();
    } catch (e) {
        // 兜底：任何异常都直接应用，保证背景至少出现
        try { style.textContent = css; } catch (e2) {
            console.error('[BackgroundCover] applyStyle fallback error:', e2);
        }
    }
}
`;
