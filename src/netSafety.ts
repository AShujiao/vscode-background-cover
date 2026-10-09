/*
 * 在线资源请求的通用安全约束：协议/私网地址校验、跳转次数与响应大小上限。
 * OnlineImageHelper（解析图库）和 FileDom.downloadFile（下载背景）共用。
 * 纯 Node 模块，不依赖 vscode API。
 */
import { isIP } from 'net';
import { URL } from 'url';

export const MAX_REDIRECTS = 5;
/** 文本类响应（JSON/HTML 目录页）上限。 */
export const MAX_TEXT_BYTES = 5 * 1024 * 1024;
/** 背景图片/视频下载上限。 */
export const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;

function isPrivateIPv4(ip: string): boolean {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) {
        return false;
    }
    const [a, b] = parts;
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168);
}

/** IPv4-mapped IPv6（::ffff:127.0.0.1 / ::ffff:7f00:1）→ IPv4，否则 undefined。 */
function mappedIPv4(ip: string): string | undefined {
    const m = /^(?:0{0,4}:){0,5}:?ffff:(.+)$/i.exec(ip);
    if (!m) { return undefined; }
    const tail = m[1];
    if (isIP(tail) === 4) { return tail; }
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail);
    if (!hex) { return undefined; }
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

export function isPrivateAddress(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost')) {
        return true;
    }
    const version = isIP(host);
    if (version === 4) {
        return isPrivateIPv4(host);
    }
    if (version === 6) {
        const v4 = mappedIPv4(host);
        if (v4) { return isPrivateIPv4(v4); }
        return host === '::' || host === '::1'
            || host.startsWith('fc') || host.startsWith('fd')
            || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')
            || host.startsWith('fec');
    }
    return false;
}

/** 只允许 http/https。下载用户自己配置的背景时用这个（局域网 NAS 图床是合法场景）。 */
export function parseHttpUrl(urlString: string): URL {
    const parsed = new URL(urlString);
    if (!/^https?:$/.test(parsed.protocol)) {
        throw new Error('仅支持 HTTPS 或 HTTP 协议');
    }
    if (!parsed.hostname) {
        throw new Error('URL 缺少主机');
    }
    return parsed;
}

/** 在线图库解析：额外拒绝私网/回环地址。 */
export function parseAndValidateUrl(urlString: string): URL {
    const parsed = parseHttpUrl(urlString);
    if (isPrivateAddress(parsed.hostname)) {
        throw new Error('禁止访问私有网络地址');
    }
    return parsed;
}

export const GALLERY_HOST = 'vs.20988.xyz';
export const GALLERY_ORIGIN = `https://${GALLERY_HOST}`;

export function isHttpsUrl(value: unknown): value is string {
    if (typeof value !== 'string') { return false; }
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

/** 在线图库（论坛）自身的页面地址：https + 图库域名或其子域。 */
export function isGalleryUrl(value: unknown): value is string {
    if (typeof value !== 'string') { return false; }
    try {
        const u = new URL(value);
        return u.protocol === 'https:' && (u.hostname === GALLERY_HOST || u.hostname.endsWith('.' + GALLERY_HOST));
    } catch {
        return false;
    }
}

/** 校验图库 iframe 发来的 set_img / set_home 载荷。 */
export function isValidGalleryMessage(command: unknown, data: any): boolean {
    if (!data || typeof data !== 'object') { return false; }
    // set_img 的图片可能在 CDN 上，只要求 https；帖子链接/图库首页必须是图库域名。
    if (command === 'set_home') { return isGalleryUrl(data.url); }
    if (command === 'set_img') { return isHttpsUrl(data.url) && (!data.link || isGalleryUrl(data.link)); }
    return false;
}
