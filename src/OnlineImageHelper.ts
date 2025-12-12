import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { isIP } from 'net';

export class OnlineImageHelper {
    /**
     * 获取在线图片列表（混合方案）
     */
    public static async getOnlineImages(urlString: string): Promise<string[]> {
        try {
            const apiImages = await this.tryJsonApi(urlString);
            if (apiImages && apiImages.length > 0) {
                console.log('[OnlineImageHelper] JSON API 成功，获取到', apiImages.length, '张图片');
                return apiImages;
            }

            const htmlImages = await this.tryParseDirectory(urlString);
            if (htmlImages && htmlImages.length > 0) {
                console.log('[OnlineImageHelper] HTML 解析成功，获取到', htmlImages.length, '张图片');
                return htmlImages;
            }

            const isImage = await this.isImageUrl(urlString);
            if (isImage) {
                console.log('[OnlineImageHelper] 检测为单张图片');
                return [urlString];
            }

            console.log('[OnlineImageHelper] 无法识别URL类型，当作单图处理');
            return [urlString];
        } catch (error: any) {
            console.error('[OnlineImageHelper] 获取在线图片失败:', error?.message || error);
            return [urlString];
        }
    }

    private static async tryJsonApi(urlString: string): Promise<string[] | null> {
        try {
            const apiUrls = [
                urlString,
                `${urlString}?format=json`,
                `${urlString}?list=json`,
                `${urlString.replace(/\/$/, '')}.json`,
            ];
            for (const apiUrl of apiUrls) {
                try {
                    const data = await this.fetchJson(apiUrl);
                    const imageFiles = this.collectImagesFromApiData(data, urlString);
                    if (imageFiles.length > 0) {
                        return imageFiles;
                    }
                } catch (err) {
                    continue;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    private static async tryParseDirectory(urlString: string): Promise<string[] | null> {
        try {
            const html = await this.fetchText(urlString);
            const patterns = [
                /<a\s+href=["']([^"']+\.(png|jpg|jpeg|gif|webp|bmp|jfif))["']/gi,
                /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi,
            ];
            const foundImages = new Set<string>();
            for (const pattern of patterns) {
                const matches = html.matchAll(pattern);
                for (const match of matches) {
                    const imagePath = match[1];
                    if (this.isImageFileName(imagePath)) {
                        const fullUrl = this.resolveImageUrl(urlString, imagePath);
                        foundImages.add(fullUrl);
                    }
                }
            }
            return foundImages.size > 0 ? Array.from(foundImages) : null;
        } catch (error) {
            return null;
        }
    }

    private static async isImageUrl(urlString: string): Promise<boolean> {
        try {
            const headInfo = await this.fetchHeaders(urlString, 'HEAD');
            const headType = headInfo.contentType?.toLowerCase();
            if (headType && headType.startsWith('image/')) {
                return true;
            }
        } catch (error) {
            // ignore and fall back to GET probing below
        }
        try {
            const getInfo = await this.fetchHeaders(urlString, 'GET');
            const getType = getInfo.contentType?.toLowerCase();
            if (getType && getType.startsWith('image/')) {
                return true;
            }
        } catch (error) {
            // ignore
        }
        return this.isImageFileName(urlString);
    }

    private static isImageFileName(filename: string): boolean {
        return /\.(png|jpg|jpeg|gif|webp|bmp|jfif)(\?.*)?$/i.test(filename);
    }

    private static extractImageFromValue(value: unknown, depth = 0): string | null {
        if (value === null || value === undefined) {
            return null;
        }
        if (depth > 4) {
            return null;
        }
        if (typeof value === 'string') {
            return this.isImageFileName(value) ? value : null;
        }
        if (Array.isArray(value)) {
            for (const entry of value) {
                const nested = this.extractImageFromValue(entry, depth + 1);
                if (nested) {
                    return nested;
                }
            }
            return null;
        }
        if (typeof value === 'object') {
            const record = value as Record<string, unknown>;
            const prioritizedKeys = ['imageUrl', 'fullUrl', 'url', 'thumbUrl', 'src', 'original', 'name', 'path'];
            for (const key of prioritizedKeys) {
                if (key in record) {
                    const nested = this.extractImageFromValue(record[key], depth + 1);
                    if (nested) {
                        return nested;
                    }
                }
            }
            for (const entry of Object.values(record)) {
                const nested = this.extractImageFromValue(entry, depth + 1);
                if (nested) {
                    return nested;
                }
            }
        }
        return null;
    }

    private static collectImagesFromApiData(data: unknown, baseUrl: string): string[] {
        const found = new Set<string>();
        const traverse = (value: unknown, depth = 0) => {
            if (value === null || value === undefined || depth > 6) {
                return;
            }
            if (typeof value === 'string') {
                if (this.isImageFileName(value)) {
                    found.add(this.resolveImageUrl(baseUrl, value));
                }
                return;
            }
            if (Array.isArray(value)) {
                for (const entry of value) {
                    traverse(entry, depth + 1);
                }
                return;
            }
            if (typeof value === 'object') {
                const record = value as Record<string, unknown>;
                if (record && typeof record['ext'] === 'string' && record['pid'] && record['uid'] && record['urls']) {
                    const urlCandidate = this.extractImageFromValue(record['urls'], depth + 1);
                    if (urlCandidate) {
                        found.add(this.resolveImageUrl(baseUrl, urlCandidate));
                    }
                }
                const prioritizedKeys = ['images', 'files', 'data', 'results', 'items', 'list'];
                for (const key of prioritizedKeys) {
                    if (Array.isArray(record[key])) {
                        traverse(record[key], depth + 1);
                    }
                }
                for (const entry of Object.values(record)) {
                    traverse(entry, depth + 1);
                }
            }
        };
        traverse(data);
        return Array.from(found);
    }

    private static resolveImageUrl(baseUrl: string, imagePath: string): string {
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        imagePath = imagePath.replace(/^\.\//, '');
        if (imagePath.startsWith('/')) {
            const parsed = new URL(baseUrl);
            return `${parsed.protocol}//${parsed.host}${imagePath}`;
        }
        return base + imagePath;
    }

    private static async fetchJson(urlString: string): Promise<unknown> {
        const text = await this.fetchText(urlString);
        return JSON.parse(text);
    }

    private static fetchText(urlString: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let parsed: URL;
            try {
                parsed = this.parseAndValidateUrl(urlString);
            } catch (error) {
                reject(error);
                return;
            }
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'VSCode-Background-Cover/2.7.2'
                }
            };
            const req = client.get(parsed, options, (res) => {
                const status = res.statusCode ?? 0;
                if ([301, 302, 307, 308].includes(status)) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        const nextUrl = new URL(redirectUrl, parsed).toString();
                        this.fetchText(nextUrl).then(resolve).catch(reject);
                        return;
                    }
                    res.resume();
                    reject(new Error(`Redirect response received (HTTP ${status}) but no location header was provided.`));
                    return;
                }
                if (status !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${status}`));
                    return;
                }
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    private static fetchHeaders(urlString: string, method: 'HEAD' | 'GET' = 'HEAD', redirectCount = 0): Promise<{ headers: http.IncomingHttpHeaders; statusCode?: number; contentType?: string; }> {
        return new Promise((resolve, reject) => {
            let parsed: URL;
            try {
                parsed = this.parseAndValidateUrl(urlString);
            } catch (error) {
                reject(error);
                return;
            }
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method,
                timeout: method === 'HEAD' ? 5000 : 7000,
                headers: {
                    'User-Agent': 'VSCode-Background-Cover/2.7.2',
                    'Accept': method === 'HEAD' ? '*/*' : 'image/*,*/*;q=0.8'
                }
            };
            const req = client.request(parsed, options, (res) => {
                const status = res.statusCode ?? 0;
                if ([301, 302, 307, 308].includes(status)) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        const nextUrl = new URL(redirectUrl, parsed).toString();
                        res.resume();
                        if (redirectCount >= 5) {
                            reject(new Error('Too many redirects'));
                            return;
                        }
                        this.fetchHeaders(nextUrl, method, redirectCount + 1).then(resolve).catch(reject);
                        return;
                    }
                }
                const contentType = (res.headers['content-type'] as string | undefined) ?? undefined;
                resolve({ headers: res.headers, statusCode: res.statusCode, contentType });
                if (method === 'GET') {
                    res.destroy();
                } else {
                    res.resume();
                }
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.end();
        });
    }

    private static parseAndValidateUrl(urlString: string): URL {
        const parsed = new URL(urlString);
        if (!/^https?:$/.test(parsed.protocol)) {
            throw new Error('仅支持 HTTPS 或 HTTP 协议');
        }
        if (!parsed.hostname) {
            throw new Error('URL 缺少主机');
        }
        if (this.isPrivateAddress(parsed.hostname)) {
            throw new Error('禁止访问私有网络地址');
        }
        return parsed;
    }

    private static isPrivateAddress(hostname: string): boolean {
        const lower = hostname.toLowerCase();
        if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') {
            return true;
        }
        const ipVersion = isIP(hostname);
        if (ipVersion === 4) {
            const parts = hostname.split('.').map((segment) => Number(segment));
            if (parts.length === 4 && parts.every((part) => !Number.isNaN(part))) {
                const [first, second] = parts;
                if (first === 10) {
                    return true;
                }
                if (first === 127) {
                    return true;
                }
                if (first === 169 && second === 254) {
                    return true;
                }
                if (first === 172 && second >= 16 && second <= 31) {
                    return true;
                }
                if (first === 192 && second === 168) {
                    return true;
                }
                if (first === 0) {
                    return true;
                }
            }
        }
        if (ipVersion === 6) {
            if (lower === '::1') {
                return true;
            }
            if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('fec0')) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检测URL类型（用于调试）
     */
    public static async detectUrlType(urlString: string): Promise<{ type: string; url?: string; images?: string[]; error?: string }> {
        try {
            const images = await this.getOnlineImages(urlString);
            if (images.length === 1 && images[0] === urlString) {
                return { type: 'image', url: urlString };
            }
            return { type: 'folder', images };
        } catch (error: any) {
            return { type: 'unknown', error: error.message };
        }
    }
}
