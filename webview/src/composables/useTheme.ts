import { ref, onUnmounted } from 'vue';

export type ThemeKind = 'light' | 'dark' | 'hc';

function detect(): ThemeKind {
    const cls = document.body.classList;
    if (cls.contains('vscode-light')) { return 'light'; }
    if (cls.contains('vscode-high-contrast') && !cls.contains('vscode-high-contrast-light')) { return 'hc'; }
    if (cls.contains('vscode-high-contrast-light')) { return 'light'; }
    return 'dark';
}

function applyHtmlClass(kind: ThemeKind) {
    const html = document.documentElement;
    if (kind === 'light') {
        html.classList.remove('dark');
    } else {
        html.classList.add('dark');
    }
}

export function useTheme() {
    const theme = ref<ThemeKind>(detect());
    applyHtmlClass(theme.value);
    const sync = () => {
        theme.value = detect();
        applyHtmlClass(theme.value);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    onUnmounted(() => observer.disconnect());
    return theme;
}
