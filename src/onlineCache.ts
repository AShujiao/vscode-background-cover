import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getContext } from './global';

/**
 * 在线图片本地缓存的路径规则。FileDom 下载和 webview 预览必须共用这一份规则，
 * 否则预览侧找不到已下载的文件就会退回引用在线地址，白白产生云存储流量。
 */

export function getOnlineCacheDir(): string {
    return path.join(getContext().globalStorageUri.fsPath, 'images');
}

export function getOnlineCacheHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex');
}

export function isOnlineUrl(value: string): boolean {
    return /^https?:\/\//i.test(value || '');
}

/**
 * 在缓存目录中查找某个在线地址已下载的本地文件。
 *
 * 命名有两种形态(见 FileDom.downloadAndCacheImage)：带扩展名的静态图为
 * `<hash><ext>`，无扩展名/动态地址为 `<hash>-<timestamp><ext>`，后者取最新一个。
 *
 * `entries` 可传入调用方已经读过的目录列表，避免批量转换时反复 readdir。
 */
export function findCachedOnlineImage(url: string, entries?: string[]): string | undefined {
    if (!isOnlineUrl(url)) { return undefined; }

    const dir = getOnlineCacheDir();
    let names = entries;
    if (!names) {
        try {
            names = fs.readdirSync(dir);
        } catch {
            return undefined;
        }
    }

    const hash = getOnlineCacheHash(url);
    const candidates = names.filter(name =>
        name.startsWith(hash) &&
        !name.endsWith('.tmp') &&
        (name.length === hash.length || /^[.-]/.test(name.charAt(hash.length)))
    );
    if (candidates.length === 0) { return undefined; }

    let best: { file: string; mtime: number } | undefined;
    for (const name of candidates) {
        const full = path.join(dir, name);
        try {
            const stat = fs.statSync(full);
            if (!stat.isFile()) { continue; }
            if (!best || stat.mtimeMs > best.mtime) {
                best = { file: full, mtime: stat.mtimeMs };
            }
        } catch {
            continue;
        }
    }
    return best?.file;
}

export function readOnlineCacheEntries(): string[] {
    try {
        return fs.readdirSync(getOnlineCacheDir());
    } catch {
        return [];
    }
}
