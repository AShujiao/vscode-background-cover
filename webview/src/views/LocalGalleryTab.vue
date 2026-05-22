<template>
    <div class="local-gallery">
        <!-- Quick actions header -->
        <div class="actions-bar">
            <el-button type="primary" size="small" @click="onPick">
                <el-icon><Plus /></el-icon>
                {{ t('selectImage') }}
            </el-button>
            <el-button size="small" @click="onAddDir">
                <el-icon><FolderAdd /></el-icon>
                {{ t('addDirectory') }}
            </el-button>
        </div>

        <!-- Recent thumbnails -->
        <el-card class="grid-card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><PictureFilled /></el-icon>
                    {{ t('recentImages') }}
                    <el-tag size="small" round>{{ state.recentImages.length }}</el-tag>
                </span>
            </template>

            <el-empty
                v-if="state.recentImages.length === 0"
                :description="t('emptyRecent')"
                :image-size="60"
            />
            <div v-else class="thumb-grid">
                <div
                    v-for="img in state.recentImages"
                    :key="img.path"
                    class="thumb"
                    :class="{ 'is-active': img.path === config.imagePath }"
                    :title="img.name"
                    @click="onSelectRecent(img.path)"
                >
                    <video
                        v-if="img.display && isVideoPath(img.path)"
                        :src="img.display"
                        muted
                        loop
                        playsinline
                        preload="metadata"
                        @mouseenter="onHover($event, true)"
                        @mouseleave="onHover($event, false)"
                    />
                    <img v-else-if="img.display" :src="img.display" :alt="img.name" loading="lazy" />
                    <div v-else class="thumb-fallback">
                        <el-icon><Picture /></el-icon>
                    </div>
                    <div v-if="isVideoPath(img.path)" class="thumb-kind">
                        <el-icon><VideoCamera /></el-icon>
                    </div>
                    <div class="thumb-name">{{ img.name }}</div>
                    <div v-if="img.path === config.imagePath" class="thumb-badge">
                        <el-icon><Check /></el-icon>
                    </div>
                </div>
            </div>
        </el-card>

        <!-- Folder library (in-panel replacement for the native QuickPick after "Add Folder") -->
        <el-card v-if="config.randomImageFolder" class="grid-card" shadow="never">
            <template #header>
                <div class="folder-header">
                    <span class="card-title">
                        <el-icon><FolderOpened /></el-icon>
                        {{ t('folderLibrary') }}
                        <el-tag size="small" round>{{ state.folderImagesTotal }}</el-tag>
                    </span>
                    <span class="folder-path" :title="config.randomImageFolder">
                        {{ shortFolder }}
                    </span>
                </div>
            </template>

            <el-empty
                v-if="state.folderImages.length === 0"
                :description="t('folderLibraryEmpty')"
                :image-size="60"
            />
            <div v-else>
                <div class="thumb-grid">
                    <div
                        v-for="img in pagedFolderImages"
                        :key="img.path"
                        class="thumb"
                        :class="{ 'is-active': img.path === config.imagePath }"
                        :title="img.name"
                        @click="onApplyFolderImage(img.path)"
                    >
                        <video
                            v-if="img.display && isVideoPath(img.path)"
                            :src="img.display"
                            muted
                            loop
                            playsinline
                            preload="metadata"
                            @mouseenter="onHover($event, true)"
                            @mouseleave="onHover($event, false)"
                        />
                        <img v-else-if="img.display" :src="img.display" :alt="img.name" loading="lazy" />
                        <div v-else class="thumb-fallback">
                            <el-icon><Picture /></el-icon>
                        </div>
                        <div v-if="isVideoPath(img.path)" class="thumb-kind">
                            <el-icon><VideoCamera /></el-icon>
                        </div>
                        <div class="thumb-name">{{ img.name }}</div>
                        <div v-if="img.path === config.imagePath" class="thumb-badge">
                            <el-icon><Check /></el-icon>
                        </div>
                    </div>
                </div>
                <div v-if="folderTotalPages > 1" class="folder-pager">
                    <el-pagination
                        :current-page="folderPage"
                        :page-size="folderPageSize"
                        :total="state.folderImages.length"
                        layout="prev, pager, next"
                        :pager-count="5"
                        small
                        background
                        @current-change="onFolderPageChange"
                    />
                </div>
                <div
                    v-if="state.folderImagesTotal > state.folderImages.length"
                    class="folder-more"
                >
                    {{ t('folderLibraryMore').replace('{n}', String(state.folderImagesTotal)).replace('{shown}', String(state.folderImages.length)) }}
                </div>
            </div>
        </el-card>

        <!-- Input path -->
        <el-card class="grid-card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><Link /></el-icon>
                    {{ t('inputPath') }}
                </span>
            </template>
            <el-button class="block-btn" @click="onInputPath">
                {{ t('inputPath') }}
            </el-button>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Plus, FolderAdd, FolderOpened, PictureFilled, Picture, Check, Link, VideoCamera } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { config, state } from '../composables/useStore';
import { ActionType } from '../constants';
import { isVideoPath } from '../utils/media';

const { t } = useI18n();
const bridge = useBridge();

const shortFolder = computed(() => {
    const p = config.randomImageFolder || '';
    if (!p) { return ''; }
    return p.length > 28 ? '…' + p.slice(-27) : p;
});

const folderPageSize = 20;
const folderPage = ref(1);
const folderTotalPages = computed(() => Math.max(1, Math.ceil(state.folderImages.length / folderPageSize)));
const pagedFolderImages = computed(() => {
    const start = (folderPage.value - 1) * folderPageSize;
    return state.folderImages.slice(start, start + folderPageSize);
});
function onFolderPageChange(p: number) { folderPage.value = p; }

// Reset to page 1 whenever the folder source or list size changes.
watch(() => config.randomImageFolder, () => { folderPage.value = 1; });
watch(() => state.folderImages.length, () => {
    if (folderPage.value > folderTotalPages.value) { folderPage.value = 1; }
});

function onPick()      { bridge.post({ type: 'runAction', action: ActionType.SelectPictures }); }
function onAddDir()    { bridge.post({ type: 'runAction', action: ActionType.AddDirectory }); }
function onInputPath() { bridge.post({ type: 'runAction', action: ActionType.InputPath }); }
function onSelectRecent(path: string) {
    bridge.post({ type: 'runAction', action: ActionType.UpdateBackground, path });
}
function onApplyFolderImage(path: string) {
    bridge.post({ type: 'setConfig', key: 'imagePath', value: path });
}

function onHover(ev: Event, entering: boolean) {
    const el = ev.currentTarget as HTMLVideoElement | null;
    if (!el) { return; }
    if (entering) {
        el.play().catch(() => { /* autoplay blocked */ });
    } else {
        el.pause();
        try { el.currentTime = 0; } catch { /* noop */ }
    }
}
</script>

<style lang="scss" scoped>
.local-gallery { display: flex; flex-direction: column; gap: 12px; }

.actions-bar {
    display: flex;
    gap: 8px;
    .el-button { flex: 1 1 0; }
}

.grid-card :deep(.el-card__header) { padding: 8px 12px; }
.grid-card :deep(.el-card__body)   { padding: 10px 12px; }

.card-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
    .el-icon { color: var(--studio-accent); }
}

.thumb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
    gap: 10px;
}

.thumb {
    position: relative;
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: var(--studio-input-bg);
    border: 1px solid rgba(120, 140, 200, 0.18);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    &:hover {
        transform: translateY(-2px);
        border-color: rgba(108, 140, 255, 0.45);
        box-shadow:
            0 10px 24px rgba(108, 140, 255, 0.25),
            0 0 0 1px rgba(108, 140, 255, 0.25);
    }
    &.is-active {
        border-color: var(--studio-accent);
        box-shadow:
            0 0 0 2px var(--studio-accent),
            0 10px 24px rgba(108, 140, 255, 0.35);
    }
    img, video {
        width: 100%;
        aspect-ratio: 16 / 10;
        object-fit: cover;
        display: block;
        background: #000;
    }
}

.thumb-kind {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 2px 6px;
    background: rgba(15, 18, 32, 0.7);
    color: #fff;
    border-radius: 999px;
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 2px;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
}

.thumb-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 16 / 10;
    color: var(--vscode-descriptionForeground);
    font-size: 20px;
}

.thumb-name {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 16px 6px 4px;
    font-size: 10px;
    color: #fff;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
}

.thumb-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 18px;
    height: 18px;
    background: var(--studio-btn-grad);
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    box-shadow: 0 2px 8px rgba(108, 140, 255, 0.55);
}

.block-btn { width: 100%; }

.folder-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
}

.folder-path {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    font-family: 'Consolas', 'SFMono-Regular', Menlo, monospace;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
}

.folder-more {
    margin-top: 10px;
    padding: 6px 4px;
    border-top: var(--studio-divider);
    font-size: 11px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
}

.folder-pager {
    display: flex;
    justify-content: center;
    margin-top: 10px;
}
</style>
