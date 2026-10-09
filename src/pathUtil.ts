/**
 * 本地路径工具（借鉴 shalldie/vscode-background 的 AbsPatchGenerator）：
 * - expandPathVariables：展开 `~/`（用户目录）、`${ENV}`、`$ENV`；
 * - hasFileExtension：无扩展名的路径视为文件夹；
 * - listImagesInFolder：递归扫描文件夹下的图片/视频文件（大小写不敏感）。
 *
 * 纯逻辑模块，不依赖 vscode API，方便单元测试。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** 与 PickList.listFolderImages / FileDom.checkIsVideo 保持一致的支持类型。 */
export const MEDIA_EXTS = [
    '.svg', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.jfif',
    '.mp4', '.webm', '.ogg', '.mov'
];

/**
 * 展开路径中的 `~`（用户目录）和环境变量（`${ENV}`、`$ENV`）。
 * 未定义的变量保持原样，避免把用户的字面量悄悄改掉。
 */
export function expandPathVariables(input: string): string {
    if (!input) {
        return input;
    }
    let value = input;

    if (value.startsWith('~/')) {
        value = os.homedir() + value.slice(1);
    }
    value = value.replace(/\$\{(\w+)\}/g, (match, name: string) => {
        return process.env[name] !== undefined ? (process.env[name] as string) : match;
    });
    value = value.replace(/\$(\w+)/g, (match, name: string) => {
        return process.env[name] !== undefined ? (process.env[name] as string) : match;
    });

    return value;
}

/** 是否带文件扩展名（如 `xxx.png`、`C:/a/b.jpg`）。URL 与 data: 不在本函数职责内。 */
export function hasFileExtension(p: string): boolean {
    return /\.[^\\/]+$/.test(p);
}

export const VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.mov'];

export function isSupportedMedia(name: string): boolean {
    const lower = name.toLowerCase();
    return MEDIA_EXTS.some((ext) => lower.endsWith(ext));
}

export function isVideoFile(name: string): boolean {
    const lower = name.toLowerCase().split(/[?#]/)[0];
    return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

export function isOnlineUrl(value: string | undefined): boolean {
    return !!value && /^https?:\/\//i.test(value);
}

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 扫描上限：防止把整个 ~/ 或网盘挂载目录同步递归一遍卡住扩展宿主。 */
export const FOLDER_SCAN_MAX_DEPTH = 6;
export const FOLDER_SCAN_MAX_FILES = 5000;
const FOLDER_SCAN_CACHE_TTL_MS = 30_000;
const folderScanCache = new Map<string, { mtimeMs: number; at: number; files: string[] }>();

/**
 * 递归扫描文件夹下的图片/视频文件（深度优先，目录按字母序保证结果稳定）。
 * 只返回文件，忽略子目录与不可读条目；空/不存在/非目录返回 []。
 * 有深度与数量上限；结果按根目录 mtime + 短 TTL 缓存，自动换图时不必每次重扫。
 */
export function listImagesInFolder(folder: string): string[] {
    let root: string;
    let rootMtime = 0;
    try {
        root = path.resolve(folder);
        rootMtime = fs.statSync(root).mtimeMs;
    } catch {
        return [];
    }
    const cached = folderScanCache.get(root);
    if (cached && cached.mtimeMs === rootMtime && Date.now() - cached.at < FOLDER_SCAN_CACHE_TTL_MS) {
        return cached.files.slice();
    }

    const results: string[] = [];
    const seen = new Set<string>();

    const walk = (dir: string, depth: number) => {
        if (depth > FOLDER_SCAN_MAX_DEPTH || results.length >= FOLDER_SCAN_MAX_FILES) {
            return;
        }
        let normalized: string;
        try {
            normalized = fs.realpathSync(dir);
        } catch {
            return;
        }
        if (seen.has(normalized)) {
            return; // 防止符号链接环
        }
        seen.add(normalized);

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(normalized, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const entry of entries) {
            if (results.length >= FOLDER_SCAN_MAX_FILES) {
                return;
            }
            const full = path.join(dir, entry.name);
            try {
                if (entry.isDirectory()) {
                    walk(full, depth + 1);
                } else if (entry.isFile() && isSupportedMedia(entry.name)) {
                    results.push(full);
                }
            } catch {
                // 单个条目失败不影响整体扫描
            }
        }
    };

    walk(root, 0);
    folderScanCache.set(root, { mtimeMs: rootMtime, at: Date.now(), files: results });
    return results.slice();
}

/**
 * 若 input 展开后是一个本地目录，随机返回其中一张图片/视频的完整路径；
 * 否则返回 undefined（保持调用方原有单文件/URL 逻辑）。
 */
export function pickRandomFromFolder(input: string): string | undefined {
    const expanded = expandPathVariables(input);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(expanded);
    } catch {
        return undefined;
    }
    if (!stat.isDirectory()) {
        return undefined;
    }
    const files = listImagesInFolder(expanded);
    if (!files.length) {
        return undefined;
    }
    return files[Math.floor(Math.random() * files.length)];
}
