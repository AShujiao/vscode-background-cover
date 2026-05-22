/**
 * Vue composable wrapping the VS Code Webview message bridge.
 *
 * Outbound messages use `vscode.postMessage`; inbound messages dispatch by
 * `data.type`. The acquireVsCodeApi() handle can only be obtained once per
 * webview, so it's memoised at module scope.
 */

export interface OutboundMessage {
    type: string;
    [k: string]: any;
}

type Listener = (data: any) => void;

const listeners = new Map<string, Set<Listener>>();
let vscodeApi: any = null;

function getApi() {
    if (vscodeApi) { return vscodeApi; }
    if (typeof (window as any).acquireVsCodeApi === 'function') {
        vscodeApi = (window as any).acquireVsCodeApi();
    } else {
        // Standalone preview (vite dev) — fall back to console logger
        vscodeApi = {
            postMessage: (msg: any) => console.log('[bridge:dev]', msg),
            getState: () => ({}),
            setState: () => undefined
        };
    }
    return vscodeApi;
}

if (typeof window !== 'undefined') {
    window.addEventListener('message', (ev: MessageEvent) => {
        const data = ev.data;
        if (!data || typeof data.type !== 'string') { return; }
        const set = listeners.get(data.type);
        if (set) { set.forEach(fn => fn(data)); }
    });
}

export function useBridge() {
    return {
        post(msg: OutboundMessage) {
            getApi().postMessage(msg);
        },
        on(type: string, fn: Listener) {
            if (!listeners.has(type)) { listeners.set(type, new Set()); }
            listeners.get(type)!.add(fn);
            return () => listeners.get(type)!.delete(fn);
        }
    };
}
