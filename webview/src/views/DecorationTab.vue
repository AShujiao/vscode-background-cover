<template>
    <div class="decoration-tab">
        <!-- Pet -->
        <el-card class="card" shadow="never">
            <template #header>
                <div class="card-header">
                    <span class="card-title">
                        <el-icon><Sunny /></el-icon>
                        {{ t('petAssistant') }}
                    </span>
                    <el-switch
                        :model-value="!!state.petEnabled"
                        @change="togglePet"
                    />
                </div>
            </template>

            <div class="row">
                <span class="row-label">{{ t('selectPet') }}</span>
                <el-button link type="primary" @click="onSelectPet">
                    {{ state.petType || t('notSet') }}
                    <el-icon><ArrowRight /></el-icon>
                </el-button>
            </div>
        </el-card>

        <!-- Particles -->
        <el-card class="card" shadow="never">
            <template #header>
                <div class="card-header">
                    <span class="card-title">
                        <el-icon><MagicStick /></el-icon>
                        {{ t('particles') }}
                    </span>
                    <el-switch
                        :model-value="!!state.particleEffect"
                        @change="toggleParticle"
                    />
                </div>
            </template>

            <div class="slider-row">
                <span class="slider-label">{{ t('particleOpacity') }}</span>
                <el-slider
                    class="slider-input"
                    :model-value="Number(state.particleOpacity ?? 0.5)"
                    :min="0" :max="1" :step="0.05"
                    :show-tooltip="false"
                    @click="onParticleOpacity"
                />
                <span class="slider-value">{{ Number(state.particleOpacity ?? 0.5).toFixed(2) }}</span>
            </div>

            <div class="slider-row">
                <span class="slider-label">{{ t('particleCount') }}</span>
                <el-slider
                    class="slider-input"
                    :model-value="Number(state.particleCount ?? 60)"
                    :min="10" :max="300" :step="10"
                    :show-tooltip="false"
                    @click="onParticleCount"
                />
                <span class="slider-value">{{ state.particleCount ?? 60 }}</span>
            </div>

            <div class="row">
                <span class="row-label">{{ t('particleColor') }}</span>
                <el-button link type="primary" @click="onParticleColor">
                    <span class="color-dot" :style="{ background: state.particleColor || '#ffffff' }" />
                    {{ state.particleColor || '#ffffff' }}
                    <el-icon><ArrowRight /></el-icon>
                </el-button>
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { Sunny, MagicStick, ArrowRight } from '@element-plus/icons-vue';
import { useI18n } from '../composables/useI18n';
import { useBridge } from '../composables/useBridge';
import { state } from '../composables/useStore';
import { ActionType } from '../constants';

const { t } = useI18n();
const bridge = useBridge();

function togglePet()         { bridge.post({ type: 'runAction', action: ActionType.TogglePet }); }
function onSelectPet()       { bridge.post({ type: 'runAction', action: ActionType.SelectPet }); }
function toggleParticle()    { bridge.post({ type: 'runAction', action: ActionType.ToggleParticle }); }
function onParticleOpacity() { bridge.post({ type: 'runAction', action: ActionType.ParticleOpacity }); }
function onParticleCount()   { bridge.post({ type: 'runAction', action: ActionType.ParticleCount }); }
function onParticleColor()   { bridge.post({ type: 'runAction', action: ActionType.ParticleColor }); }
</script>

<style lang="scss" scoped>
.decoration-tab { display: flex; flex-direction: column; gap: 12px; }

.card :deep(.el-card__header) { padding: 8px 12px; }
.card :deep(.el-card__body)   { padding: 10px 12px; }

.card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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

.slider-row {
    display: grid;
    grid-template-columns: 60px 1fr 36px;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    & + .slider-row, & + .row { border-top: var(--studio-divider); }
}

.slider-label {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}

.slider-input {
    --el-slider-height: 6px;
    --el-slider-button-size: 14px;
}

.slider-value {
    text-align: right;
    font-size: 11px;
    color: var(--vscode-foreground);
    font-variant-numeric: tabular-nums;
}

.color-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 6px;
    border: 1px solid rgba(255,255,255,0.2);
    box-shadow:
        0 0 0 2px rgba(108, 140, 255, 0.18),
        0 0 6px rgba(108, 140, 255, 0.35);
    vertical-align: middle;
}
</style>
