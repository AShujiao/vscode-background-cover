import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { env, Uri, window, WorkspaceConfiguration, UIKind } from 'vscode';
import * as lockfile from 'proper-lockfile';
import version from './version';
import { SudoPromptHelper } from './SudoPromptHelper';
import * as fse from 'fs-extra';
import { getContext } from './global';
import { getParticleEffectJs } from './ParticleEffect';

interface WorkbenchTarget {
    name: string;
    root: string;
    js: string;
    css: string;
    bak: string;
}
/**
 * 文件路径配置，支持服务器模式
 */
const WORKBENCH_TARGETS: WorkbenchTarget[] = [
    {
        name: 'desktop', // vscode目录
        root: path.join(env.appRoot, "out", "vs", "workbench"), // 需要hook的文件目录
        js: 'workbench.desktop.main.js', // 需要hook的css文件名
        css: 'workbench.desktop.main.css', // 需要hook的js文件名
        bak: 'workbench.desktop.main.js.bak' // 备份文件名
    },
    {
        name: 'code-server',
        root: path.join(env.appRoot, "out", "vs", "code", "browser", "workbench"),
        js: 'workbench.js',
        css: 'workbench.css',
        bak: 'workbench.js.bak'
    }
];

// 选择当前运行环境对应的文件路径
function getWorkbenchTarget(): WorkbenchTarget {
    const preferredHost = determineHostPreference();

    const pickByName = (name: string): WorkbenchTarget | undefined => {
        return WORKBENCH_TARGETS.find((target) => target.name === name && fs.existsSync(path.join(target.root, target.js)));
    };

    if (preferredHost === 'desktop') {
        const desktopTarget = pickByName('desktop');
        if (desktopTarget) {
            return desktopTarget;
        }
    }

    if (preferredHost === 'code-server') {
        const webTarget = pickByName('code-server');
        if (webTarget) {
            return webTarget;
        }
    }

    return pickByName('desktop') || pickByName('code-server') || WORKBENCH_TARGETS[0];
}

function determineHostPreference(): 'desktop' | 'code-server' | undefined {
    const appHost = typeof env.appHost === 'string' ? env.appHost.toLowerCase() : undefined;
    if (appHost === 'desktop') {
        return 'desktop';
    }
    if (appHost === 'web') {
        return 'code-server';
    }

    if (env.uiKind === UIKind.Desktop) {
        return 'desktop';
    }
    if (env.uiKind === UIKind.Web) {
        return 'code-server';
    }

    const appName = (env.appName || '').toLowerCase();
    if (appName.includes('code-server') || appName.includes('vscode server')) {
        return 'code-server';
    }

    return undefined;
}

// 各路径静态变量
const selectedWorkbench = getWorkbenchTarget();
const JS_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.js);
const CSS_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.css);
const BAK_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.bak);
const CUSTOM_CSS_FILE_NAME = 'css-background-cover.css';
export const CUSTOM_CSS_FILE_PATH = path.join(selectedWorkbench.root, CUSTOM_CSS_FILE_NAME);
const APP_OUT_PATH = path.join(env.appRoot, 'out');
const IS_CODE_SERVER_TARGET = selectedWorkbench.name === 'code-server';
const WEB_RELATIVE_CSS_PATH = IS_CODE_SERVER_TARGET ? getWebRelativePath(CUSTOM_CSS_FILE_PATH) : undefined;
const CUSTOM_ASSET_DIR = path.join(selectedWorkbench.root, 'background-cover-assets');
const RELATIVE_URL_PLACEHOLDER = '__BACKGROUND_COVER_BASE__';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const DEFAULT_ACCEPT_HEADER = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';

function getWebRelativePath(filePath: string): string | undefined {
    try {
        const relativePath = path.relative(APP_OUT_PATH, filePath);
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return undefined;
        }
        return relativePath.split(path.sep).join('/');
    } catch (error) {
        console.warn(`[FileDom] Failed to compute web path for ${filePath}:`, error);
        return undefined;
    }
}

enum SystemType {
    WINDOWS = 'Windows_NT',
    MACOS = 'Darwin',
    LINUX = 'Linux'
}

export class FileDom {
    private readonly filePath: string;
    private readonly extName = "backgroundCover";
    private imagePath: string;
    private readonly imageOpacity: number;
    private readonly sizeModel: string;
    private readonly blur: number;
    private readonly blendModel: string;
    private readonly systemType: string;
    private readonly forceHttpsUpgrade: boolean;
    private upCssContent: string = '';
    private bakStatus: boolean = false;
    private bakJsContent: string = '';
    private workConfig: WorkspaceConfiguration;
    private initializePromise?: Promise<void>;
    private isVideo: boolean = false;

    constructor(
        workConfig: WorkspaceConfiguration,
        imagePath: string,
        opacity: number,
        sizeModel: string = 'cover',
        blur: number = 0,
        blendModel: string = ''
    ) {
        this.workConfig = workConfig;
        this.filePath = JS_FILE_PATH;
        this.imagePath = imagePath;
        this.imageOpacity = Math.min(opacity, 0.8);
        this.sizeModel = sizeModel || "cover";
        this.blur = blur;
        this.blendModel = blendModel || this.workConfig.get('blendModel', '');
        this.systemType = os.type();
        this.forceHttpsUpgrade = this.workConfig.get('forceHttpsUpgrade', true);
        
        this.initializePromise = this.initializeImage().catch((error: unknown) => {
            console.error('[FileDom] Failed to preprocess image:', error);
            throw error;
        });
    }

    // 检测是否为视频文件
    private checkIsVideo(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ['.mp4', '.webm', '.ogg', '.mov'].includes(ext);
    }

    // 本地图片转换为vscode可访问路径
    private async initializeImage(): Promise<void> {
        let lowerPath = this.imagePath.toLowerCase();

        if (lowerPath.startsWith('http://') || lowerPath.startsWith('https://')) {
            await this.downloadAndCacheImage();
            lowerPath = this.imagePath.toLowerCase();
        }

        this.isVideo = this.checkIsVideo(this.imagePath);

        if (
            !lowerPath.startsWith('http://') &&
            !lowerPath.startsWith('https://') &&
            !lowerPath.startsWith('data:')
        ) {
            try {
                if (IS_CODE_SERVER_TARGET) {
                    const assetUrl = await this.prepareCodeServerAsset(this.imagePath);
                    if (assetUrl) {
                        this.imagePath = assetUrl;
                    } else if (!this.isVideo) {
                        await this.imageToBase64();
                    } else {
                        this.localImgToVsc();
                    }
                } else {
                    this.localImgToVsc();
                }
            } catch (e) {
                if (!this.isVideo) {
                    await this.imageToBase64();
                } else {
                    this.localImgToVsc();
                }
            }
        }
    }

    // 将在线图片下载并缓存到本地
    private async downloadAndCacheImage(): Promise<void> {
        try {
            const context = getContext();
            const cacheDir = path.join(context.globalStorageUri.fsPath, 'images');
            await fse.ensureDir(cacheDir);

            const urlHash = crypto.createHash('md5').update(this.imagePath).digest('hex');
            let ext = '.jpg';
            let isStaticImage = false;
            let uniqueDownload = false;

            try {
                const urlObj = new URL(this.imagePath);
                const detectedExt = path.extname(urlObj.pathname);
                if (!detectedExt) {
                    uniqueDownload = true;
                } else {
                    ext = detectedExt;
                    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.mp4', '.webm', '.ogg', '.mov'].includes(ext.toLowerCase())) {
                        isStaticImage = true;
                    } else {
                        uniqueDownload = true;
                    }
                }
            } catch {
                uniqueDownload = true;
            }
            
            const cachePath = path.join(cacheDir, `${urlHash}${ext}`);

            if (isStaticImage && !uniqueDownload && await fse.pathExists(cachePath)) {
                this.imagePath = cachePath;
                return;
            }

            const timestamp = Date.now();
            const tempPath = path.join(cacheDir, `${urlHash}-${timestamp}${ext}.tmp`);

            try {
                const { contentType } = await this.downloadFile(this.imagePath, tempPath);
                let finalExt = ext;
                if ((!ext || ext === '.img' || uniqueDownload) && contentType) {
                    finalExt = this.getExtensionFromContentType(contentType) || finalExt;
                }

                const targetPath = (!uniqueDownload && isStaticImage)
                    ? cachePath
                    : path.join(cacheDir, `${urlHash}-${timestamp}${finalExt || '.img'}`);

                await fse.move(tempPath, targetPath, { overwrite: true });
                this.imagePath = targetPath;
            } catch (error) {
                if (await fse.pathExists(cachePath)) {
                    this.imagePath = cachePath;
                    console.warn('[FileDom] Download failed, using cached image:', error);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('[FileDom] Failed to download image:', error);
            throw error;
        }
    }

    // 下载文件
    private downloadFile(url: string, dest: string, redirectCount = 0): Promise<{ contentType?: string }> {
        return new Promise((resolve, reject) => {
            let urlObj: URL;
            try {
                urlObj = new URL(url);
            } catch (error) {
                reject(error);
                return;
            }

            const headers = {
                'User-Agent': DEFAULT_USER_AGENT,
                'Accept': DEFAULT_ACCEPT_HEADER,
                'Referer': `${urlObj.protocol}//${urlObj.host}/`,
            } as Record<string, string>;

            const protocolHandler = urlObj.protocol === 'https:' ? https : http;
            const request = protocolHandler.request(urlObj, { method: 'GET', headers }, (response) => {
                const statusCode = response.statusCode ?? 0;

                if ([301, 302, 303, 307, 308].includes(statusCode)) {
                    const location = response.headers.location;
                    if (!location) {
                        response.resume();
                        reject(new Error(`Failed to download: ${statusCode}`));
                        return;
                    }
                    if (redirectCount > 5) {
                        response.resume();
                        reject(new Error('Too many redirects'));
                        return;
                    }
                    const nextUrl = new URL(location, urlObj).toString();
                    response.resume();
                    this.downloadFile(nextUrl, dest, redirectCount + 1).then(resolve).catch(reject);
                    return;
                }

                if (statusCode !== 200) {
                    response.resume();
                    reject(new Error(`Failed to download: ${statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(dest);
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({ contentType: response.headers['content-type'] as string | undefined });
                });
                file.on('error', (err) => {
                    fs.unlink(dest, () => reject(err));
                });
            });

            request.on('timeout', () => {
                request.destroy(new Error('Request timeout'));
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.setTimeout(15000);
            request.end();
        });
    }

    //应用补丁安装
    public async install(): Promise<boolean> {
        if (!(await this.checkFileExists())) {
            return false;
        }

        await this.handleLegacyCleanup();
        await this.ensureBackup();

        return await this.applyPatch();
    }

    // 检查文件是否存在
    private async checkFileExists(): Promise<boolean> {
        const isExist = await fse.pathExists(this.filePath);
        if (!isExist) {
            await window.showErrorMessage(`文件不存在，提醒开发者修复吧！`);
            return false;
        }
        return true;
    }

    // 旧版本清理
    private async handleLegacyCleanup(): Promise<void> {
        const vsContext = getContext();
        const clearCssNum = Number(vsContext.globalState.get('ext_backgroundCover_clear_v2')) || 0;

        if (clearCssNum <= 5) {
            const cssContent = await this.getContent(CSS_FILE_PATH);
            if (this.getPatchContent(cssContent)) {
                this.upCssContent = this.clearCssContent(cssContent);
            } else {
                vsContext.globalState.update('ext_backgroundCover_clear_v2', clearCssNum + 1);
            }
        }
    }

    // 是否存在备份文件
    private async ensureBackup(): Promise<void> {
        const bakExist = await fse.pathExists(BAK_FILE_PATH);
        if (!bakExist) {
            this.bakStatus = true;
            window.setStatusBarMessage(`首次使用正在获取权限及备份文件，处理中... / First use is getting permission and backing up files, processing...`, 10000);
        }
    }

    // 应用补丁
    private async applyPatch(): Promise<boolean> {
        const lockPath = path.join(os.tmpdir(), 'vscode-background.lock');
        let release: (() => Promise<void>) | undefined;

        try {
            if (!(await fse.pathExists(lockPath))) {
                await fse.writeFile(lockPath, '', 'utf-8');
            }

            release = await lockfile.lock(lockPath, {
                retries: {
                    retries: 10,
                    minTimeout: 100,
                    maxTimeout: 1000,
                    randomize: true
                },
                stale: 20000
            });

            if (this.initializePromise) {
                await this.initializePromise;
                this.initializePromise = undefined;
            }

            // Save CSS first
            try {
                await this.saveCssContent();
            } catch (e) {
                window.showErrorMessage('Failed to write CSS file: ' + e);
                return false;
            }

            const content = this.getJs().trim();
            if (!content) return false;

            const currentContent = await this.getContent(this.filePath);
            
            // Check if we need to update JS
            const match = currentContent.match(new RegExp(`\\/\\*ext-${this.extName}-start\\*\\/([\\s\\S]*?)\\/\\*ext-${this.extName}-end\\*\\/`));
            if (match && match[0].trim() === content.trim()) {
                this.requiresReload = false;
                return true;
            }

            this.requiresReload = true;
            const bakContent = this.clearCssContent(currentContent);
            
            if (this.bakStatus) {
                this.bakJsContent = bakContent;
            }

            const newContent = bakContent + content;
            return await this.saveContent(newContent);

        } catch (error: any) {
            await window.showErrorMessage(`Installation failed: ${error.message}`);
            return false;
        } finally {
            if (release) {
                try {
                    await release();
                } catch (err) {
                    console.error(`Failed to unlock ${lockPath}:`, err);
                }
            }
        }
    }

    // 获取文件权限
    public async getFilePermission(filePath: string): Promise<void> {
        try {
            if (!(await fse.pathExists(filePath))) {
                if (this.systemType === SystemType.WINDOWS) {
                    await SudoPromptHelper.exec(`echo. > "${filePath}"`);
                } else {
                    await SudoPromptHelper.exec(`touch "${filePath}"`);
                }
            }
            switch (this.systemType) {
                case SystemType.WINDOWS:
                    await SudoPromptHelper.exec(`takeown /f "${filePath}" /a`);
                    await SudoPromptHelper.exec(`icacls "${filePath}" /grant Users:F`);
                    break;
                case SystemType.MACOS:
                    await SudoPromptHelper.exec(`chmod a+rwx "${filePath}"`);
                    break;
                case SystemType.LINUX:
                    await SudoPromptHelper.exec(`chmod 666 "${filePath}"`);
                    break;
            }
        } catch (error) {
            console.error(`Failed to get permission for ${filePath}:`, error);
            throw error;
        }
    }

    // 清理补丁内容
    public async uninstall(): Promise<boolean> {
        try {
            const content = this.clearCssContent(await this.getContent(this.filePath));
            await this.saveContent(content);
            
            // Remove CSS file
            if (await fse.pathExists(CUSTOM_CSS_FILE_PATH)) {
                try {
                    await fse.remove(CUSTOM_CSS_FILE_PATH);
                } catch {
                    if (this.systemType === SystemType.WINDOWS) {
                        await SudoPromptHelper.exec(`del "${CUSTOM_CSS_FILE_PATH}"`);
                    } else {
                        await SudoPromptHelper.exec(`rm "${CUSTOM_CSS_FILE_PATH}"`);
                    }
                }
            }

            return true;
        } catch (error) {
            await window.showErrorMessage(`卸载失败: ${error}`);
            return false;
        }
    }

    // 清除背景
    public async clearBackground(): Promise<boolean> {
        try {
            await this.writeWithPermission(CUSTOM_CSS_FILE_PATH, '');
            this.requiresReload = false;
            return true;
        } catch (error) {
            await window.showErrorMessage(`清除背景失败: ${error}`);
            return false;
        }
    }

    // 读取原文件内容
    private async getContent(filePath: string): Promise<string> {
        return await fse.readFile(filePath, 'utf-8');
    }

    // 写入文件内容
    private async saveContent(content: string): Promise<boolean> {
        if (this.bakStatus) {
            await this.bakFile();
        }

        await this.writeWithPermission(this.filePath, content);

        if (this.upCssContent) {
            await this.writeWithPermission(CSS_FILE_PATH, this.upCssContent);
            this.upCssContent = '';
        }

        return true;
    }

    // 写入文件内容，带权限处理
    private async writeWithPermission(filePath: string, content: string): Promise<void> {
        try {
            await fse.writeFile(filePath, content, { encoding: 'utf-8' });
        } catch (err) {
            await this.getFilePermission(filePath);
            await fse.writeFile(filePath, content, { encoding: 'utf-8' });
        }
    }

    // 写入备份文件
    private async bakFile(): Promise<void> {
        try {
            await fse.writeFile(BAK_FILE_PATH, this.bakJsContent, { encoding: 'utf-8' });
        } catch (err) {
            await this.createAndWriteBakFile();
        }
    }

    // 创建并写入备份文件
    private async createAndWriteBakFile(): Promise<void> {
        if (this.systemType === SystemType.WINDOWS) {
            await SudoPromptHelper.exec(`echo. > "${BAK_FILE_PATH}"`);
            await SudoPromptHelper.exec(`icacls "${BAK_FILE_PATH}" /grant Users:F`);
        } else {
            await SudoPromptHelper.exec(`touch "${BAK_FILE_PATH}"`);
            const chmodCmd = this.systemType === SystemType.MACOS ? 'chmod a+rwx' : 'chmod 666';
            await SudoPromptHelper.exec(`${chmodCmd} "${BAK_FILE_PATH}"`);
        }
        await fse.writeFile(BAK_FILE_PATH, this.bakJsContent, { encoding: 'utf-8' });
    }

    public requiresReload: boolean = true;

    // 写入css内容
    private async saveCssContent(): Promise<void> {
        const css = this.getCss();
        await this.writeWithPermission(CUSTOM_CSS_FILE_PATH, css);
    }

    // 获取要应用的js内容
    private getJs(): string {
        const particleJs = this.getParticleJs();

        return `
        /*ext-${this.extName}-start*/
        /*ext.${this.extName}.ver.${version}*/
        ${this.getLoaderJs()}
        ${particleJs}
        /*ext-${this.extName}-end*/
        `;
    }

    // 获取粒子效果js
    private getParticleJs(): string {
        const context = getContext();
        if (!context.globalState.get('backgroundCoverParticleEffect', false)) {
            return '';
        }

        const opacity = context.globalState.get('backgroundCoverParticleOpacity', 0.6);
        const color = context.globalState.get('backgroundCoverParticleColor', '#ffffff');
        const count = context.globalState.get('backgroundCoverParticleCount', 50);

        return getParticleEffectJs(opacity, color, count);
    }

    // 获取css内容
    private getCss(): string {
        const opacity = Math.min(this.imageOpacity, 0.8);
        const { sizeModelVal, repeatVal, positionVal } = this.getCssStyles();

        let rawPath = this.imagePath;
        const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        
        if (this.forceHttpsUpgrade && rawPath.toLowerCase().startsWith('http://')) {
            if (globalWindow?.location?.protocol === 'https:') {
                rawPath = rawPath.replace(/^http:\/\//i, 'https://');
            }
        }

        let cssPath = this.escapeTemplateLiteral(rawPath);

        if (this.isVideo) {
            const config = {
                url: rawPath,
                opacity: opacity,
                blur: this.blur,
                blendMode: this.blendModel
            };
            // Escape backticks and ${} for template literal safety, but keep backslashes as is (JSON stringified)
            const jsonConfig = JSON.stringify(config)
                .replace(/`/g, '\\`')
                .replace(/\$\{/g, '\\${');

            return `
            /*background-cover-video-start*/
            ${jsonConfig}
            /*background-cover-video-end*/
            ${this.getCorruptionWarningCss()}
            `;
        }

        return `
        body::before{
            content: "";
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            position: absolute;
            background-size: ${sizeModelVal};
            background-repeat: ${repeatVal};
            background-position: ${positionVal};
            opacity:${opacity};
            background-image:url('${cssPath}');
            z-index: 2;
            pointer-events: none;
            filter: blur(${this.blur}px);
            mix-blend-mode: ${this.blendModel};
        }
        ${this.getCorruptionWarningCss()}
        `;
    }

    // 获取宠物配置
    private getPetConfig(): { enabled: boolean, walkUrl: string, idleUrl: string } {
        try {
            const context = getContext();
            let enabled = true;
            let type = 'akita';

            if (context) {
                enabled = context.globalState.get<boolean>('backgroundCoverPetEnabled', true);
                type = context.globalState.get<string>('backgroundCoverPetType', 'akita');
            }

            const mapping: any = {
                'akita': { folder: 'dog', idle: 'akita_idle_8fps.gif', walk: 'akita_walk_8fps.gif' },
                'totoro': { folder: 'totoro', idle: 'gray_idle_8fps.gif', walk: 'gray_walk_8fps.gif' },
                'fox': { folder: 'fox', idle: 'red_idle_8fps.gif', walk: 'red_walk_8fps.gif' },
                'clippy': { folder: 'clippy', idle: 'black_idle_8fps.gif', walk: 'brown_walk_8fps.gif' },
                'rubber-duck': { folder: 'rubber-duck', idle: 'yellow_idle_8fps.gif', walk: 'yellow_walk_8fps.gif' },
                'crab': { folder: 'crab', idle: 'red_idle_8fps.gif', walk: 'red_walk_8fps.gif' },
                'zappy': { folder: 'zappy', idle: 'yellow_idle_8fps.gif', walk: 'yellow_walk_8fps.gif' },
                'mod': { folder: 'mod', idle: 'purple_idle_8fps.gif', walk: 'purple_walk_8fps.gif' },
                'cockatiel': { folder: 'cockatiel', idle: 'brown_idle_8fps.gif', walk: 'brown_walk_8fps.gif' },
                'snake': { folder: 'snake', idle: 'green_idle_8fps.gif', walk: 'green_walk_8fps.gif' },
                'chicken': { folder: 'chicken', idle: 'white_idle_8fps.gif', walk: 'white_walk_8fps.gif' },
                'rat': { folder: 'rat', idle: 'brown_idle_8fps.gif', walk: 'brown_walk_8fps.gif' },
                'turtle': { folder: 'turtle', idle: 'green_idle_8fps.gif', walk: 'green_walk_8fps.gif' },
                'horse': { folder: 'horse', idle: 'black_idle_8fps.gif', walk: 'black_walk_8fps.gif' },
                'panda': { folder: 'panda', idle: 'black_idle_8fps.gif', walk: 'black_walk_8fps.gif' },
                'rocky': { folder: 'rocky', idle: 'gray_idle_8fps.gif', walk: 'gray_walk_8fps.gif' },
                'snail': { folder: 'snail', idle: 'brown_idle_8fps.gif', walk: 'brown_walk_8fps.gif' },
                'deno': { folder: 'deno', idle: 'green_idle_8fps.gif', walk: 'green_walk_8fps.gif' },
                'morph': { folder: 'morph', idle: 'purple_idle_8fps.gif', walk: 'purple_walk_8fps.gif' },
                'skeleton': { folder: 'skeleton', idle: 'warrior_idle_8fps.gif', walk: 'warrior_walk_8fps.gif' },
            };

            const config = mapping[type] || mapping['akita'];
            
            // Resolve local path
            const extensionRoot = context ? context.extensionPath : '';
            
            let walkUrl = '';
            let idleUrl = '';

            if (extensionRoot) {
                const walkPath = path.join(extensionRoot, 'resources', 'pet', config.folder, config.walk);
                const idlePath = path.join(extensionRoot, 'resources', 'pet', config.folder, config.idle);
                
                walkUrl = Uri.file(walkPath).with({ scheme: 'vscode-file', authority: 'vscode-app' }).toString();
                idleUrl = Uri.file(idlePath).with({ scheme: 'vscode-file', authority: 'vscode-app' }).toString();
            }

            return { enabled, walkUrl, idleUrl };
        } catch (e) {
            console.error('[FileDom] Failed to get pet config:', e);
            return { 
                enabled: false, 
                walkUrl: '', 
                idleUrl: '' 
            };
        }
    }

    // 获取js内容
    private getLoaderJs(): string {
        const cssDesktopUrl = Uri.file(CUSTOM_CSS_FILE_PATH).with({ scheme: 'vscode-file', authority: 'vscode-app' }).toString();
        const escapedDesktopUrl = this.escapeTemplateLiteral(cssDesktopUrl);
        const webCssPath = WEB_RELATIVE_CSS_PATH ? this.escapeTemplateLiteral(WEB_RELATIVE_CSS_PATH) : '';
        const cssFileName = this.escapeTemplateLiteral(CUSTOM_CSS_FILE_NAME);
        const workbenchJsName = this.escapeTemplateLiteral(selectedWorkbench.js);
        const relativePlaceholder = this.escapeTemplateLiteral(RELATIVE_URL_PLACEHOLDER);

        // Get pet config
        const petConfig = this.getPetConfig();
        const petEnabled = petConfig.enabled;
        const petWalkUrl = this.escapeTemplateLiteral(petConfig.walkUrl);
        const petIdleUrl = this.escapeTemplateLiteral(petConfig.idleUrl);

        const videoSetup = `
            function updateVideo(config) {
                let video = document.getElementById('background-cover-video');
                if (!config) {
                    if (video) video.remove();
                    return;
                }
                if (!video) {
                    video = document.createElement('video');
                    video.id = 'background-cover-video';
                    video.autoplay = true;
                    video.loop = true;
                    video.muted = true;
                    video.style.position = 'absolute';
                    video.style.top = '0';
                    video.style.left = '0';
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.objectFit = 'cover';
                    video.style.zIndex = '2';
                    video.style.pointerEvents = 'none';
                    document.body.prepend(video);
                }
                
                let url = config.url;
                // HTTPS upgrade logic
                if (url.toLowerCase().startsWith('http://') && window.location.protocol === 'https:') {
                    url = url.replace(/^http:\\/\\//i, 'https://');
                }

                // Ensure attributes are set
                if (!video.loop) video.loop = true;
                if (!video.muted) video.muted = true;

                // Check if source actually changed to avoid reloading
                // Use decodeURIComponent to handle encoded URLs (e.g. %20 for spaces)
                let currentSrc = video.src;
                let newSrc = url;
                try {
                    if (currentSrc !== newSrc && decodeURIComponent(currentSrc) !== decodeURIComponent(newSrc)) {
                        video.src = newSrc;
                    }
                } catch (e) {
                    if (currentSrc !== newSrc) {
                        video.src = newSrc;
                    }
                }

                video.style.opacity = config.opacity + '';
                video.style.filter = 'blur(' + config.blur + 'px)';
                video.style.mixBlendMode = config.blendMode;
                
                if (video.paused) {
                    video.play().catch(e => {
                        if (e.name !== 'AbortError') {
                            console.error('BackgroundCover video play error:', e);
                        }
                    });
                }
            }
        `;

        return `
        (function() {
            const cssDesktopUrl = '${escapedDesktopUrl}';
            const relativeCssPath = '${webCssPath}';
            const cssFileName = '${cssFileName}';
            const workbenchJsName = '${workbenchJsName}';
            const relativePlaceholder = '${relativePlaceholder}';

            // Pet Config
            const petEnabled = ${petEnabled};
            const petWalkUrl = '${petWalkUrl}';
            const petIdleUrl = '${petIdleUrl}';

            function ensureTrailingSlash(value) {
                if (!value) {
                    return '';
                }
                return value.endsWith('/') ? value : value + '/';
            }

            function getCssBaseHref(url) {
                if (!url) {
                    return '';
                }
                let clean = url;
                const hashIndex = clean.indexOf('#');
                if (hashIndex !== -1) {
                    clean = clean.substring(0, hashIndex);
                }
                const queryIndex = clean.indexOf('?');
                if (queryIndex !== -1) {
                    clean = clean.substring(0, queryIndex);
                }
                const slashIndex = clean.lastIndexOf('/');
                if (slashIndex === -1) {
                    return ensureTrailingSlash(clean);
                }
                return ensureTrailingSlash(clean.substring(0, slashIndex + 1));
            }

            function replaceRelativeTokens(value, baseHref) {
                if (!value || value.indexOf(relativePlaceholder) === -1) {
                    return value;
                }
                return value.split(relativePlaceholder).join(baseHref);
            }

            function deriveFromScript() {
                if (typeof document === 'undefined') {
                    return undefined;
                }

                const buildFromSrc = (src) => {
                    try {
                        return new URL(cssFileName, src).toString();
                    } catch (error) {
                        console.error('[BackgroundCover] Script URL resolve error:', error);
                        return undefined;
                    }
                };

                const current = document.currentScript;
                if (current && current.src) {
                    const candidate = buildFromSrc(current.src);
                    if (candidate) {
                        return candidate;
                    }
                }

                const scripts = document.getElementsByTagName ? document.getElementsByTagName('script') : [];
                for (let i = scripts.length - 1; i >= 0; i--) {
                    const tag = scripts[i];
                    if (tag && tag.src && tag.src.indexOf(workbenchJsName) !== -1) {
                        const candidate = buildFromSrc(tag.src);
                        if (candidate) {
                            return candidate;
                        }
                    }
                }

                return undefined;
            }

            const resolveCssUrl = () => {
                const scriptResolved = deriveFromScript();
                if (scriptResolved) {
                    return scriptResolved;
                }

                const relativePath = relativeCssPath;
                if (relativePath) {
                    const bases = [];
                    const monacoEnv = typeof globalThis !== 'undefined' ? globalThis.MonacoEnvironment || {} : {};
                    if (monacoEnv.baseUrl) {
                        bases.push(monacoEnv.baseUrl);
                    }
                    if (monacoEnv.appOrigin) {
                        bases.push(monacoEnv.appOrigin);
                    }
                    if (typeof document !== 'undefined' && document.baseURI) {
                        bases.push(document.baseURI);
                    }
                    if (typeof window !== 'undefined' && window.location) {
                        const { origin, href } = window.location;
                        if (origin) {
                            bases.push(origin + '/');
                        }
                        if (href) {
                            const slashIndex = href.lastIndexOf('/');
                            if (slashIndex !== -1) {
                                bases.push(href.substring(0, slashIndex + 1));
                            }
                        }
                    }

                    for (const base of bases) {
                        try {
                            return new URL(relativePath, base).toString();
                        } catch (error) {
                            console.error('[BackgroundCover] Base URL failed:', error);
                        }
                    }

                    if (!relativePath.startsWith('http')) {
                        try {
                            return new URL(relativePath, '/').toString();
                        } catch (error) {
                            console.error('[BackgroundCover] Relative URL failed:', error);
                        }
                    }
                }

                return cssDesktopUrl;
            };
            const cssUrl = resolveCssUrl();
            const cssBaseHref = getCssBaseHref(cssUrl);
            
            ${videoSetup}

            function updateStyleTag(css) {
                let style = document.getElementById('background-cover-style');
                if (!style) {
                    style = document.createElement('style');
                    style.id = 'background-cover-style';
                    document.head.appendChild(style);
                }
                if (style.textContent !== css) {
                    style.textContent = css;
                }
            }
            
            function loadCss() {
                const url = cssUrl + '?t=' + Date.now();
                fetch(url).then(r => r.text()).then(css => {
                    const resolvedCss = replaceRelativeTokens(css, cssBaseHref);
                    updateStyleTag(resolvedCss);
                    
                    const match = resolvedCss.match(/\\/\\*background-cover-video-start\\*\\/([\\s\\S]*?)\\/\\*background-cover-video-end\\*\\//);
                    if (match) {
                        try {
                            const config = JSON.parse(match[1]);
                            config.url = replaceRelativeTokens(config.url, cssBaseHref);
                            updateVideo(config);
                        } catch(e) {
                            console.error('[BackgroundCover] Video config parse error:', e);
                        }
                    } else {
                        updateVideo(null);
                    }
                }).catch(e => console.error('[BackgroundCover] Load error:', e));
            }
            
            // Initial load
            loadCss();

            // 1. Event Hook: Listen for status bar message
            try {
                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        const target = mutation.target;
                        // Check text content of the mutated node
                        if (target.textContent && target.textContent.includes('background-cover-reload-trigger')) {
                            loadCss();
                            return; 
                        }
                    }
                });
                
                const findStatusBar = () => {
                    // Try to find the status bar container
                    const statusBar = document.querySelector('.statusbar') || document.getElementById('workbench.parts.statusbar') || document.querySelector('footer');
                    if (statusBar) {
                        observer.observe(statusBar, { 
                            subtree: true, 
                            characterData: true, 
                            childList: true 
                        });
                        console.log('[BackgroundCover] Observer attached to:', statusBar);
                    } else {
                        // Retry if not found yet
                        setTimeout(findStatusBar, 2000);
                    }
                };

                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', findStatusBar);
                } else {
                    findStatusBar();
                }
            } catch (e) {
                console.error('[BackgroundCover] Observer error:', e);
            }

            // 2. Backup Hook: Check on window focus
            // This ensures that if the status bar trigger is missed, the background updates when the user interacts with the window
            window.addEventListener('focus', () => {
                loadCss();
            });

            // Little Assistant Logic
            try {
                if (!petEnabled) {
                    // Clean up if disabled
                    const assistant = document.getElementById('vscode-background-cover-assistant');
                    if (assistant) assistant.remove();
                } else {
                    const assistantId = 'vscode-background-cover-assistant';
                    const titlebarId = 'workbench.parts.titlebar';
                    
                    // Inject CSS for animations
                    const styleId = 'vscode-background-cover-assistant-style';
                    if (!document.getElementById(styleId)) {
                        const style = document.createElement('style');
                        style.id = styleId;
                        style.textContent = \`
                            @keyframes assistant-jump {
                                0% { transform: translateY(0) scaleX(var(--dir, 1)); }
                                50% { transform: translateY(-15px) scaleX(var(--dir, 1)); }
                                100% { transform: translateY(0) scaleX(var(--dir, 1)); }
                            }
                            @keyframes title-shake {
                                0% { transform: translate(1px, 1px) rotate(0deg); }
                                10% { transform: translate(-1px, -2px) rotate(-1deg); }
                                20% { transform: translate(-3px, 0px) rotate(1deg); }
                                30% { transform: translate(3px, 2px) rotate(0deg); }
                                40% { transform: translate(1px, -1px) rotate(1deg); }
                                50% { transform: translate(-1px, 2px) rotate(-1deg); }
                                60% { transform: translate(-3px, 1px) rotate(0deg); }
                                70% { transform: translate(3px, 1px) rotate(-1deg); }
                                80% { transform: translate(-1px, -1px) rotate(1deg); }
                                90% { transform: translate(1px, 2px) rotate(0deg); }
                                100% { transform: translate(1px, -2px) rotate(-1deg); }
                            }
                            .assistant-jumping {
                                animation: assistant-jump 0.5s ease;
                            }
                            .title-shaking {
                                animation: title-shake 0.5s;
                                display: inline-block;
                            }
                            .pet-message {
                                position: absolute;
                                top: 32px;
                                left: 50%;
                                transform: translateX(-50%);
                                background: rgba(255, 255, 255, 0.9);
                                color: #000;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                white-space: nowrap;
                                pointer-events: none;
                                opacity: 0;
                                transition: opacity 0.3s;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                                z-index: 100000;
                            }
                            .pet-message.show {
                                opacity: 1;
                            }
                            .pet-message::after {
                                content: '';
                                position: absolute;
                                bottom: 100%;
                                left: 50%;
                                margin-left: -4px;
                                border-width: 4px;
                                border-style: solid;
                                border-color: transparent transparent rgba(255, 255, 255, 0.9) transparent;
                            }
                        \`;
                        document.head.appendChild(style);
                    }

                    const initAssistant = () => {
                        if (document.getElementById(assistantId)) return;
                        const titlebar = document.getElementById(titlebarId);
                        if (!titlebar) return;

                        const assistant = document.createElement('div');
                        assistant.id = assistantId;
                        
                        // Use image instead of emoji
                        const petImage = document.createElement('img');
                        const walkUrl = petWalkUrl;
                        const idleUrl = petIdleUrl;
                        
                        petImage.src = idleUrl;
                        petImage.style.width = '30px'; // Adjust size
                        petImage.style.height = 'auto';
                        petImage.style.imageRendering = 'pixelated'; // Keep pixel art crisp
                        
                        assistant.appendChild(petImage);

                        assistant.style.position = 'absolute';
                        assistant.style.zIndex = '99999';
                        assistant.style.top = '0px'; // Adjust top to fit image
                        assistant.style.pointerEvents = 'none';
                        assistant.style.transition = 'left 3s linear'; 
                        assistant.style.left = '0px';
                        // Set initial direction variable
                        assistant.style.setProperty('--dir', '1');
                        assistant.style.transform = 'scaleX(var(--dir))';
                        
                        titlebar.appendChild(assistant);

                        let currentPos = 0;

                        const messages = [
                            "写代码辛苦了，休息一下吧",
                            "记得喝水哦",
                            "今天也是元气满满的一天！",
                            "Bug 都会消失的！",
                            "站起来活动一下吧",
                            "眼睛累了吗？眺望一下远方",
                            "加油！你是最棒的！",
                            "Coding is fun!",
                            "记得保存哦",
                            "不要熬夜太晚",
                            "又在写 Bug 吗？",
                            "这个需求做不完的...",
                            "产品经理又改需求了？",
                            "记得提交代码，不然白写了",
                            "头发还剩多少？",
                            "Hello World!",
                            "PHP 是世界上最好的语言",
                            "这个 Bug 是 Feature",
                            "删库跑路？",
                            "Ctrl+C Ctrl+V 大法好"
                        ];

                        function showMessage() {
                            const msg = messages[Math.floor(Math.random() * messages.length)];
                            const bubble = document.createElement('div');
                            bubble.className = 'pet-message';
                            bubble.textContent = msg;
                            // Reset transform to avoid flipping text
                            bubble.style.transform = 'translateX(-50%) scaleX(' + assistant.style.getPropertyValue('--dir') + ')';
                            
                            assistant.appendChild(bubble);
                            
                            // Trigger reflow
                            void bubble.offsetWidth;
                            bubble.classList.add('show');
                            
                            setTimeout(() => {
                                bubble.classList.remove('show');
                                setTimeout(() => bubble.remove(), 300);
                            }, 3000);
                        }

                        function triggerJump() {
                            assistant.classList.remove('assistant-jumping');
                            // Trigger reflow
                            void assistant.offsetWidth;
                            assistant.classList.add('assistant-jumping');
                        }

                        function triggerShake(element) {
                            if (!element) return;
                            element.classList.remove('title-shaking');
                            void element.offsetWidth;
                            element.classList.add('title-shaking');
                        }

                        function move() {
                            if (!document.body.contains(assistant)) return;
                            
                            const containerWidth = titlebar.clientWidth;
                            const assistantWidth = assistant.clientWidth || 30;
                            const maxPos = containerWidth - assistantWidth;
                            
                            const nextPos = Math.floor(Math.random() * maxPos);
                            const dist = Math.abs(nextPos - currentPos);
                            const speed = 50; // px per second (slower for walking dog)
                            const duration = dist / speed; 
                            
                            // Switch to walking animation
                            petImage.src = walkUrl;

                            assistant.style.transition = 'left ' + duration + 's linear';
                            
                            // Direction
                            const dir = nextPos > currentPos ? 1 : -1;
                            assistant.style.setProperty('--dir', dir.toString());
                            
                            assistant.style.left = nextPos + 'px';

                            // Random jump logic
                            const jumpChance = 0.3; // 30% chance to jump randomly
                            if (Math.random() < jumpChance) {
                                const jumpDelay = Math.random() * duration * 1000;
                                setTimeout(() => {
                                    triggerJump();
                                }, jumpDelay);
                            }

                            // Collision detection logic for multiple elements
                            const targets = titlebar.querySelectorAll('.window-title, .window-controls-container, .layout-control, .monaco-toolbar');
                            
                            targets.forEach(target => {
                                if (!target) return;
                                const targetRect = target.getBoundingClientRect();
                                // Use offsetLeft relative to titlebar if possible, or calculate from rect
                                // Since titlebar is relative/absolute, we need relative positions
                                const titlebarRect = titlebar.getBoundingClientRect();
                                const targetLeft = targetRect.left - titlebarRect.left;
                                const targetRight = targetLeft + targetRect.width;

                                // Check if path intersects with target
                                const start = Math.min(currentPos, nextPos);
                                const end = Math.max(currentPos, nextPos);

                                if (start < targetRight && end > targetLeft) {
                                    // Calculate when the collision happens
                                    let distToCollision;
                                    if (dir === 1) { // Moving right
                                        distToCollision = targetLeft - currentPos;
                                    } else { // Moving left
                                        distToCollision = currentPos - targetRight;
                                    }

                                    // If already inside or very close, trigger immediately
                                    if (distToCollision < 0) distToCollision = 0;
                                    
                                    const timeToCollision = (distToCollision / speed) * 1000;
                                    
                                    // Schedule jump and shake
                                    setTimeout(() => {
                                        triggerJump();
                                        // Delay shake slightly to match the "hit" (jump down)
                                        setTimeout(() => {
                                            triggerShake(target);
                                        }, 250);
                                    }, timeToCollision);
                                }
                            });

                            currentPos = nextPos;

                            // After move, switch to idle
                            setTimeout(() => {
                                petImage.src = idleUrl;

                                // Random message logic (only when idle)
                                const messageChance = 0.8; // 50% chance to show message
                                let delay = 1000 + Math.random() * 3000;

                                if (Math.random() < messageChance) {
                                    showMessage();
                                    // If message is shown, ensure we wait long enough for it to disappear (3s)
                                    if (delay < 3500) delay = 3500 + Math.random() * 2000;
                                }

                                // Schedule next move
                                setTimeout(move, delay);
                            }, duration * 1000);
                        }

                        move();
                    };

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', initAssistant);
                    } else {
                        initAssistant();
                    }
                    
                    // Re-init if titlebar is re-created
                    const observer = new MutationObserver(() => {
                        if (!document.getElementById(assistantId)) {
                            initAssistant();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }

            } catch (e) {
                console.error('[BackgroundCover] Assistant error:', e);
            }
        })();
        `;
    }

    // 隐藏损坏提示
    private getCorruptionWarningCss(): string {
        const translations = [
            'installation appears to be corrupt',
            '安装似乎损坏',
        ];
        return translations.map(trans => `
        .notification-toast-container:has([aria-label*='${trans}']) {
            display: none;
        }
        `).join('');
    }

    // 获取css样式值
    private getCssStyles(): { sizeModelVal: string; repeatVal: string; positionVal: string } {
        let sizeModelVal = this.sizeModel;
        let repeatVal = "no-repeat";
        let positionVal = "center";

        switch (this.sizeModel) {
            case "cover":
                sizeModelVal = "cover";
                break;
            case "contain":
                sizeModelVal = "100% 100%";
                break;
            case "center":
                sizeModelVal = "contain";
                break;
            case "repeat":
                sizeModelVal = "auto";
                repeatVal = "repeat";
                break;
            case "not_center":
                sizeModelVal = "auto";
                break;
            case "not_right_bottom":
                sizeModelVal = "auto";
                positionVal = "right 96%";
                break;
            case "not_right_top":
                sizeModelVal = "auto";
                positionVal = "right 30px";
                break;
            case "not_left":
                sizeModelVal = "auto";
                positionVal = "left";
                break;
            case "not_right":
                sizeModelVal = "auto";
                positionVal = "right";
                break;
            case "not_top":
                sizeModelVal = "auto";
                positionVal = "top";
                break;
            case "not_bottom":
                sizeModelVal = "auto";
                positionVal = "bottom";
                break;
        }

        return { sizeModelVal, repeatVal, positionVal };
    }

    // 转义模板字符串
    private escapeTemplateLiteral(value: string): string {
        if (!value) return value;
        return value
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
    }

    // 图片转为Base64
    private async imageToBase64(): Promise<boolean> {
        try {
            const extname = path.extname(this.imagePath).substr(1);
            const imageBuffer = await fs.promises.readFile(path.resolve(this.imagePath));
            this.imagePath = `data:image/${extname};base64,${imageBuffer.toString('base64')}`;
            return true;
        } catch {
            return false;
        }
    }

    private async prepareCodeServerAsset(sourcePath: string): Promise<string | undefined> {
        try {
            await fse.ensureDir(CUSTOM_ASSET_DIR);
            const buffer = await fse.readFile(path.resolve(sourcePath));
            const hash = crypto.createHash('md5').update(buffer).digest('hex');
            const ext = path.extname(sourcePath) || '.img';
            const fileName = `${hash}${ext}`;
            const destPath = path.join(CUSTOM_ASSET_DIR, fileName);

            if (!(await fse.pathExists(destPath))) {
                await fse.writeFile(destPath, buffer);
            }

            const relativeUrl = this.getRelativeAssetUrl(destPath);
            if (!relativeUrl) {
                return undefined;
            }

            const normalized = relativeUrl.replace(/^\/+/, '');
            return `${RELATIVE_URL_PLACEHOLDER}/${normalized}`;
        } catch (error) {
            console.error('[FileDom] Failed to prepare code-server asset:', error);
            return undefined;
        }
    }

    private getExtensionFromContentType(contentType?: string): string | undefined {
        if (!contentType) {
            return undefined;
        }
        const cleanType = contentType.split(';')[0].trim().toLowerCase();
        const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/gif': '.gif',
            'image/webp': '.webp',
            'image/bmp': '.bmp',
            'image/svg+xml': '.svg',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/ogg': '.ogg',
            'video/quicktime': '.mov'
        };
        return map[cleanType] || undefined;
    }

    private getRelativeAssetUrl(targetPath: string): string | undefined {
        try {
            const relative = path.relative(selectedWorkbench.root, targetPath);
            if (!relative || relative.startsWith('..')) {
                return undefined;
            }
            return relative.split(path.sep).join('/');
        } catch (error) {
            console.error('[FileDom] Failed to resolve asset url:', error);
            return undefined;
        }
    }

    private localImgToVsc(): void {
        const separator = this.systemType === SystemType.LINUX ? "" : "/";
        this.imagePath = Uri.parse(`vscode-file://vscode-app${separator}${this.imagePath}`).toString();
    }

    private clearCssContent(content: string): string {
        const regex = new RegExp(`\\/\\*ext-${this.extName}-start\\*\\/[\\s\\S]*?\\/\\*ext-${this.extName}-end\\*\\/`, 'g');
        return content.replace(regex, '').trim();
    }

    public getPatchContent(content: string): boolean {
        const match = content.match(/\/\*ext-backgroundCover-start\*\/[\s\S]*?\/\*ext-backgroundCover-end\*\//g);
        return !!match;
    }
}
