<template>
    <div class="online-gallery">
        <div class="actions-bar">
            <el-button size="small" @click="onRefresh">
                <el-icon><Refresh /></el-icon>
                {{ t('refreshOnline') }}
            </el-button>
            <el-button size="small" type="primary" plain @click="onOpenExternal">
                <el-icon><Link /></el-icon>
                {{ t('openOnlineInBrowser') }}
            </el-button>
        </div>

        <el-card class="frame-card" shadow="never">
            <template #header>
                <span class="card-title">
                    <el-icon><Promotion /></el-icon>
                    {{ t('onlineGallery') }}
                </span>
            </template>
            <div class="frame-wrap">
                <iframe
                    ref="frameRef"
                    :key="frameKey"
                    :src="ONLINE_GALLERY_URL"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerpolicy="no-referrer"
                />
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Refresh, Link, Promotion } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { ONLINE_GALLERY_URL } from '../constants';

const { t } = useI18n();
const bridge = useBridge();

const frameRef = ref<HTMLIFrameElement | null>(null);
const frameKey = ref(0);

function onRefresh() {
    frameKey.value++;
}

function onOpenExternal() {
    bridge.post({ type: 'openExternal', url: ONLINE_GALLERY_URL });
}

// Forward set_img / set_home messages emitted by the embedded iframe
// to the extension host via the bridge, reusing the existing protocol
// in StudioViewProvider / readerView.
function onWindowMessage(ev: MessageEvent) {
    const msg = ev.data;
    if (!msg || typeof msg !== 'object') { return; }
    if (msg.command === 'set_img' || msg.command === 'set_home') {
        bridge.post({ type: 'galleryMessage', command: msg.command, data: msg.data });
    }
}

onMounted(() => { window.addEventListener('message', onWindowMessage); });
onUnmounted(() => { window.removeEventListener('message', onWindowMessage); });
</script>

<style lang="scss" scoped>
.online-gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    min-height: 0;
}

.actions-bar {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    .el-button { flex: 1 1 0; }
}

.frame-card {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.frame-card :deep(.el-card__header) { padding: 8px 12px; flex-shrink: 0; }
.frame-card :deep(.el-card__body) {
    padding: 0;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
}

.card-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--vscode-foreground);
    .el-icon { color: var(--studio-accent); }
}

.frame-wrap {
    flex: 1 1 auto;
    min-height: 360px;
    display: flex;
    iframe {
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
        min-height: 360px;
        border: 0;
        background: var(--vscode-editor-background);
    }
}
</style>
