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
                    let images: Array<string | { name?: string; url?: string; }> = [];
                    if (Array.isArray(data)) {
                        images = data;
                    } else if (Array.isArray((data as any).images)) {
                        images = (data as any).images;
                    } else if (Array.isArray((data as any).files)) {
                        images = (data as any).files;
                    }
                    const imageFiles = images
                        .map((item) => this.extractImageFromItem(item))
                        .filter((name): name is string => !!name && this.isImageFileName(name))
                        .map((name) => this.resolveImageUrl(urlString, name));
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
            const headers = await this.fetchHeaders(urlString);
            const contentType = headers['content-type'] as string | undefined;
            return !!contentType && contentType.startsWith('image/');
        } catch (error) {
            return this.isImageFileName(urlString);
        }
    }

    private static isImageFileName(filename: string): boolean {
        return /\.(png|jpg|jpeg|gif|webp|bmp|jfif)(\?.*)?$/i.test(filename);
    }

    private static extractImageFromItem(item: unknown): string | null {
        if (!item) {
            return null;
        }
        if (typeof item === 'string') {
            return item;
        }
        const obj = item as Record<string, unknown>;
        const candidates: string[] = [];
        if (typeof obj['imageUrl'] === 'string') {
            candidates.push(obj['imageUrl'] as string);
        }
        if (typeof obj['fullUrl'] === 'string') {
            candidates.push(obj['fullUrl'] as string);
        }
        if (typeof obj['url'] === 'string') {
            candidates.push(obj['url'] as string);
        }
        if (typeof obj['thumbUrl'] === 'string') {
            candidates.push(obj['thumbUrl'] as string);
        }
        if (typeof obj['src'] === 'string') {
            candidates.push(obj['src'] as string);
        }
        if (typeof obj['name'] === 'string') {
            candidates.push(obj['name'] as string);
        }
        for (const value of candidates) {
            if (this.isImageFileName(value)) {
                return value;
            }
        }
        return null;
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

    private static fetchHeaders(urlString: string): Promise<http.IncomingHttpHeaders> {
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
                method: 'HEAD',
                timeout: 5000,
                headers: {
                    'User-Agent': 'VSCode-Background-Cover/2.7.2'
                }
            };
            const req = client.request(parsed, options, (res) => {
                resolve(res.headers);
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
