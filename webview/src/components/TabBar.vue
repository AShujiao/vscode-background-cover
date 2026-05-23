<template>
    <nav class="tabbar" role="tablist">
        <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tabbar-item"
            :class="{ 'is-active': tab.key === modelValue }"
            role="tab"
            :aria-selected="tab.key === modelValue"
            @click="$emit('update:modelValue', tab.key)"
        >
            <span class="tabbar-icon">{{ tab.icon }}</span>
            <span class="tabbar-label">{{ tab.label }}</span>
        </button>
    </nav>
</template>

<script setup lang="ts">
interface TabItem { key: string; label: string; icon: string; }
defineProps<{
    modelValue: string;
    tabs: TabItem[];
}>();
defineEmits<{ (e: 'update:modelValue', v: string): void }>();
</script>

<style lang="scss" scoped>
.tabbar {
    display: flex;
    gap: 2px;
    padding: 0 12px;
    border-bottom: 1px solid var(--bgc-border-soft);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }
}

.tabbar-item {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 6px 4px 8px;
    color: var(--bgc-fg-muted);
    border-bottom: 2px solid transparent;
    transition: color 0.12s ease, border-color 0.12s ease;
    font-size: var(--bgc-font-sm);
    &:hover {
        color: var(--bgc-fg);
    }
    &.is-active {
        color: var(--bgc-fg);
        border-bottom-color: var(--bgc-accent);
    }
}

.tabbar-icon {
    font-size: 14px;
    line-height: 1;
}

.tabbar-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}
</style>
