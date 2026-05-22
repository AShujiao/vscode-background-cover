<template>
    <div class="advanced-tab">
        <!-- Auto random -->
        <el-card class="card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><Refresh /></el-icon>
                    {{ t('autoRandom') }}
                </span>
            </template>

            <div class="row">
                <span class="row-label">{{ t('enabled') }}</span>
                <el-switch
                    :model-value="!!config.autoStatus"
                    @change="(v: any) => bridge.post({ type: 'setConfig', key: 'autoStatus', value: v })"
                />
            </div>

            <div class="row">
                <span class="row-label">{{ t('intervalSeconds') }}</span>
                <el-input-number
                    :model-value="Number(config.autoInterval ?? 10)"
                    :min="3"
                    :max="3600"
                    :step="1"
                    size="small"
                    controls-position="right"
                    class="interval-input"
                    @change="onIntervalChange"
                />
            </div>

            <div class="row">
                <span class="row-label">{{ t('sourceFolder') }}</span>
                <el-button link type="primary" class="folder-btn" :title="config.randomImageFolder" @click="onSourceFolder">
                    <span class="folder-text">{{ shortFolder || t('notSet') }}</span>
                    <el-icon><ArrowRight /></el-icon>
                </el-button>
            </div>
        </el-card>

        <!-- Size mode -->
        <el-card class="card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><FullScreen /></el-icon>
                    {{ t('sizeMode') }}
                </span>
            </template>
            <el-select
                :model-value="config.sizeModel"
                size="small"
                class="block-select"
                @change="(v: any) => bridge.post({ type: 'setConfig', key: 'sizeModel', value: v })"
            >
                <el-option v-for="opt in SIZE_MODES" :key="opt" :label="opt" :value="opt" />
            </el-select>
        </el-card>

        <!-- Blend mode -->
        <el-card class="card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><Brush /></el-icon>
                    {{ t('blendMode') }}
                </span>
            </template>
            <el-select
                :model-value="config.blendModel"
                size="small"
                class="block-select"
                @change="(v: any) => bridge.post({ type: 'setConfig', key: 'blendModel', value: v })"
            >
                <el-option v-for="opt in BLEND_MODES" :key="opt" :label="opt" :value="opt" />
            </el-select>
        </el-card>

        <!-- Misc -->
        <el-card class="card" shadow="never">
            <div class="quick-actions">
                <el-button class="block-btn" @click="onOpenCache">
                    <el-icon><FolderOpened /></el-icon>
                    {{ t('openCacheFolder') }}
                </el-button>
                <el-button class="block-btn" type="danger" plain @click="onSupport">
                    <el-icon><Star /></el-icon>
                    {{ t('supportAuthor') }}
                </el-button>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Refresh, ArrowRight, FullScreen, Brush, FolderOpened, Star } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { config } from '../composables/useStore';
import { ActionType, SIZE_MODES, BLEND_MODES } from '../constants';

const { t } = useI18n();
const bridge = useBridge();

const shortFolder = computed(() => {
    const p = config.randomImageFolder || '';
    if (!p) { return ''; }
    return p.length > 26 ? '…' + p.slice(-25) : p;
});

let intervalTimer: number | undefined;

function onIntervalChange(v: number | undefined) {
    const value = Number(v ?? 10);
    if (intervalTimer) { clearTimeout(intervalTimer); }
    intervalTimer = window.setTimeout(() => {
        bridge.post({ type: 'setConfig', key: 'autoInterval', value });
    }, 300);
}
function onSourceFolder() { bridge.post({ type: 'runAction', action: ActionType.AddDirectory }); }
function onOpenCache()    { bridge.post({ type: 'runAction', action: ActionType.OpenCacheFolder }); }
function onSupport()      { bridge.post({ type: 'runAction', action: ActionType.OpenFilePath, path: '//resources//support.jpg' }); }
</script>

<style lang="scss" scoped>
.advanced-tab { display: flex; flex-direction: column; gap: 12px; }

.card :deep(.el-card__header) { padding: 8px 12px; }
.card :deep(.el-card__body)   { padding: 10px 12px; }

.card-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
    .el-icon { color: var(--studio-accent); }
}

.row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    & + .row { border-top: var(--studio-divider); }
}

.row-label {
    font-size: 12px;
    color: var(--vscode-foreground);
}

.folder-btn {
    max-width: 70%;
    overflow: hidden;
    .folder-text {
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        direction: rtl;
    }
}

.block-select { width: 100%; }

.interval-input { width: 120px; }

.quick-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
}

.block-btn.block-btn {
    width: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center;
    margin: 0 !important;
}

.block-btn :deep(> span) {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}
</style>
