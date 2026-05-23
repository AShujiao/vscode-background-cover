<template>
    <div class="home-tab">
        <!-- Preview card -->
        <el-card class="preview-card" shadow="never">
            <div class="preview-frame" :class="{ 'is-empty': !displayUrl }">
                <video
                    v-if="displayUrl && isVideo"
                    :src="displayUrl"
                    autoplay
                    muted
                    loop
                    playsinline
                />
                <img
                    v-else-if="displayUrl"
                    :src="displayUrl"
                    alt="background preview"
                />
                <div v-else class="preview-empty">
                    <el-icon :size="32"><Picture /></el-icon>
                    <span>{{ t('none') }}</span>
                </div>
                <div class="preview-overlay">
                    <el-button type="primary" size="small" @click="onPick">
                        <el-icon><Upload /></el-icon>
                        {{ t('selectImage') }}
                    </el-button>
                </div>
            </div>
            <div class="preview-meta">
                <span class="meta-label">{{ t('currentBackground') }}</span>
                <span class="meta-path" :title="config.imagePath">
                    {{ shortPath || t('notSet') }}
                </span>
            </div>
        </el-card>

        <!-- Opacity & Blur -->
        <el-card shadow="never" class="section-card">
            <template #header>
                <span class="card-title">
                    <el-icon><Operation /></el-icon>
                    {{ t('opacity') }} & {{ t('blur') }}
                </span>
            </template>

            <div class="slider-row">
                <label>{{ t('opacity') }}</label>
                <el-slider
                    :model-value="config.opacity"
                    :min="0" :max="0.8" :step="0.01"
                    :format-tooltip="formatOpacity"
                    @input="onOpacityInput"
                />
            </div>
            <div class="slider-row">
                <label>{{ t('blur') }}</label>
                <el-slider
                    :model-value="config.blur"
                    :min="0" :max="100" :step="1"
                    @input="onBlurInput"
                />
            </div>
        </el-card>

        <!-- Action Center -->
        <el-card shadow="never" class="section-card action-center">
            <template #header>
                <span class="card-title">
                    <el-icon><Grid /></el-icon>
                    {{ t('actionCenter') }}
                </span>
            </template>
            <div class="action-grid">
                <button class="action-tile" @click="onRefresh">
                    <span class="tile-icon tile-icon--blue"><el-icon><RefreshRight /></el-icon></span>
                    <span class="tile-label">{{ t('refresh') }}</span>
                </button>
                <button class="action-tile" @click="onClear">
                    <span class="tile-icon tile-icon--red"><el-icon><Delete /></el-icon></span>
                    <span class="tile-label">{{ t('clearBackground') }}</span>
                </button>
                <button class="action-tile" @click="onOpenCache">
                    <span class="tile-icon tile-icon--cyan"><el-icon><FolderOpened /></el-icon></span>
                    <span class="tile-label">{{ t('openCacheFolder') }}</span>
                </button>
                <button class="action-tile" @click="onSupport">
                    <span class="tile-icon tile-icon--pink"><el-icon><Star /></el-icon></span>
                    <span class="tile-label">{{ t('supportAuthor') }}</span>
                </button>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Picture, Upload, Operation, RefreshRight, Delete, Grid, FolderOpened, Star } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { config } from '../composables/useStore';
import { ActionType } from '../constants';
import { isVideoPath } from '../utils/media';

const { t } = useI18n();
const bridge = useBridge();

const displayUrl = computed(() => {
    const p = config.imagePath || '';
    if (/^https?:\/\//i.test(p)) { return p; }
    return config.imagePathDisplay || '';
});

const isVideo = computed(() => isVideoPath(config.imagePath));

const shortPath = computed(() => {
    const p = config.imagePath || '';
    if (!p) { return ''; }
    return p.length > 40 ? '…' + p.slice(-39) : p;
});

function formatOpacity(v: number) { return v.toFixed(2); }

let opacityTimer: number | undefined;
function onOpacityInput(v: number) {
    config.opacity = v;
    if (opacityTimer) { clearTimeout(opacityTimer); }
    opacityTimer = window.setTimeout(() => {
        bridge.post({ type: 'setConfig', key: 'opacity', value: v });
    }, 120);
}

let blurTimer: number | undefined;
function onBlurInput(v: number) {
    config.blur = v;
    if (blurTimer) { clearTimeout(blurTimer); }
    blurTimer = window.setTimeout(() => {
        bridge.post({ type: 'setConfig', key: 'blur', value: v });
    }, 120);
}

function onPick()    { bridge.post({ type: 'runAction', action: ActionType.SelectPictures }); }
function onClear()   { bridge.post({ type: 'runAction', action: ActionType.CloseBackground }); }
function onRefresh() { bridge.post({ type: 'runAction', action: ActionType.UpdateBackground }); }
function onOpenCache() { bridge.post({ type: 'runAction', action: ActionType.OpenCacheFolder }); }
function onSupport()   { bridge.post({ type: 'runAction', action: ActionType.OpenFilePath, path: '//resources//support.jpg' }); }
</script>

<style lang="scss" scoped>
.home-tab { display: flex; flex-direction: column; gap: 12px; }

.preview-card :deep(.el-card__body) { padding: 10px; }

.preview-frame {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    overflow: hidden;
    background: var(--studio-input-bg);
    border: 1px solid rgba(120, 140, 200, 0.18);
    box-shadow:
        0 0 0 1px rgba(108, 140, 255, 0.06) inset,
        0 10px 30px rgba(0, 0, 0, 0.35);
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    img, video { width: 100%; height: 100%; object-fit: cover; display: block; }
    &.is-empty {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    &:hover {
        transform: translateY(-1px);
        box-shadow:
            0 0 0 1px var(--studio-accent) inset,
            0 14px 36px rgba(108, 140, 255, 0.25);
    }
}

.preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
}

.preview-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 10px;
    opacity: 0;
    transition: opacity 0.18s ease;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent 55%);
    .preview-frame:hover &,
    .preview-frame.is-empty & { opacity: 1; }
}

.preview-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 4px 2px;
    margin-top: 8px;
    border-top: var(--studio-divider);
    font-size: 11px;
}
.meta-label { color: var(--vscode-descriptionForeground); flex-shrink: 0; }
.meta-path  {
    flex: 1 1 auto;
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    color: var(--vscode-foreground);
    font-family: 'Consolas', 'SFMono-Regular', Menlo, monospace;
}

.section-card :deep(.el-card__header) { padding: 8px 12px; }
.section-card :deep(.el-card__body)   { padding: 10px 12px 6px; }

.card-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
    .el-icon { color: var(--studio-accent); }
}

.slider-row {
    display: grid;
    grid-template-columns: 56px 1fr;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
    label {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
    }
}

.action-center :deep(.el-card__body) { padding: 10px 12px 12px; }

.action-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.action-tile {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--studio-btn-soft, rgba(46, 54, 88, 0.85));
    border: 1px solid var(--studio-btn-soft-border, rgba(120, 140, 200, 0.35));
    color: var(--vscode-foreground);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.04) inset,
        0 2px 6px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;

    &:hover {
        transform: translateY(-1px);
        background: var(--studio-btn-soft-hover, rgba(60, 74, 120, 0.95));
        border-color: rgba(140, 165, 230, 0.55);
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.06) inset,
            0 6px 16px rgba(108, 140, 255, 0.25);
    }

    &:active { transform: translateY(0); }
}

.tile-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
    flex-shrink: 0;
    color: #fff;
    font-size: 16px;
    box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.18) inset,
        0 4px 10px rgba(0, 0, 0, 0.3);

    .el-icon { font-size: 16px; }

    &--blue {
        background: linear-gradient(135deg, #6c8cff 0%, #4f6df0 100%);
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.2) inset,
            0 4px 12px rgba(108, 140, 255, 0.45);
    }
    &--red {
        background: linear-gradient(135deg, #ff7a8a 0%, #e8556a 100%);
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.2) inset,
            0 4px 12px rgba(232, 85, 106, 0.45);
    }
    &--cyan {
        background: linear-gradient(135deg, #66d4e0 0%, #36b3c2 100%);
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.2) inset,
            0 4px 12px rgba(54, 179, 194, 0.45);
    }
    &--pink {
        background: linear-gradient(135deg, #ff9ec7 0%, #ec6aa7 100%);
        box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.2) inset,
            0 4px 12px rgba(236, 106, 167, 0.45);
    }
}

.tile-label {
    font-size: 12px;
    line-height: 1.2;
    color: var(--vscode-foreground);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
