import * as path from 'path';
import * as crypto from 'crypto';
import { workspace } from 'vscode';
import * as fse from 'fs-extra';
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

/**
 * 默认在线图片缓存上限（文件个数）。
 *
 * 无扩展名/动态地址的在线源（随机壁纸 API、JSON API 返回的图片等）每次下载都会
 * 生成新文件（见 FileDom.downloadAndCacheImage 的 uniqueDownload 分支），自动换图
 * 长期运行会让缓存目录无限增长。该上限把缓存文件数封顶：超出后按 mtime 从旧到新
 * 淘汰（见 pruneOnlineCache）。可在设置中调整：backgroundCover.cacheLimit。
 *
 * 这个数字在三处必须一致：package.json 的 backgroundCover.cacheLimit 默认值、
 * 这里、以及 webview/src/constants.ts 的 DEFAULT_CACHE_LIMIT（前端无法 import 本文件）。
 * scripts/test-prune-cache.js 会校验三者是否漂移。
 */
export const DEFAULT_ONLINE_CACHE_LIMIT = 200;

export function getOnlineCacheLimit(): number {
    try {
        const value = workspace.getConfiguration('backgroundCover')
            .get<number>('cacheLimit', DEFAULT_ONLINE_CACHE_LIMIT);
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? Math.floor(num) : DEFAULT_ONLINE_CACHE_LIMIT;
    } catch {
        return DEFAULT_ONLINE_CACHE_LIMIT;
    }
}

/**
 * 超限后一次清到上限的多少比例（低水位）。没有滞回时，缓存刚好停在上限会让每次换图
 * 都触发一次全目录扫描；留出余量后，扫描频率降到每 (上限 - 低水位) 次换图一次。
 */
const PRUNE_LOW_WATERMARK = 0.8;

/**
 * 单次调用最多删除的文件数。仅用于防御异常规模（例如修复前遗留了几万个文件）——
 * 正常清理一次就收敛到低水位。删除是异步 IO，不会阻塞扩展宿主线程。
 */
const PRUNE_MAX_PER_RUN = 20000;

/**
 * 孤儿临时文件的判定年龄。下载中途进程被杀会留下 `<hash>-<ts>-<n><ext>.tmp`
 * （正常路径会 unlink，只有强杀才漏），超过这个年龄就认为是废弃文件清掉；
 * 阈值远大于任何正常下载耗时，不会误删正在进行的下载。
 */
const TMP_STALE_MS = 60 * 60 * 1000;

/** 正在进行中的清理：多窗口/多入口同时触发时复用同一次扫描，避免重复删同一批文件。 */
let pruneInFlight: Promise<void> | undefined;
/** 清理期间又有新请求（例如刚把上限调小）：记下来，等这次结束后用最新上限补跑一次。 */
let rerunRequested = false;
let rerunLimit: number | undefined;

/**
 * 把在线图片缓存目录收敛到上限以内：按 mtime 从旧到新删除，保留最新的若干文件。
 * 只删文件（不递归目录）；删除失败的文件留给下次清理。
 *
 * - 静态图（有扩展名 URL）下载到 `<hash><ext>` 固定路径，覆盖写不会累积；FileDom
 *   复用缓存时会刷新它的 mtime，所以"正在用的那张"始终是最近使用，不会被误删。
 * - 动态/无扩展名源每次换图都会新增 `<hash>-<timestamp><ext>`，超出上限后按最近
 *   使用时间淘汰最旧的——刚下载的当前背景一定是最近一次写入，不会被误删。
 * - 顺带清理超过 TMP_STALE_MS 的孤儿 .tmp 文件（它们不计入上限，但要单独收敛）。
 *
 * 一次调用会一直删到低水位（删除是异步 IO，不会阻塞主线程），单次总量上限只用于
 * 防御异常规模（见 PRUNE_MAX_PER_RUN）。并发调用复用同一次执行。
 */
export function pruneOnlineCache(maxFiles?: number): Promise<void> {
    if (pruneInFlight) {
        // 已有清理在跑：不重复扫描目录，等它结束后用这次请求的上限补跑一次
        rerunRequested = true;
        rerunLimit = maxFiles;
        return pruneInFlight;
    }

    const run = (async () => {
        let limit = maxFiles;
        do {
            rerunRequested = false;
            rerunLimit = undefined;
            try {
                await runPrune(limit);
            } catch (error) {
                // 清理是尽力而为的后台任务：一次异常不该影响背景应用（调用方是 void）
                console.warn('[BackgroundCover] Failed to prune online cache:', error);
                break;
            }
            // 清理期间又收到请求（例如刚把上限调小）：用最新请求的上限再跑一次
            limit = rerunLimit;
        } while (rerunRequested);
    })().finally(() => {
        pruneInFlight = undefined;
    });

    pruneInFlight = run;
    return run;
}

async function runPrune(maxFiles?: number): Promise<void> {
    const limit = maxFiles ?? getOnlineCacheLimit();
    if (!Number.isFinite(limit) || limit <= 0) {
        return;
    }

    const dir = getOnlineCacheDir();
    let names: string[];
    try {
        names = await fse.readdir(dir);
    } catch {
        return; // 目录不存在或无权限：直接返回，不清理
    }

    const hasTmp = names.some(name => name.endsWith('.tmp'));
    // 便宜的前置判断：没有临时文件、条目数也没到上限时，不必逐个 stat
    if (!hasTmp && names.length <= limit) {
        return;
    }

    // 收集 (文件路径, mtime)；.tmp 与正式文件分开统计，跳过子目录
    const entries: { file: string; mtime: number }[] = [];
    const tmpEntries: { file: string; mtime: number }[] = [];
    for (const name of names) {
        const full = path.join(dir, name);
        try {
            const stat = await fse.stat(full);
            if (!stat.isFile()) {
                continue;
            }
            if (name.endsWith('.tmp')) {
                tmpEntries.push({ file: full, mtime: stat.mtimeMs });
            } else {
                entries.push({ file: full, mtime: stat.mtimeMs });
            }
        } catch {
            // 文件可能刚被删除或已被占用，跳过
        }
    }

    let removed = 0;

    // 1) 孤儿临时文件
    const now = Date.now();
    for (const tmpEntry of tmpEntries) {
        if (now - tmpEntry.mtime < TMP_STALE_MS) {
            continue;
        }
        removed += await removeQuietly(tmpEntry.file);
    }

    // 2) 正式缓存文件按上限收敛（names 里的非文件/临时文件不计入）
    if (entries.length > limit) {
        entries.sort((a, b) => a.mtime - b.mtime);
        // 清到低水位而不是刚好等于上限，避免之后每次换图都再扫一遍目录
        const target = Math.max(1, Math.floor(limit * PRUNE_LOW_WATERMARK));
        const overflow = entries.length - target;
        if (overflow > PRUNE_MAX_PER_RUN) {
            // 只在异常规模下出现：本次清一部分，剩余的等下次下载/启动继续清
            console.warn(`[BackgroundCover] Online cache holds ${entries.length} files (limit ${limit}); removing ${PRUNE_MAX_PER_RUN} this run, the rest continues later.`);
        }
        for (const victim of entries.slice(0, Math.min(overflow, PRUNE_MAX_PER_RUN))) {
            removed += await removeQuietly(victim.file);
        }
    }

    if (removed > 0) {
        // 仅当确实删掉文件时才留痕，避免每 10 秒打一条日志刷屏
        console.log(`[BackgroundCover] Pruned ${removed} stale cache file(s) (limit ${limit}, dir ${dir})`);
    }
}

/** 删除单个文件，返回删掉的数量（0 表示失败/被占用）。 */
async function removeQuietly(file: string): Promise<number> {
    try {
        await fse.remove(file);
        return 1;
    } catch {
        // 文件被占用（当前背景正被窗口引用）或删除失败：跳过，留给下次清理
        return 0;
    }
}

export function isOnlineUrl(value: string): boolean {
    return /^https?:\/\//i.test(value || '');
}

/**
 * 在缓存目录中查找某个在线地址已下载的本地文件。
 *
 * 命名有三种形态(见 FileDom.downloadAndCacheImage)：带扩展名的静态图为
 * `<hash><ext>`；无扩展名/动态地址为 `<hash>-<内容哈希><ext>`（按内容去重），
 * 早期版本为 `<hash>-<时间戳><ext>`（老缓存文件，前缀匹配同样能命中）。
 * 同一前缀下取 mtime 最新的一个。
 *
 * `entries` 可传入调用方已经读过的目录列表，避免批量转换时反复 readdir。
 */
export function findCachedOnlineImage(url: string, entries?: string[]): string | undefined {
    if (!isOnlineUrl(url)) { return undefined; }

    const dir = getOnlineCacheDir();
    let names = entries;
    if (!names) {
        try {
            names = fse.readdirSync(dir);
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
            const stat = fse.statSync(full);
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
        return fse.readdirSync(getOnlineCacheDir());
    } catch {
        return [];
    }
}
