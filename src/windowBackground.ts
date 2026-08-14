import * as crypto from 'crypto';
import * as path from 'path';
import { env, workspace } from 'vscode';
import { getContext, onDidChangeGlobalState } from './global';

const WINDOW_IMAGES_KEY = 'backgroundCover.windowImages';
const WORKSPACE_IMAGES_KEY = 'backgroundCover.workspaceImages';
// 全局兜底图。以前这个角色由 settings.json 的 backgroundCover.imagePath 承担，
// 但那份值只在首次为空时写入、之后永久冻结，settings.json 会长期停留在用户第一次
// 选的那张图上。改用独立的 globalState key 后，settings.json 只作为老用户的迁移
// 兜底读取，扩展不再回写它。
const GLOBAL_IMAGE_KEY = 'backgroundCover.globalImage';

// window 记录以 session 为键，而 session 每次启动/重载都会变，这张表只增不减。
// 保留最近若干条(按插入顺序淘汰)，当前窗口的记录永不淘汰。
const MAX_WINDOW_RECORDS = 40;

// 非持久化更新(定时自动换图)只改内存：既避免每个间隔都写两个 globalState key
// 并连带刷新 TreeView/Studio，也避免把"换图失败的地址"落盘。session 结束即失效，
// 这本身就是 persist=false 期望的语义。
let volatileImagePath: string | undefined;

/**
 * 关掉后回到旧版行为：所有窗口共用一张背景图、共用一份 CSS 文件。
 * 每次读取而不缓存，配置改动后无需重启窗口即可生效。
 */
export function isPerWindowEnabled(): boolean {
    try {
        return workspace.getConfiguration('backgroundCover').get<boolean>('perWindowBackground', true);
    } catch {
        return true;
    }
}

function shortHash(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
}

function hasOwn(target: Record<string, string>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(target, key);
}

export function getSessionHash(): string {
    return shortHash(env.sessionId || 'default-session');
}

export function getWorkspaceKey(): string | undefined {
    const folder = workspace.workspaceFolders && workspace.workspaceFolders[0];
    if (!folder) {
        return undefined;
    }
    const normalized = path.normalize(folder.uri.fsPath).replace(/\\+/g, '/').replace(/\/+$/, '').toLowerCase();
    return shortHash(normalized);
}

export function getWindowCssFileName(): string {
    return `css-background-cover.${getSessionHash()}.css`;
}

function readImageMap(key: string): Record<string, string> {
    return { ...(getContext().globalState.get<Record<string, string>>(key, {}) || {}) };
}

function readGlobalImage(): string | undefined {
    const value = getContext().globalState.get<string>(GLOBAL_IMAGE_KEY);
    return typeof value === 'string' ? value : undefined;
}

export function hasCurrentImageRecord(): boolean {
    if (volatileImagePath !== undefined) {
        return true;
    }
    // 共用模式下窗口/工作区级记录一律忽略，只认全局值。
    if (isPerWindowEnabled()) {
        const windowMap = readImageMap(WINDOW_IMAGES_KEY);
        if (hasOwn(windowMap, getSessionHash())) {
            return true;
        }
        const workspaceKey = getWorkspaceKey();
        if (workspaceKey) {
            const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
            if (hasOwn(workspaceMap, workspaceKey)) {
                return true;
            }
        }
    }
    // 记录过空字符串也算"记录过"——用户显式关掉了背景，不该再被全局兜底复活。
    return readGlobalImage() !== undefined;
}

export function resolveCurrentImagePath(globalFallback?: string): string {
    if (volatileImagePath !== undefined) {
        return volatileImagePath;
    }
    if (isPerWindowEnabled()) {
        const windowMap = readImageMap(WINDOW_IMAGES_KEY);
        const sessionHash = getSessionHash();
        if (hasOwn(windowMap, sessionHash)) {
            return windowMap[sessionHash] || '';
        }
        const workspaceKey = getWorkspaceKey();
        if (workspaceKey) {
            const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
            if (hasOwn(workspaceMap, workspaceKey)) {
                return workspaceMap[workspaceKey] || '';
            }
        }
    }
    const globalImage = readGlobalImage();
    if (globalImage !== undefined) {
        return globalImage;
    }
    // 老用户迁移路径：globalState 里还没有记录时，读 settings.json 的旧值。
    return globalFallback || '';
}

export interface SetImageOptions {
    /** false 表示只更新当前窗口的内存态(定时自动换图)，不写入 globalState。 */
    persist?: boolean;
}

export async function setCurrentImagePath(imagePath: string, options: SetImageOptions = {}): Promise<void> {
    const value = imagePath || '';
    if (options.persist === false) {
        volatileImagePath = value;
        onDidChangeGlobalState.fire();
        return;
    }

    // 有显式持久化写入时，内存态的临时图就失去意义了。
    volatileImagePath = undefined;

    const context = getContext();
    // 共用模式下不再往窗口/工作区表里写，避免以后切回独立模式时被过期记录顶掉全局值。
    if (isPerWindowEnabled()) {
        const sessionHash = getSessionHash();
        const windowMap = readImageMap(WINDOW_IMAGES_KEY);
        windowMap[sessionHash] = value;
        await context.globalState.update(WINDOW_IMAGES_KEY, pruneWindowImages(windowMap, sessionHash));

        const workspaceKey = getWorkspaceKey();
        if (workspaceKey) {
            const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
            workspaceMap[workspaceKey] = value;
            await context.globalState.update(WORKSPACE_IMAGES_KEY, workspaceMap);
        }
    }

    await context.globalState.update(GLOBAL_IMAGE_KEY, value);
    onDidChangeGlobalState.fire();
}

function pruneWindowImages(map: Record<string, string>, keepKey: string): Record<string, string> {
    const keys = Object.keys(map);
    if (keys.length <= MAX_WINDOW_RECORDS) {
        return map;
    }
    const pruned = { ...map };
    let toRemove = keys.length - MAX_WINDOW_RECORDS;
    for (const key of keys) {
        if (toRemove <= 0) {
            break;
        }
        if (key === keepKey) {
            continue;
        }
        delete pruned[key];
        toRemove--;
    }
    return pruned;
}
