import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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
            const parsed = new URL(urlString);
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': 'VSCode-Background-Cover/2.7.1'
                }
            };
            const req = client.get(urlString, options, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        return this.fetchText(redirectUrl).then(resolve).catch(reject);
                    }
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
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
            const parsed = new URL(urlString);
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method: 'HEAD',
                timeout: 5000,
                headers: {
                    'User-Agent': 'VSCode-Background-Cover/2.7.1'
                }
            };
            const req = client.request(urlString, options, (res) => {
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
