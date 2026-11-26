<template>
    <div class="online-gallery">
        <div class="actions-bar">
            <el-button type="primary" size="small" @click="onInputPath">
                <el-icon><Link /></el-icon>
                {{ t('inputPath') }}
            </el-button>
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
                    v-if="loaded"
                    ref="frameRef"
                    :key="frameKey"
                    :src="ONLINE_GALLERY_URL"
                    :title="t('onlineGalleryFrameTitle')"
                    :aria-label="t('onlineGalleryFrameTitle')"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                    referrerpolicy="no-referrer"
                />
                <div v-else class="frame-placeholder">
                    <div class="intro">
                        <div class="intro-title">
                            <el-icon><Star /></el-icon>
                            <span>{{ t('onlineGallery') }} · {{ t('onlineGalleryDonorOnly') }}</span>
                        </div>
                        <p class="intro-desc">{{ t('onlineGalleryIntro') }}</p>
                    </div>

                    <div class="tiers">
                        <div class="tier">
                            <div class="tier-title">{{ t('tierTitle5') }}</div>
                            <ul class="tier-benefits">
                                <li>{{ t('tierBenefitBrowse') }}</li>
                                <li>{{ t('tierBenefitPost') }}</li>
                                <li>{{ t('tierBenefitSetBg') }}</li>
                                <li>{{ t('tierBenefitThirdParty') }}</li>
                            </ul>
                        </div>
                        <div class="tier tier-highlight">
                            <div class="tier-badge">{{ t('tierRecommend') }}</div>
                            <div class="tier-title">{{ t('tierTitle10') }}</div>
                            <ul class="tier-benefits">
                                <li>{{ t('tierBenefitBrowse') }}</li>
                                <li>{{ t('tierBenefitPost') }}</li>
                                <li>{{ t('tierBenefitSetBg') }}</li>
                                <li>{{ t('tierBenefitThirdParty') }}</li>
                                <li class="tier-extra">{{ t('tierBenefitUpload') }}</li>
                            </ul>
                        </div>
                    </div>

                    <div class="cta-group">
                        <el-button type="primary" size="small" @click="onLoad">
                            <el-icon><Promotion /></el-icon>
                            {{ t('loadOnlineGallery') }}
                        </el-button>
                        <el-button type="danger" size="small" plain @click="onDonate">
                            {{ t('donateNow') }}
                        </el-button>
                    </div>

                    <ul class="frame-hint">
                        <li>{{ t('loadOnlineGalleryHint1') }}</li>
                        <li>{{ t('loadOnlineGalleryHint2') }}</li>
                        <li>{{ t('loadOnlineGalleryHint3') }}</li>
                    </ul>
                </div>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Refresh, Link, Promotion, Star } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { ActionType, ONLINE_GALLERY_URL } from '../constants';

const { t } = useI18n();
const bridge = useBridge();

const frameRef = ref<HTMLIFrameElement | null>(null);
const frameKey = ref(0);
// iframe 只在用户显式进入在线图库后才创建：面板挂载时就加载会让每次打开侧边栏
// 都请求一遍整个图库页面及其缩略图。
const loaded = ref(false);

function onLoad() {
    loaded.value = true;
}

function onRefresh() {
    if (!loaded.value) {
        loaded.value = true;
        return;
    }
    frameKey.value++;
}

function onInputPath() {
    bridge.post({ type: 'runAction', action: ActionType.InputPath });
}

function onOpenExternal() {
    bridge.post({ type: 'openExternal', url: ONLINE_GALLERY_URL });
}

function onDonate() {
    // 复用扩展侧既有的"赞助作者"动作：打开 resources/support.jpg 二维码图片。
    bridge.post({
        type: 'runAction',
        action: ActionType.OpenFilePath,
        path: '//resources//support.jpg'
    });
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

.frame-placeholder {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    text-align: center;
    overflow-y: auto;
}

.intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.intro-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--vscode-foreground);
    .el-icon { color: var(--studio-accent, #f5a623); }
}

.intro-desc {
    margin: 0;
    font-size: 12px;
    opacity: 0.85;
    color: var(--vscode-descriptionForeground);
    max-width: 360px;
}

.tiers {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    width: 100%;
    max-width: 420px;
}

.tier {
    position: relative;
    border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.25));
    border-radius: 6px;
    padding: 10px 12px;
    text-align: left;
    background: var(--vscode-editor-background);
}

.tier-highlight {
    border-color: var(--studio-accent, #f5a623);
    box-shadow: 0 0 0 1px var(--studio-accent, #f5a623) inset;
}

.tier-badge {
    position: absolute;
    top: -8px;
    right: 8px;
    padding: 1px 8px;
    font-size: 10px;
    line-height: 14px;
    border-radius: 8px;
    background: var(--studio-accent, #f5a623);
    color: #fff;
    font-weight: 600;
}

.tier-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--vscode-foreground);
}

.tier-benefits {
    margin: 0;
    padding-left: 16px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--vscode-descriptionForeground);
    li + li { margin-top: 2px; }
}

.tier-extra {
    color: var(--studio-accent, #f5a623);
    font-weight: 600;
}

.cta-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
}

.frame-hint {
    font-size: 11px;
    opacity: 0.7;
    color: var(--vscode-descriptionForeground);
    margin: 0;
    padding-left: 18px;
    text-align: left;
    max-width: 360px;
    line-height: 1.6;
    li + li { margin-top: 4px; }
}
</style>
