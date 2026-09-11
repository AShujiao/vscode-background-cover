/**
 * 背景 CSS 片段生成（借鉴 shalldie/vscode-background 的 ChecksumsPatchGenerator /
 * ThemePatchGenerator）：
 * - getCorruptionWarningCss：用 CSS `:has()` 屏蔽 VS Code 的"安装损坏"校验和提示
 *   （16 种语言全覆盖，用户完全无感）；
 * - resolveBlendModeDeclaration / resolveThemeBlendRules：auto 混合模式改为 CSS 变量 +
 *   `:has()` 主题感知，主题切换由 CSS 即时生效，不再需要扩展侧监听/重打补丁；
 * - getTransitionCss：背景切换的淡入淡出过渡（尊重系统的"减少动态效果"设置）。
 *
 * 纯逻辑模块，不依赖 vscode API，方便单元测试。
 */

// ---- 校验和"安装损坏"提示 -----------------------------------------------------
// 文案来自 VS Code integrityService 的多语言翻译，与参考项目 shalldie/vscode-background
// 的 ChecksumsPatchGenerator 保持一致。除完整句外，保留两条短匹配兜底
// （aria-label 子串匹配，长句能覆盖短句，多保留两条无害）。
export const CORRUPTION_TRANSLATIONS: string[] = [
    // en, default
    'installation appears to be corrupt. Please reinstall.',
    // cs
    'je pravděpodobně poškozená. Proveďte prosím přeinstalaci.',
    // de
    'Installation ist offenbar beschädigt. Führen Sie eine Neuinstallation durch.',
    // es
    'parece estar dañada. Vuelva a instalar.',
    // fr
    'semble être endommagée. Effectuez une réinstallation.',
    // it
    'sembra danneggiata. Reinstallare.',
    // ja
    'インストールが壊れている可能性があります。再インストールしてください。',
    // ko
    '설치가 손상된 것 같습니다. 다시 설치하세요.',
    // pl
    'prawdopodobnie jest uszkodzona. Spróbuj zainstalować ponownie.',
    // pt-BR
    'parece estar corrompida. Reinstale-o.',
    // qps-ploc
    'ïñstællætïøñ æppëærs tø þë çørrµpt. Plëæsë rëïñstæll.',
    // ru
    'повреждена. Повторите установку.',
    // tr
    'yüklemeniz bozuk gibi görünüyor. Lütfen yeniden yükleyin.',
    // zh-hans
    '安装似乎损坏。请重新安装。',
    // zh-hant
    '安裝似乎已損毀。請重新安裝。',
    // 短匹配兜底（兼容只包含片段的通知文本）
    'installation appears to be corrupt',
    '安装似乎损坏'
];

/**
 * 生成屏蔽"安装损坏"通知的 CSS。选择器中的单引号会转义，避免破坏属性选择器。
 */
export function getCorruptionWarningCss(): string {
    return CORRUPTION_TRANSLATIONS.map((trans) => {
        const escaped = trans.replace(/'/g, "\\'");
        return `
        .notification-toast-container:has([aria-label*='${escaped}']) {
            display: none;
        }
        `;
    }).join('');
}

// ---- 混合模式 ----------------------------------------------------------------
/**
 * 主题感知混合模式的 CSS 变量名。auto 模式下背景层使用该变量，
 * 深浅主题的取值由下面的 :has() 规则即时切换。
 */
export const BLEND_CSS_VAR = '--background-cover-blend';

/**
 * 解析混合模式的声明片段：
 * - auto（或空）：`mix-blend-mode: var(--background-cover-blend);`
 * - multiply / lighten：直接写死。
 */
export function resolveBlendModeDeclaration(mode: string): string {
    const normalized = (mode || '').toLowerCase();
    if (normalized === 'multiply' || normalized === 'lighten') {
        return `mix-blend-mode: ${normalized};`;
    }
    return `mix-blend-mode: var(${BLEND_CSS_VAR});`;
}

/** auto 模式下背景层应使用的 mix-blend-mode 值（注入视频 config 用）。 */
export function resolveBlendModeValue(mode: string): string {
    const normalized = (mode || '').toLowerCase();
    if (normalized === 'multiply' || normalized === 'lighten') {
        return normalized;
    }
    return `var(${BLEND_CSS_VAR})`;
}

/**
 * auto 模式的主题感知规则。语义与旧 BlendHelper.autoBlendModel() 完全一致：
 * 浅色 → multiply；深色（vs-dark）→ lighten；高对比黑（hc-black）→ lighten；
 * 高对比白（hc-light）→ multiply（走默认值）。
 * 非 auto 模式返回空串。
 */
export function resolveThemeBlendRules(mode: string): string {
    const normalized = (mode || '').toLowerCase();
    if (normalized !== 'auto' && normalized !== '') {
        return '';
    }
    return `
        body { ${BLEND_CSS_VAR}: multiply; }
        body:has(> .monaco-workbench.vs-dark) { ${BLEND_CSS_VAR}: lighten; }
        body:has(> .monaco-workbench.hc-black) { ${BLEND_CSS_VAR}: lighten; }
    `;
}

// ---- 过渡动画 ----------------------------------------------------------------
/**
 * 背景层过渡动画声明（放在 body::before 规则内部）。开关关闭时不输出。
 */
export function getTransitionDeclaration(enabled: boolean): string {
    return enabled ? 'transition: opacity .25s ease, filter .25s ease;' : '';
}

/**
 * 过渡动画的"减少动态效果"兜底规则（顶层 @media，与粒子特效降帧语义一致）。
 */
export function getTransitionReducedMotionCss(enabled: boolean): string {
    if (!enabled) {
        return '';
    }
    return `
        @media (prefers-reduced-motion: reduce) {
            body::before { transition: none; }
        }
    `;
}
