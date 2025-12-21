import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { env, Uri, window, WorkspaceConfiguration } from 'vscode';
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

const WORKBENCH_TARGETS: WorkbenchTarget[] = [
    {
        name: 'desktop',
        root: path.join(env.appRoot, "out", "vs", "workbench"),
        js: 'workbench.desktop.main.js',
        css: 'workbench.desktop.main.css',
        bak: 'workbench.desktop.main.js.bak'
    },
    {
        name: 'code-server',
        root: path.join(env.appRoot, "out", "vs", "code", "browser", "workbench"),
        js: 'workbench.js',
        css: 'workbench.css',
        bak: 'workbench.js.bak'
    }
];

function getWorkbenchTarget(): WorkbenchTarget {
    return WORKBENCH_TARGETS.find((target) => fs.existsSync(path.join(target.root, target.js))) || WORKBENCH_TARGETS[0];
}

const selectedWorkbench = getWorkbenchTarget();
const JS_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.js);
const CSS_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.css);
const BAK_FILE_PATH = path.join(selectedWorkbench.root, selectedWorkbench.bak);
const CUSTOM_CSS_FILE_NAME = 'css-background-cover.css';
export const CUSTOM_CSS_FILE_PATH = path.join(selectedWorkbench.root, CUSTOM_CSS_FILE_NAME);

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
        });
    }

    private async initializeImage(): Promise<void> {
        let lowerPath = this.imagePath.toLowerCase();

        if (lowerPath.startsWith('http://') || lowerPath.startsWith('https://')) {
            await this.downloadAndCacheImage();
            lowerPath = this.imagePath.toLowerCase();
        }

        if (
            !lowerPath.startsWith('http://') &&
            !lowerPath.startsWith('https://') &&
            !lowerPath.startsWith('data:')
        ) {
            const converted = await this.imageToBase64();
            if (!converted) {
                this.localImgToVsc();
            }
        }
    }

    private async downloadAndCacheImage(): Promise<void> {
        try {
            const context = getContext();
            const cacheDir = path.join(context.globalStorageUri.fsPath, 'images');
            await fse.ensureDir(cacheDir);

            const urlHash = crypto.createHash('md5').update(this.imagePath).digest('hex');
            let ext = '.jpg';
            let isStaticImage = false;

            try {
                const urlObj = new URL(this.imagePath);
                ext = path.extname(urlObj.pathname) || '.jpg';
                if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext.toLowerCase())) {
                    isStaticImage = true;
                }
            } catch {
                // ignore
            }
            
            const cachePath = path.join(cacheDir, `${urlHash}${ext}`);

            if (isStaticImage && await fse.pathExists(cachePath)) {
                this.imagePath = cachePath;
                return;
            }

            const tempPath = `${cachePath}.tmp`;

            try {
                await this.downloadFile(this.imagePath, tempPath);
                await fse.move(tempPath, cachePath, { overwrite: true });
                this.imagePath = cachePath;
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
        }
    }

    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const protocol = url.startsWith('https') ? https : http;
            
            const request = protocol.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });
            
            request.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        });
    }

    public async install(): Promise<boolean> {
        if (!(await this.checkFileExists())) {
            return false;
        }

        await this.handleLegacyCleanup();
        await this.ensureBackup();

        return await this.applyPatch();
    }

    private async checkFileExists(): Promise<boolean> {
        const isExist = await fse.pathExists(this.filePath);
        if (!isExist) {
            await window.showErrorMessage(`文件不存在，提醒开发者修复吧！`);
            return false;
        }
        return true;
    }

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

    private async ensureBackup(): Promise<void> {
        const bakExist = await fse.pathExists(BAK_FILE_PATH);
        if (!bakExist) {
            this.bakStatus = true;
            window.setStatusBarMessage(`首次使用正在获取权限及备份文件，处理中... / First use is getting permission and backing up files, processing...`, 10000);
        }
    }

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

    private async getContent(filePath: string): Promise<string> {
        return await fse.readFile(filePath, 'utf-8');
    }

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

    private async writeWithPermission(filePath: string, content: string): Promise<void> {
        try {
            await fse.writeFile(filePath, content, { encoding: 'utf-8' });
        } catch (err) {
            await this.getFilePermission(filePath);
            await fse.writeFile(filePath, content, { encoding: 'utf-8' });
        }
    }

    private async bakFile(): Promise<void> {
        try {
            await fse.writeFile(BAK_FILE_PATH, this.bakJsContent, { encoding: 'utf-8' });
        } catch (err) {
            await this.createAndWriteBakFile();
        }
    }

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

    private async saveCssContent(): Promise<void> {
        const css = this.getCss();
        await this.writeWithPermission(CUSTOM_CSS_FILE_PATH, css);
    }

    private getLoaderJs(): string {
        const cssUrl = Uri.file(CUSTOM_CSS_FILE_PATH).with({ scheme: 'vscode-file', authority: 'vscode-app' }).toString();
        
        return `
        (function() {
            const cssUrl = '${cssUrl}';
            
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
                    updateStyleTag(css);
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
            window.addEventListener('focus', loadCss);
        })();
        `;
    }

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

    private getCss(): string {
        const opacity = Math.min(this.imageOpacity, 0.8);
        const { sizeModelVal, repeatVal, positionVal } = this.getCssStyles();

        let finalImagePath = this.escapeTemplateLiteral(this.imagePath);
        const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        
        if (this.forceHttpsUpgrade && finalImagePath.toLowerCase().startsWith('http://')) {
            if (globalWindow?.location?.protocol === 'https:') {
                finalImagePath = finalImagePath.replace(/^http:\/\//i, 'https://');
            }
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
            background-image:url('${finalImagePath}');
            z-index: 2;
            pointer-events: none;
            filter: blur(${this.blur}px);
            mix-blend-mode: ${this.blendModel};
        }
        ${this.getCorruptionWarningCss()}
        `;
    }

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

    private escapeTemplateLiteral(value: string): string {
        if (!value) return value;
        return value
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
    }

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
