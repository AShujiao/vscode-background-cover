import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { extensions } from 'vscode';
import { MAX_REDIRECTS, MAX_TEXT_BYTES, parseAndValidateUrl } from './netSafety';

export class OnlineImageHelper {
    private static cachedUserAgent: string | null = null;
    /** 单次 getOnlineImages 内复用同一 URL 的正文，避免 JSON/HTML 两轮探测重复下载。 */
    private static textCache: Map<string, Promise<string>> | null = null;

    /**
     * 获取在线图片列表（混合方案）
     */
    public static async getOnlineImages(urlString: string): Promise<string[]> {
        this.textCache = new Map();
        try {
            const isImage = await this.isImageUrl(urlString);
            if (isImage) {
                console.log('[OnlineImageHelper] 检测为单张图片');
                return [urlString];
            }
            // url是否为vs.20988.xyz
            if (urlString.includes('vs.20988.xyz')) {
                const vs20988xyzImages = await this.tryParseVs20988xyz(urlString);
                if (vs20988xyzImages && vs20988xyzImages.length > 0) {
                    console.log('[OnlineImageHelper] VS20988xyz 获取成功，获取到', vs20988xyzImages.length, '张图片');
                    return vs20988xyzImages;
                }else{
                    return [];
                }
            }
            
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
            console.log('[OnlineImageHelper] 无法识别URL类型，当作单图处理');
            return [urlString];
        } catch (error: any) {
            console.error('[OnlineImageHelper] 获取在线图片失败:', error?.message || error);
            return [urlString];
        } finally {
            this.textCache = null;
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

    // 适配 VS20988xyz 论坛的图片提取
    private static async tryParseVs20988xyz(urlString: string): Promise<string[] | null> {
        try {
            const html = await this.fetchText(urlString);
            
            // 先尝试提取 Post-body 节点内的内容
            let targetContent = html;
            const postBodyRegex = /<div\s+[^>]*class=["'][^"']*Post-body[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
            let match;
            let combinedContent = '';
            let foundBody = false;
            
            while ((match = postBodyRegex.exec(html)) !== null) {
                if (match[1]) {
                    combinedContent += match[1];
                    foundBody = true;
                }
            }

            if (foundBody) {
                targetContent = combinedContent;
                console.log('[OnlineImageHelper] 找到 Post-body 节点，将在其中查询图片');
            }
            
            const patterns = [
                /<img\s+src=["']([^"']+\.(png|jpg|jpeg|gif|webp|bmp|jfif))["']/gi,
                /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi,
            ];
            const foundImages = new Set<string>();
            for (const pattern of patterns) {
                const matches = targetContent.matchAll(pattern);
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
        const cache = this.textCache;
        const hit = cache?.get(urlString);
        if (hit) { return hit; }
        const task = this.fetchTextUncached(urlString, 0);
        cache?.set(urlString, task);
        return task;
    }

    private static fetchTextUncached(urlString: string, redirectCount: number): Promise<string> {
        return new Promise((resolve, reject) => {
            let parsed: URL;
            try {
                parsed = parseAndValidateUrl(urlString);
            } catch (error) {
                reject(error);
                return;
            }
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method: 'GET',
                timeout: 10000,
                headers: {
                    'User-Agent': this.getUserAgent()
                }
            };
            const req = client.get(parsed, options, (res) => {
                const status = res.statusCode ?? 0;
                if ([301, 302, 303, 307, 308].includes(status)) {
                    res.resume();
                    const redirectUrl = res.headers.location;
                    if (!redirectUrl) {
                        reject(new Error(`Redirect response received (HTTP ${status}) but no location header was provided.`));
                        return;
                    }
                    if (redirectCount >= MAX_REDIRECTS) {
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    const nextUrl = new URL(redirectUrl, parsed).toString();
                    this.fetchTextUncached(nextUrl, redirectCount + 1).then(resolve, reject);
                    return;
                }
                if (status !== 200) {
                    res.resume();
                    reject(new Error(`HTTP ${status}`));
                    return;
                }
                const declared = Number(res.headers['content-length'] || 0);
                if (declared > MAX_TEXT_BYTES) {
                    res.destroy();
                    reject(new Error('Response too large'));
                    return;
                }
                let size = 0;
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > MAX_TEXT_BYTES) {
                        res.destroy(new Error('Response too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                res.on('error', reject);
                res.on('aborted', () => reject(new Error('Response aborted')));
                res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy(new Error('Request timeout'));
            });
        });
    }

    private static fetchHeaders(urlString: string, method: 'HEAD' | 'GET' = 'HEAD', redirectCount = 0): Promise<{ headers: http.IncomingHttpHeaders; statusCode?: number; contentType?: string; }> {
        return new Promise((resolve, reject) => {
            let parsed: URL;
            try {
                parsed = parseAndValidateUrl(urlString);
            } catch (error) {
                reject(error);
                return;
            }
            const client = parsed.protocol === 'https:' ? https : http;
            const options: https.RequestOptions = {
                method,
                timeout: method === 'HEAD' ? 5000 : 7000,
                headers: {
                    'User-Agent': this.getUserAgent(),
                    'Accept': method === 'HEAD' ? '*/*' : 'image/*,*/*;q=0.8'
                }
            };
            const req = client.request(parsed, options, (res) => {
                const status = res.statusCode ?? 0;
                if ([301, 302, 303, 307, 308].includes(status)) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        const nextUrl = new URL(redirectUrl, parsed).toString();
                        res.resume();
                        if (redirectCount >= MAX_REDIRECTS) {
                            reject(new Error('Too many redirects'));
                            return;
                        }
                        try {
                            parseAndValidateUrl(nextUrl);
                        } catch (validationError: any) {
                            reject(new Error(`Redirect URL is invalid or unsafe: ${validationError?.message || validationError}`));
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

    private static getUserAgent(): string {
        if (!this.cachedUserAgent) {
            const extension = extensions.getExtension('manasxx.background-cover');
            const version = extension?.packageJSON?.version;
            const suffix = version ? `/${version}` : '';
            this.cachedUserAgent = `VSCode-Background-Cover${suffix}`;
        }
        return this.cachedUserAgent;
    }
}
