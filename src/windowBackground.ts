import * as crypto from 'crypto';
import * as path from 'path';
import { env, workspace } from 'vscode';
import { getContext, onDidChangeGlobalState } from './global';

const WINDOW_IMAGES_KEY = 'backgroundCover.windowImages';
const WORKSPACE_IMAGES_KEY = 'backgroundCover.workspaceImages';

function shortHash(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').slice(0, 8);
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

export function hasCurrentImageRecord(): boolean {
    const windowMap = readImageMap(WINDOW_IMAGES_KEY);
    if (Object.prototype.hasOwnProperty.call(windowMap, getSessionHash())) {
        return true;
    }
    const workspaceKey = getWorkspaceKey();
    if (!workspaceKey) {
        return false;
    }
    const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
    return Object.prototype.hasOwnProperty.call(workspaceMap, workspaceKey);
}

export function resolveCurrentImagePath(globalFallback?: string): string {
    const windowMap = readImageMap(WINDOW_IMAGES_KEY);
    const sessionHash = getSessionHash();
    if (Object.prototype.hasOwnProperty.call(windowMap, sessionHash)) {
        return windowMap[sessionHash] || '';
    }
    const workspaceKey = getWorkspaceKey();
    if (workspaceKey) {
        const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
        if (Object.prototype.hasOwnProperty.call(workspaceMap, workspaceKey)) {
            return workspaceMap[workspaceKey] || '';
        }
    }
    return globalFallback || '';
}

export async function setCurrentImagePath(imagePath: string): Promise<void> {
    const context = getContext();
    const sessionHash = getSessionHash();
    const windowMap = readImageMap(WINDOW_IMAGES_KEY);
    windowMap[sessionHash] = imagePath || '';
    await context.globalState.update(WINDOW_IMAGES_KEY, windowMap);

    const workspaceKey = getWorkspaceKey();
    if (workspaceKey) {
        const workspaceMap = readImageMap(WORKSPACE_IMAGES_KEY);
        workspaceMap[workspaceKey] = imagePath || '';
        await context.globalState.update(WORKSPACE_IMAGES_KEY, workspaceMap);
    }
    onDidChangeGlobalState.fire();
}
