<template>
    <div class="studio" :data-theme="theme">
        <header class="studio-header">
            <div class="brand">
                <span class="brand-icon">
                    <img v-if="brand.logo" :src="brand.logo" :alt="brand.name || 'logo'" />
                    <el-icon v-else><Picture /></el-icon>
                </span>
                <span class="brand-title">{{ brand.name || t('appTitle') }}</span>
            </div>
            <div class="header-actions">
                <el-dropdown trigger="click" @command="onLangChange">
                    <el-button text size="small" :title="t('language')">
                        <el-icon><Place /></el-icon>
                        <span class="lang-label">{{ locale === 'zh' ? '中' : 'EN' }}</span>
                    </el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item command="en" :disabled="locale === 'en'">
                                {{ t('langEnglish') }}
                            </el-dropdown-item>
                            <el-dropdown-item command="zh" :disabled="locale === 'zh'">
                                {{ t('langChinese') }}
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <el-button text circle size="small" :title="t('refresh')" @click="onRefresh">
                    <el-icon><Refresh /></el-icon>
                </el-button>
            </div>
        </header>

        <el-tabs
            v-model="active"
            class="studio-tabs"
            stretch
        >
            <el-tab-pane
                v-for="tab in tabs"
                :key="tab.key"
                :name="tab.key"
            >
                <template #label>
                    <span class="tab-label">
                        <el-icon><component :is="tab.icon" /></el-icon>
                        <span>{{ tab.label }}</span>
                    </span>
                </template>
            </el-tab-pane>
        </el-tabs>

        <main class="studio-body">
            <KeepAlive>
                <component :is="currentView" />
            </KeepAlive>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Picture, Refresh, House, Folder, Promotion, Setting, MagicStick, Place } from '@element-plus/icons-vue';
import HomeTab from './views/HomeTab.vue';
import LocalGalleryTab from './views/LocalGalleryTab.vue';
import OnlineGalleryTab from './views/OnlineGalleryTab.vue';
import AdvancedTab from './views/AdvancedTab.vue';
import DecorationTab from './views/DecorationTab.vue';
import { useTheme } from './composables/useTheme';
import { useBridge } from './composables/useBridge';
import { useI18n, setLocale, type Locale } from './composables/useI18n';
import { applyState, brand } from './composables/useStore';

const { t, locale } = useI18n();
const bridge = useBridge();
const theme = useTheme();

const userLocaleOverride = ref<Locale | null>(
    (localStorage.getItem('bgc.locale') as Locale | null) || null
);
if (userLocaleOverride.value) { setLocale(userLocaleOverride.value); }

function onLangChange(value: Locale) {
    userLocaleOverride.value = value;
    setLocale(value);
    try { localStorage.setItem('bgc.locale', value); } catch { /* noop */ }
    bridge.post({ type: 'setGlobalState', key: 'backgroundCoverLocale', value });
}

const tabs = computed(() => [
    { key: 'home',       label: t('tabHome'),       icon: House },
    { key: 'local',      label: t('tabLocal'),      icon: Folder },
    { key: 'online',     label: t('tabOnline'),     icon: Promotion },
    { key: 'advanced',   label: t('tabAdvanced'),   icon: Setting },
    { key: 'decoration', label: t('tabDecoration'), icon: MagicStick }
]);

const views: Record<string, any> = {
    home: HomeTab,
    local: LocalGalleryTab,
    online: OnlineGalleryTab,
    advanced: AdvancedTab,
    decoration: DecorationTab
};

const active = ref('home');
const currentView = computed(() => views[active.value]);

bridge.on('state', (data: any) => {
    const payload = data?.data ?? {};
    if (payload.locale && !userLocaleOverride.value) { setLocale(payload.locale); }
    applyState(payload);
});

bridge.on('navigate', (data: any) => {
    const t = data?.tab;
    // Map legacy tab names from extension to new keys
    const map: Record<string, string> = { gallery: 'online', menu: 'home' };
    const target = map[t] ?? t;
    if (target && views[target]) { active.value = target; }
});

function onRefresh() {
    bridge.post({ type: 'ready' });
}

onMounted(() => {
    bridge.post({ type: 'ready' });
});
</script>

<style lang="scss" scoped>
.studio {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--vscode-sideBar-background);
    background-image:
        var(--studio-page-grad-1),
        var(--studio-page-grad-2);
    background-attachment: local;
    position: relative;
}

.studio::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(120% 60% at 50% -10%, rgba(108,140,255,0.12) 0%, transparent 55%);
    z-index: 0;
}

.studio > * { position: relative; z-index: 1; }

.studio-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px 6px;
    flex-shrink: 0;
}

.brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.brand-icon {
    font-size: 18px;
    color: #fff;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--studio-btn-grad);
    box-shadow: var(--studio-btn-glow);
    overflow: hidden;
    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }
}

.brand-title {
    font-size: 13px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--studio-accent), var(--studio-accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.2px;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.lang-label {
    font-size: 11px;
    margin-left: 2px;
    color: var(--vscode-foreground);
}

.studio-tabs {
    flex-shrink: 0;
    padding: 0 8px;
}

.studio-tabs :deep(.el-tabs__header) { margin: 0; }
.studio-tabs :deep(.el-tabs__nav-wrap)::after { background: transparent; }
.studio-tabs :deep(.el-tabs__item) {
    padding: 0 8px;
    height: 32px;
    line-height: 32px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    &.is-active {
        color: var(--el-color-primary);
        font-weight: 600;
    }
}
.studio-tabs :deep(.el-tabs__active-bar) {
    height: 2px;
    background: var(--el-color-primary);
}

.tab-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    .el-icon { font-size: 13px; }
}

.studio-body {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 10px 10px;
}
</style>
