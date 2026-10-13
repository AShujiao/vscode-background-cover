import { onUnmounted } from 'vue';
import { useBridge } from './useBridge';
import { markDirty } from './useStore';

/** setConfig 写 config.<key>；setGlobalState 写 state 中对应字段。 */
export type DebouncedPostKind = 'setConfig' | 'setGlobalState';

export interface DebouncedPostOptions {
    /** 防抖间隔（ms） */
    delay: number;
    /**
     * 本地 store 中对应的字段名（用于 applyState 跳过脏字段）。
     * setConfig 默认与 key 相同；setGlobalState 的 key 与 state 字段不同名，需显式给出。
     */
    storeKey?: string;
}

/** 最后一次发送后，再保持 dirty 的时长，覆盖扩展回推 state 的往返时间。 */
const DIRTY_GRACE_MS = 400;

/**
 * 封装「防抖发送 setConfig/setGlobalState」：
 * - 拖动期间与发送后 DIRTY_GRACE_MS 内将该字段标记为本地脏值，
 *   扩展回推的 state 不会覆盖用户正在调整的值；
 * - 组件卸载时清理定时器；
 * - flush() 立即发送挂起的值，cancel() 丢弃挂起的值。
 */
export function useDebouncedPost(kind: DebouncedPostKind, key: string, options: DebouncedPostOptions) {
    const bridge = useBridge();
    const scope = kind === 'setConfig' ? 'config' : 'state';
    const storeKey = options.storeKey ?? key;
    let timer: number | undefined;
    let pending: { value: unknown } | null = null;

    function send() {
        timer = undefined;
        if (!pending) { return; }
        const value = pending.value;
        pending = null;
        bridge.post({ type: kind, key, value });
        markDirty(scope, storeKey, DIRTY_GRACE_MS);
    }

    function post(value: unknown) {
        pending = { value };
        // 防抖等待期间同样视为脏，额外留出 grace 时间
        markDirty(scope, storeKey, options.delay + DIRTY_GRACE_MS);
        if (timer) { clearTimeout(timer); }
        timer = window.setTimeout(send, options.delay);
    }

    function cancel() {
        if (timer) { clearTimeout(timer); }
        timer = undefined;
        pending = null;
    }

    function flush() {
        if (timer) { clearTimeout(timer); }
        send();
    }

    onUnmounted(flush);

    return { post, flush, cancel };
}
