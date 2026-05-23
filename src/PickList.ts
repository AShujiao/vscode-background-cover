import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { URL } from 'url';
import {
	QuickPick,
	Disposable,
	QuickPickItemKind,
	workspace,
	WorkspaceConfiguration,
	window,
	commands,
	env,
	Uri,
	extensions,
	InputBoxOptions,
	ConfigurationTarget,
    ProgressLocation
} from 'vscode';

import { FileDom } from './FileDom';
import { ImgItem } from './ImgItem';
import vsHelp from './vsHelp';
import { getContext, onDidChangeGlobalState } from './global';
import { BlendHelper } from './BlendHelper';
import Color, { getColorList } from './color'; // 导入颜色定义
import { OnlineImageHelper } from './OnlineImageHelper';



// Action Types Enum to replace magic numbers
export enum ActionType {
    SelectPictures = 1,
    AddDirectory = 2,
    ManualSelection = 3,
    UpdateBackground = 4,
    BackgroundOpacity = 5,
    InputPath = 6,
    CloseBackground = 7,
    ReloadWindow = 8,
    CloseMenu = 9,
    MoreMenu = 12,
    OpenExternalUrl = 13,
    OpenFilePath = 14,
    SizeModeMenu = 15,
    SetSizeMode = 16,
    OnlineImages = 17,
    BackgroundBlur = 18,
    RefreshOnlineFolder = 19,
    AutoRandomSettings = 20,
    OpenCacheFolder = 21,
    SelectPet = 26,
    TogglePet = 27,
    
    // Particle Effects
    ParticleSettings = 30,
    ToggleParticle = 31,
    ParticleOpacity = 32,
    ParticleColor = 33,
    ParticleCount = 34,
    SetParticleColor = 101,
    InputParticleColor = 102
}

// Input Types Enum
enum InputType {
    Path = 1,
    Opacity = 2,
    Blur = 3,
    AutoRandomSettings = 4,
    ParticleOpacity = 10,
    ParticleColor = 11,
    ParticleCount = 12
}

export interface PetEntry {
    value: string;
    label: string;
    desc: string;
    folder: string;
    idle: string;
    walk: string;
    source?: 'builtin' | 'codex';
    spritesheetPath?: string;
}

/** Single source of truth for available pets (used by PickList + FileDom + Studio webview). */
export const PET_LIST: PetEntry[] = [
    { value: 'akita',       label: 'Akita (Dog)', desc: '秋田犬',  folder: 'dog',         idle: 'akita_idle_8fps.gif',  walk: 'akita_walk_8fps.gif' },
    { value: 'totoro',      label: 'Totoro',      desc: '龙猫',    folder: 'totoro',      idle: 'gray_idle_8fps.gif',   walk: 'gray_walk_8fps.gif' },
    { value: 'fox',         label: 'Fox',         desc: '狐狸',    folder: 'fox',         idle: 'red_idle_8fps.gif',    walk: 'red_walk_8fps.gif' },
    { value: 'pika',        label: 'Pika',        desc: '皮卡丘',  folder: 'pika',        idle: 'pika_still.gif',       walk: 'pika_run.gif' },
    { value: 'deno2',       label: 'Deno2',       desc: '恐龙2',   folder: 'deno2',       idle: 'deno2_idle_8fps.gif',  walk: 'deno2_walk_8fps.gif' },
    { value: 'clippy',      label: 'Clippy',      desc: '大眼夹',  folder: 'clippy',      idle: 'black_idle_8fps.gif',  walk: 'brown_walk_8fps.gif' },
    { value: 'rubber-duck', label: 'Rubber Duck', desc: '小黄鸭',  folder: 'rubber-duck', idle: 'yellow_idle_8fps.gif', walk: 'yellow_walk_8fps.gif' },
    { value: 'crab',        label: 'Crab',        desc: '螃蟹',    folder: 'crab',        idle: 'red_idle_8fps.gif',    walk: 'red_walk_8fps.gif' },
    { value: 'zappy',       label: 'Zappy',       desc: '闪电',    folder: 'zappy',       idle: 'yellow_idle_8fps.gif', walk: 'yellow_walk_8fps.gif' },
    { value: 'cockatiel',   label: 'Cockatiel',   desc: '玄凤鹦鹉',folder: 'cockatiel',   idle: 'brown_idle_8fps.gif',  walk: 'brown_walk_8fps.gif' },
    { value: 'snake',       label: 'Snake',       desc: '蛇',      folder: 'snake',       idle: 'green_idle_8fps.gif',  walk: 'green_walk_8fps.gif' },
    { value: 'chicken',     label: 'Chicken',     desc: '鸡',      folder: 'chicken',     idle: 'white_idle_8fps.gif',  walk: 'white_walk_8fps.gif' },
    { value: 'turtle',      label: 'Turtle',      desc: '乌龟',    folder: 'turtle',      idle: 'green_idle_8fps.gif',  walk: 'green_walk_8fps.gif' },
    { value: 'panda',       label: 'Panda',       desc: '熊猫',    folder: 'panda',       idle: 'black_idle_8fps.gif',  walk: 'black_walk_8fps.gif' },
    { value: 'snail',       label: 'Snail',       desc: '蜗牛',    folder: 'snail',       idle: 'brown_idle_8fps.gif',  walk: 'brown_walk_8fps.gif' },
    { value: 'deno',        label: 'Deno',        desc: '恐龙',    folder: 'deno',        idle: 'green_idle_8fps.gif',  walk: 'green_walk_8fps.gif' },
    { value: 'morph',       label: 'Morph',       desc: 'Morph',   folder: 'morph',       idle: 'purple_idle_8fps.gif', walk: 'purple_walk_8fps.gif' },
];

let codexPetCache: PetEntry[] | undefined;

function getCodexHome(): string {
    return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

export function getCodexPetList(): PetEntry[] {
    if (codexPetCache) { return codexPetCache; }

    const petsRoot = path.join(getCodexHome(), 'pets');
    const entries: PetEntry[] = [];
    try {
        if (!fs.existsSync(petsRoot) || !fs.statSync(petsRoot).isDirectory()) {
            codexPetCache = [];
            return codexPetCache;
        }

        for (const folderName of fs.readdirSync(petsRoot)) {
            const folder = path.join(petsRoot, folderName);
            const manifestPath = path.join(folder, 'pet.json');
            if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) { continue; }

            try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                const id = typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : folderName;
                const displayName = typeof manifest.displayName === 'string' && manifest.displayName.trim()
                    ? manifest.displayName.trim()
                    : id;
                const description = typeof manifest.description === 'string' ? manifest.description.trim() : 'Codex pet';
                const spritesheetName = typeof manifest.spritesheetPath === 'string' && manifest.spritesheetPath.trim()
                    ? manifest.spritesheetPath.trim()
                    : 'spritesheet.webp';
                const spritesheetPath = path.resolve(folder, spritesheetName);
                if (!fs.existsSync(spritesheetPath) || !fs.statSync(spritesheetPath).isFile()) { continue; }

                entries.push({
                    value: `codex:${id}`,
                    label: `${displayName} (Codex)`,
                    desc: description || 'Codex pet',
                    folder,
                    idle: spritesheetName,
                    walk: spritesheetName,
                    source: 'codex',
                    spritesheetPath
                });
            } catch (error) {
                console.warn('[BackgroundCover] Failed to load Codex pet manifest:', manifestPath, error);
            }
        }
    } catch (error) {
        console.warn('[BackgroundCover] Failed to scan Codex pets:', error);
    }

    codexPetCache = entries;
    return codexPetCache;
}

export function getAllPets(): PetEntry[] {
    return PET_LIST.concat(getCodexPetList());
}

export class PickList {
    public static itemList: PickList | undefined;
    private static intervalHandle: NodeJS.Timeout | undefined;
    private static isAutoRunning: boolean = false;
    private static _reloadTriggerSeq: number = 0;
    private static _updateSeq: number = 0;

    private readonly quickPick: QuickPick<ImgItem> | any;
    private _disposables: Disposable[] = [];
    private config: WorkspaceConfiguration;
    private imgPath: string;
    private opacity: number;
    private imageFileType: number;
    private sizeModel: string;
    private blur: number;
    private randUpdate: boolean = false;
    private skipOnlineCache: boolean = false;

    // --- Static Entry Points ---

    public static createItemLIst() {
        const config = workspace.getConfiguration('backgroundCover');
        const list = window.createQuickPick<ImgItem>();
        list.placeholder = 'Please choose configuration! / 请选择相关配置！';
        list.totalSteps = 2;
        list.title = "背景图设置";
        
        PickList.itemList = new PickList(config, list);
        PickList.itemList.showMainMenu();
    }

    public static needAutoUpdate(config: WorkspaceConfiguration) {
        if (config.imagePath == '') { return; }

        const nowBlenaStr = BlendHelper.autoBlendModel();
        PickList.itemList = new PickList(config);
        PickList.itemList.updateDom(false, nowBlenaStr as string).then((requiresReload) => {
            if (requiresReload) {
                // Avoid auto-reloading: the Studio "Reload to apply" button in
                // the Decoration tab gives the user explicit control. We just
                // hint via the status bar so they know the change is staged.
                window.setStatusBarMessage(
                    '部分修改需重启窗口生效（装饰栏 → 重启生效） / Restart required for some changes.',
                    6000
                );
            }
        }).catch(error => {
            console.error("Error updating the DOM:", error);
        });
    }

    public static autoUpdateBlendModel() {
        const config = workspace.getConfiguration('backgroundCover');
        if (config.imagePath == '') { return; }

        const context = getContext();
        const blendStr = context.globalState.get('backgroundCoverBlendModel');
        const nowBlenaStr = BlendHelper.autoBlendModel();
        if (blendStr == nowBlenaStr) { return false; }

        window.showInformationMessage('主题模式发生变更，是否更新背景混合模式？', 'YES', 'NO').then(
            (value) => {
                if (value === 'YES') {
                    PickList.itemList = new PickList(config);
                    PickList.itemList.updateDom(false, nowBlenaStr as string).then((requiresReload) => {
                        if (requiresReload) {
                            commands.executeCommand('workbench.action.reloadWindow');
                        }
                    });
                }
            }
        );
    }

    public static autoUpdateBackground() {
        const config = workspace.getConfiguration('backgroundCover');
        if (!config.randomImageFolder || !config.autoStatus) {
            return false;
        }
        PickList.itemList = new PickList(config);
        PickList.itemList.autoUpdateBackground();
        return PickList.itemList = undefined;
    }

    public static randomUpdateBackground() {
        const config = workspace.getConfiguration('backgroundCover');
        if (!config.randomImageFolder) {
            window.showWarningMessage('Please add a directory! / 请添加目录！');
            return false;
        }
        PickList.itemList = new PickList(config);
        PickList.itemList.setRandUpdate(true);
        PickList.itemList.setSkipOnlineCache(true);
        PickList.itemList.autoUpdateBackground();
        PickList.itemList = undefined;
    }

    public static async applyCurrentBackground(): Promise<boolean> {
        const config = workspace.getConfiguration('backgroundCover');
        if (!config.get<string>('imagePath')) {
            return false;
        }
        PickList.itemList = new PickList(config);
        const result = await PickList.itemList.updateDom(false, BlendHelper.autoBlendModel() as string);
        PickList.itemList = undefined;
        return result;
    }

    public static startAutoRandomTask() {
        const config = workspace.getConfiguration('backgroundCover');
        const autoStatus = config.get<boolean>('autoStatus');
        const interval = config.get<number>('autoInterval', 10);

        PickList.stopAutoRandomTask();

        if (autoStatus && interval > 0) {
            console.log(`[BackgroundCover] Starting auto update task. Interval: ${interval}s`);
            PickList.intervalHandle = setInterval(async () => {
                if (PickList.isAutoRunning) {
                    console.log('[BackgroundCover] Previous auto update still running, skipping this round');
                    return;
                }
                const cfg = workspace.getConfiguration('backgroundCover');
                const context = getContext();
                const hasOnlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
                const hasSingleSource = context.globalState.get('backgroundCoverSingleImageSource');
                if (cfg.randomImageFolder || hasOnlineFolder || hasSingleSource) {
                    PickList.isAutoRunning = true;
                    try {
                        const pl = new PickList(cfg);
                        pl.setSkipOnlineCache(true);
                        await pl.autoUpdateBackground(false);
                    } catch (err) {
                        console.error(err);
                    } finally {
                        PickList.isAutoRunning = false;
                    }
                }
            }, interval * 1000);
        }
    }

    public static stopAutoRandomTask() {
        if (PickList.intervalHandle) {
            clearInterval(PickList.intervalHandle);
            PickList.intervalHandle = undefined;
        }
    }

    public static startNest() {
        const config = workspace.getConfiguration('backgroundCover');
        const list = window.createQuickPick<ImgItem>();
        list.placeholder = 'Please choose configuration! / 请选择相关配置！';
        list.totalSteps = 2;
        PickList.itemList = new PickList(config, list);
        PickList.itemList.particleEffectSettings();
    }

    public static async updateImgPath(path: string) {
        const isUrl = (path.slice(0, 8).toLowerCase() === 'https://') || (path.slice(0, 7).toLowerCase() === 'http://');
        if (!isUrl) {
            vsHelp.showInfo("非http/https格式图片，不支持配置！ / Non HTTP/HTTPS format image, configuration not supported!");
            return false;
        }
        await window.withProgress({
            location: ProgressLocation.Notification,
            title: "正在检测在线资源类型... / Detecting online resource type...",
            cancellable: false
        }, async () => {
            try {
                const images = await OnlineImageHelper.getOnlineImages(path);
                const config = workspace.getConfiguration('backgroundCover');
                PickList.itemList = new PickList(config);
                PickList.itemList.setImageFileType(2);
                
                if (images && images.length > 1) {
                    window.showInformationMessage(`检测到在线文件夹，包含 ${images.length} 张图片！将随机选择一张作为背景。`);
                    const context = getContext();
                    context.globalState.update('backgroundCoverOnlineFolder', path);
                    context.globalState.update('backgroundCoverOnlineImageList', images);
                    await config.update('randomImageFolder', path, ConfigurationTarget.Global);
                    const randomImage = images[Math.floor(Math.random() * images.length)];
                    PickList.itemList.updateBackgound(randomImage);
                } else {
                    // window.showInformationMessage('检测到单张在线图片！');
                    const actualImage = (images && images.length > 0) ? images[0] : path;
                    PickList.itemList.updateBackgound(actualImage, true);
                }
            } catch (error: any) {
                window.showErrorMessage(`在线资源检测失败: ${error.message}`);
                const config = workspace.getConfiguration('backgroundCover');
                PickList.itemList = new PickList(config);
                PickList.itemList.setImageFileType(2);
                PickList.itemList.updateBackgound(path, true);
            }
        });
    }

    public static gotoFilePath(path?: string) {
        if (path == undefined) {
            return window.showWarningMessage('无效菜单');
        }
        const extensionUri = getContext().extensionUri ?? extensions.getExtension("manasxx.background-cover")?.extensionUri;
        if (!extensionUri) {
            return window.showWarningMessage('未找到扩展资源路径 / Extension resource path not found');
        }

        const segments = path.split(/[\\/]+/).filter(Boolean);
        const fileUri = Uri.joinPath(extensionUri, ...segments);
        commands.executeCommand('vscode.open', fileUri);
    }

    // --- Instance Methods ---

    public constructor(config: WorkspaceConfiguration, pickList?: QuickPick<ImgItem>) {
        this.config = config;
        this.imgPath = config.imagePath;
        this.opacity = config.opacity;
        this.sizeModel = config.sizeModel || 'cover';
        this.imageFileType = 0;
        this.blur = config.blur;

        if (pickList) {
            this.quickPick = pickList;
            this.quickPick.onDidAccept((e: any) => {
                if (this.quickPick.selectedItems.length > 0) {
                    this.handleAction(
                        this.quickPick.selectedItems[0].imageType,
                        this.quickPick.selectedItems[0].path
                    );
                }
            });
            this.quickPick.onDidHide(() => {
                this.dispose();
            }, null, this._disposables);
            this.quickPick.show();
        }
    }

    public getMainMenuItems(): ImgItem[] {
        const items: ImgItem[] = [];

        items.push(
            { label: 'Image Source / 图片来源', kind: QuickPickItemKind.Separator, imageType: 0 },
            { label: '$(file-media) Select Pictures', detail: '选择一张背景图', imageType: ActionType.SelectPictures },
            { label: '$(file-directory) Add Directory', detail: '添加图片目录', imageType: ActionType.AddDirectory },
            { label: '$(pencil) Input : Path/Https', detail: '输入图片路径：本地/https/json(api)/html(a标签)/在线图库（帖子地址）', imageType: ActionType.InputPath },
            { label: '$(ports-open-browser-icon) Online images', detail: '在线图库', imageType: ActionType.OnlineImages, path: "https://vs.20988.xyz/d/24-bei-jing-tu-tu-ku" }
        );

        const context = getContext();
        const onlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
        if (onlineFolder) {
            items.push({ label: '$(cloud-download) Refresh Online Folder', detail: '刷新在线文件夹图片列表', imageType: ActionType.RefreshOnlineFolder });
        }

        items.push(
            { label: 'Appearance / 外观设置', kind: QuickPickItemKind.Separator, imageType: 0 },
            { label: '$(settings) Background Opacity', detail: '更新图片不透明度', imageType: ActionType.BackgroundOpacity },
            { label: '$(settings) Background Blur', detail: '模糊度', imageType: ActionType.BackgroundBlur },
            { label: '$(layout) Size Mode', detail: '尺寸适应模式 / size adaptive mode', imageType: ActionType.SizeModeMenu }
        );

        items.push({ label: 'Actions / 操作', kind: QuickPickItemKind.Separator, imageType: 0 });

        const autoStatus = this.config.get('autoStatus');
        const autoInterval = this.config.get('autoInterval', 0);
        const autoDesc = autoStatus 
            ? `ON (Interval: ${autoInterval}s)` 
            : 'OFF';
        
        items.push({ 
            label: `$(sync) Auto Random: ${autoDesc}`, 
            detail: '设置自动更换间隔 (0表示关闭) / Set auto update interval (0 to disable)', 
            imageType: ActionType.AutoRandomSettings 
        });

        items.push(
            { label: '$(refresh) Refresh Background', detail: '刷新背景图 / Refresh background', imageType: ActionType.UpdateBackground },
            { label: '$(eye-closed) Closing Background', detail: '关闭背景图', imageType: ActionType.CloseBackground }
        );

        items.push(
            { label: 'Effects / 特效', kind: QuickPickItemKind.Separator, imageType: 0 },
            { label: '$(sparkle) Particle Effects🎉', detail: '粒子效果设置🎉', imageType: ActionType.ParticleSettings }
        );

        items.push(
            { label: 'About / 关于', kind: QuickPickItemKind.Separator, imageType: 0 },
            { label: '$(github) Github', detail: 'Github信息', imageType: ActionType.MoreMenu },
            { label: '$(heart) Support', detail: '请作者喝一杯咖啡吧~', imageType: ActionType.OpenFilePath, path: "//resources//support.jpg" },
            { label: '$(organization) Wechat', detail: '微信群聊~', imageType: ActionType.OpenFilePath, path: "//resources//wx.jpg" }
        );

        return items;
    }

    private showMainMenu() {
        this.quickPick.items = this.getMainMenuItems();
    }

    public async handleAction(type: ActionType, path?: string) {
        switch (type) {
            case ActionType.SelectPictures: this.quickPick ? this.showImageSelectionList() : await this.openFieldDialog(1); break;
            case ActionType.AddDirectory: await this.openFieldDialog(2); break;
            case ActionType.ManualSelection: await this.openFieldDialog(1); break;
            case ActionType.UpdateBackground: await this.updateBackgound(path); break;
            case ActionType.BackgroundOpacity: this.showOpacitySlider(); break;
            case ActionType.InputPath: this.showInputBox(InputType.Path); break;
            case ActionType.CloseBackground: await this.updateDom(true); break;
            case ActionType.ReloadWindow: commands.executeCommand('workbench.action.reloadWindow'); break;
            case ActionType.CloseMenu: this.quickPick.hide(); break;
            case ActionType.MoreMenu: this.showMoreMenu(); break;
            case ActionType.OpenExternalUrl: this.gotoPath(path); break;
            case ActionType.OpenFilePath: PickList.gotoFilePath(path); break;
            case ActionType.SizeModeMenu: this.showSizeModeMenu(); break;
            case ActionType.SetSizeMode: this.setSizeModel(path); break;
            case ActionType.OnlineImages: commands.executeCommand('workbench.view.extension.backgroundCover-explorer'); break;
            case ActionType.BackgroundBlur: this.showBlurSlider(); break;
            case ActionType.RefreshOnlineFolder: await this.refreshOnlineFolder(); break;
            case ActionType.AutoRandomSettings: this.showInputBox(InputType.AutoRandomSettings); break;
            case ActionType.OpenCacheFolder: this.openCacheFolder(); break;
            
            // Particle Effects
            case ActionType.ParticleSettings: this.particleEffectSettings(); break;
            case ActionType.ToggleParticle: this.toggleParticleEffect(); break;
            case ActionType.ParticleOpacity: this.showInputBox(InputType.ParticleOpacity); break;
            case ActionType.ParticleColor: this.showColorSelection(); break;
            case ActionType.ParticleCount: this.showInputBox(InputType.ParticleCount); break;
            case ActionType.SetParticleColor: if (path) { this.setContextValue('backgroundCoverParticleColor', Color(path), true); } break;
            case ActionType.InputParticleColor: this.showInputBox(InputType.ParticleColor); break;
            
            // Pet Assistant
            case ActionType.SelectPet: this.showPetSelection(); break;
            case ActionType.TogglePet: this.togglePet(); break;

            default: break;
        }
    }

    public getPetSelectionItems(): ImgItem[] {
        const currentPet = getContext().globalState.get('backgroundCoverPetType', 'akita');
        return getAllPets().map(p => ({
            label: `$(github) ${p.label}`,
            detail: `${p.desc} ${currentPet === p.value ? '$(check)' : ''}`,
            imageType: ActionType.SelectPet,
            path: p.value
        }));
    }

    private showPetSelection() {
        this.quickPick.items = this.getPetSelectionItems();
        this.quickPick.onDidAccept(() => {
            if (this.quickPick.selectedItems.length > 0) {
                const selected = this.quickPick.selectedItems[0];
                if (selected.path) {
                    this.setContextValue('backgroundCoverPetType', selected.path, true);
                    this.quickPick.hide();
                }
            }
        });
        this.quickPick.show();
    }

    private togglePet() {
        const currentValue = getContext().globalState.get('backgroundCoverPetEnabled', false);
        this.setContextValue('backgroundCoverPetEnabled', !currentValue, true);
    }

    private gotoPath(path?: string) {
        if (path == undefined) { return window.showWarningMessage('无效菜单'); }
        env.openExternal(Uri.parse(path));
    }

    public getMoreMenuItems(): ImgItem[] {
        return [
            { label: '$(github) Repository', detail: '仓库地址', imageType: ActionType.OpenExternalUrl, path: "https://github.com/AShujiao/vscode-background-cover" },
            { label: '$(issues) Issues', detail: '有疑问就来提问', imageType: ActionType.OpenExternalUrl, path: "https://github.com/AShujiao/vscode-background-cover/issues" },
            { label: '$(star) Star', detail: '给作者点个Star吧', imageType: ActionType.OpenExternalUrl, path: "https://github.com/AShujiao/vscode-background-cover" }
        ];
    }

    private showMoreMenu() {
        this.quickPick.items = this.getMoreMenuItems();
        this.quickPick.show();
    }

    public getSizeModeMenuItems(): ImgItem[] {
        const modes = [
            { label: 'cover (default)', value: 'cover', desc: '填充(默认)' },
            { label: 'repeat', value: 'repeat', desc: '平铺' },
            { label: 'contain', value: 'contain', desc: '拉伸' },
            { label: 'center', value: 'center', desc: '居中' },
            { label: 'not(center)', value: 'not_center', desc: '无适应(居中)' },
            { label: 'not(right_bottom)', value: 'not_right_bottom', desc: '无适应(右下角)' },
            { label: 'not(right_top)', value: 'not_right_top', desc: '无适应(右上角)' },
            { label: 'not(left)', value: 'not_left', desc: '无适应(靠左)' },
            { label: 'not(right)', value: 'not_right', desc: '无适应(靠右)' },
            { label: 'not(top)', value: 'not_top', desc: '无适应(靠上)' },
            { label: 'not(bottom)', value: 'not_bottom', desc: '无适应(靠下)' },
        ];

        return modes.map(m => ({
            label: `$(layout) ${m.label}`,
            detail: `${m.desc} ${this.sizeModel == m.value ? '$(check)' : ''}`,
            imageType: ActionType.SetSizeMode,
            path: m.value
        }));
    }

    private showSizeModeMenu() {
        this.quickPick.items = this.getSizeModeMenuItems();
        this.quickPick.show();
    }

    public getParticleEffectMenuItems(): ImgItem[] {
        const enabled = getContext().globalState.get('backgroundCoverParticleEffect', false);
        return [
            {
                label: enabled ? '$(circle-filled) Disable Particles' : '$(circle-outline) Enable Particles',
                detail: enabled ? '关闭粒子效果' : '启用粒子效果',
                imageType: ActionType.ToggleParticle
            },
            { label: '$(settings) Particle Opacity', detail: '设置粒子透明度', imageType: ActionType.ParticleOpacity },
            { label: '$(symbol-color) Select Color', detail: '选择粒子颜色', imageType: ActionType.ParticleColor },
            { label: '$(multiple-windows) Particle Count', detail: '设置粒子数量', imageType: ActionType.ParticleCount },
        ];
    }

    public particleEffectSettings() {
        this.quickPick.items = this.getParticleEffectMenuItems();
        this.quickPick.show();
    }

    private toggleParticleEffect() {
        const currentValue = getContext().globalState.get('backgroundCoverParticleEffect', false);
        this.setContextValue('backgroundCoverParticleEffect', !currentValue, true);
    }

    public getColorSelectionItems(): ImgItem[] {
        const items: ImgItem[] = [];
        items.push({ label: '$(pencil) Custom Color', detail: '输入自定义RGB颜色 (例如: 255,255,255)', imageType: ActionType.InputParticleColor });
        
        const colorList = getColorList();
        for (const colorName of colorList) {
            items.push({
                label: `$(symbol-color) ${colorName}`,
                imageType: ActionType.SetParticleColor,
                path: colorName
            });
        }
        return items;
    }

    private showColorSelection() {
        this.quickPick.items = this.getColorSelectionItems();
        this.quickPick.show();
    }

    private dispose() {
        PickList.itemList = undefined;
        this.quickPick.hide();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) { x.dispose(); }
        }
    }

    private async autoUpdateBackground(persist: boolean = true): Promise<boolean> {
        const context = getContext();
        const onlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
        const cachedImages = context.globalState.get<string[]>('backgroundCoverOnlineImageList');
        
        if (onlineFolder && this.isOnlineUrl(onlineFolder)) {
            try {
                let images = cachedImages as string[] | undefined;
                if (!images || images.length === 0) {
                    if (persist) {
                        window.showInformationMessage('正在从在线文件夹获取图片列表...');
                    }
                    images = await OnlineImageHelper.getOnlineImages(onlineFolder);
                    context.globalState.update('backgroundCoverOnlineImageList', images);
                }
                if (images && images.length > 0) {
                    const randomImage = images[Math.floor(Math.random() * images.length)];
                    if (persist) {
                        this.handleAction(ActionType.UpdateBackground, randomImage);
                    } else {
                        await this.updateBackgound(randomImage, false, false);
                    }
                    return true;
                }
            } catch (error: any) {
                console.error('从在线文件夹获取图片失败:', error);
                if (persist) {
                    window.showWarningMessage('在线文件夹访问失败，请检查网络连接！');
                }
                this.clearOnlineFolder(true);
            }
        }

        const singleSource = context.globalState.get<string>('backgroundCoverSingleImageSource');
        if (singleSource && this.isOnlineUrl(singleSource)) {
            if (persist) {
                this.handleAction(ActionType.UpdateBackground, singleSource);
            } else {
                await this.updateBackgound(singleSource, false, false);
            }
            return true;
        }

        const randomImageFolder = this.config.get<string>('randomImageFolder');
        if (randomImageFolder && this.checkFolder(randomImageFolder)) {
            const files = this.getFolderImgList(randomImageFolder);
            if (files.length > 0) {
                const randomFile = files[Math.floor(Math.random() * files.length)];
                const file = path.join(randomImageFolder, randomFile);
                if (persist) {
                    this.handleAction(ActionType.UpdateBackground, file);
                } else {
                    await this.updateBackgound(file, false, false);
                }
            }
        }
        return true;
    }

    private openCacheFolder() {
        const context = getContext();
        const cacheDir = path.join(context.globalStorageUri.fsPath, 'images');
        // 确保目录存在
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
        env.openExternal(Uri.file(cacheDir));
    }

    private async refreshOnlineFolder() {
        const context = getContext();
        const onlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
        if (!onlineFolder) {
            window.showWarningMessage('未找到在线文件夹配置！');
            return;
        }
        let success = false;
        try {
            window.showInformationMessage('正在刷新在线文件夹图片列表...');
            const images = await OnlineImageHelper.getOnlineImages(onlineFolder);
            if (images && images.length > 0) {
                const normalizedFolder = this.normalizePathKey(onlineFolder);
                if (images.length === 1 && this.normalizePathKey(images[0]) === normalizedFolder) {
                    window.showInformationMessage('检测到链接仅返回单张图片，已切换为单图模式。');
                    this.updateBackgound(images[0], true);
                    success = true;
                } else {
                    context.globalState.update('backgroundCoverOnlineImageList', images);
                    window.showInformationMessage(`刷新成功！发现 ${images.length} 张图片。`);
                    const randomImage = images[Math.floor(Math.random() * images.length)];
                    this.updateBackgound(randomImage);
                    success = true;
                }
            } else {
                window.showWarningMessage('未在该URL找到图片！');
                this.clearOnlineFolder(true);
            }
        } catch (error: any) {
            window.showErrorMessage(`刷新失败: ${error.message}`);
            this.clearOnlineFolder(true);
        }
        if (success) { this.quickPick.hide(); }
    }

    private clearOnlineFolder(resetRandomFolder: boolean = false) {
        const context = getContext();
        const previousOnlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
        context.globalState.update('backgroundCoverOnlineFolder', undefined);
        context.globalState.update('backgroundCoverOnlineImageList', undefined);
        if (resetRandomFolder && previousOnlineFolder) {
            const currentRandomFolder = this.config.get<string>('randomImageFolder');
            if (this.normalizePathKey(currentRandomFolder) === this.normalizePathKey(previousOnlineFolder)) {
                this.config.update('randomImageFolder', '', ConfigurationTarget.Global);
            }
        }
    }

    private normalizePathKey(value?: string | null): string {
        if (!value) { return ''; }
        const trimmed = value.trim();
        if (/^https?:/i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
                const search = parsed.search ?? '';
                return `${parsed.protocol}//${parsed.host}${normalizedPath}${search}`;
            } catch {
                return trimmed.replace(/\/+$/, '');
            }
        }
        return path.normalize(trimmed).replace(/\\+/g, '/');
    }

    private isOnlineUrl(url?: string): boolean {
        if (!url) { return false; }
        const lower = url.toLowerCase();
        return lower.startsWith('http://') || lower.startsWith('https://');
    }

    private showImageSelectionList(folderPath?: string) {
        let items: ImgItem[] = [{
            label: '$(diff-added) Manual selection',
            detail: '选择一张背景图',
            imageType: ActionType.ManualSelection
        }];

        const randomPath: any = folderPath ? folderPath : this.config.get<string>('randomImageFolder');
        if (this.checkFolder(randomPath)) {
            const files = this.getFolderImgList(randomPath);
            if (files.length > 0) {
                const randomFile = files[Math.floor(Math.random() * files.length)];
                items.push({
                    label: '$(light-bulb) Random pictures',
                    detail: '随机自动选择       ctrl+shift+F7',
                    imageType: ActionType.UpdateBackground,
                    path: path.join(randomPath, randomFile)
                });
                items.push({ label: '', description: '', imageType: 0, kind: QuickPickItemKind.Separator });

                // Build per-file metadata (size, mtime) once
                const meta = new Map<string, { size: number; mtime: number }>();
                for (const f of files) {
                    try {
                        const st = fs.statSync(path.join(randomPath, f));
                        meta.set(f, { size: st.size, mtime: st.mtimeMs });
                    } catch {
                        meta.set(f, { size: 0, mtime: 0 });
                    }
                }

                // Current image (so we can mark it with a check)
                const currentImg = (this.config.get<string>('imagePath') || '').toLowerCase();
                const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();

                // Most-recently-used list (kept in globalState, capped at 5)
                const context = getContext();
                const recent = context.globalState.get<string[]>('backgroundCoverRecentImages', []) || [];
                const recentSet = new Set(recent.map((r) => normalize(r)));

                const isCurrent = (f: string) => normalize(path.join(randomPath, f)) === normalize(currentImg);
                const isRecent  = (f: string) => recentSet.has(normalize(path.join(randomPath, f)));

                // Bucket: current first, then recent (preserving recency order), then the rest alphabetically.
                const current = files.filter(isCurrent);
                const recentBucket = recent
                    .map((full) => files.find((f) => normalize(path.join(randomPath, f)) === normalize(full)))
                    .filter((f): f is string => !!f && !isCurrent(f));
                const restBucket = files
                    .filter((f) => !isCurrent(f) && !isRecent(f))
                    .sort((a, b) => a.localeCompare(b));
                const ordered = [...current, ...recentBucket, ...restBucket];

                const toItem = (f: string): ImgItem => {
                    const m = meta.get(f) || { size: 0, mtime: 0 };
                    const sizeStr = this.formatFileSize(m.size);
                    const tags: string[] = [];
                    if (isCurrent(f)) { tags.push('$(check) current'); }
                    if (isRecent(f) && !isCurrent(f)) { tags.push('$(history) recent'); }
                    const isVideo = this.isVideoFile(f);
                    const fullPath = path.join(randomPath, f);
                    // Videos: keep $(file-media) text icon (no per-file thumbnail).
                    // Images: pass Uri.file(...) as iconPath so VS Code renders a 16px thumbnail.
                    const icon = isVideo
                        ? '$(file-media)'
                        : (isCurrent(f) ? '$(check)' : '');
                    const labelText = icon ? `${icon} ${f}` : f;
                    const detailText = `${sizeStr}${tags.length ? '   ' + tags.join('  ') : ''}`;
                    return new ImgItem(
                        labelText,
                        detailText,
                        ActionType.UpdateBackground,
                        fullPath,
                        isVideo ? undefined : Uri.file(fullPath)
                    );
                };

                items = items.concat(ordered.map(toItem));
            }
        }

        // --- Live preview wiring: hovering an item temporarily applies it ---
        const originalImg = this.imgPath;
        let committed = false;
        let previewTimer: NodeJS.Timeout | undefined;

        this.quickPick.onDidChangeActive((active: ImgItem[]) => {
            if (!active || active.length === 0) { return; }
            const a = active[0];
            if (!a.path || a.imageType !== ActionType.UpdateBackground) { return; }
            // Skip preview for video files — switching video sources is heavier.
            if (this.isVideoFile(a.path)) { return; }
            if (previewTimer) { clearTimeout(previewTimer); }
            previewTimer = setTimeout(() => {
                this.applyImagePreview(a.path!);
            }, 120);
        });

        this.quickPick.onDidAccept(() => {
            committed = true;
            if (previewTimer) { clearTimeout(previewTimer); }
        });

        this.quickPick.onDidHide(async () => {
            if (previewTimer) { clearTimeout(previewTimer); }
            if (!committed && originalImg && originalImg !== this.imgPath) {
                await this.applyImagePreview(originalImg);
            }
        });

        this.quickPick.items = items;
        this.quickPick.show();
    }

    /** Live-preview an image (no persistence) by swapping imgPath and re-rendering. */
    private async applyImagePreview(filePath: string): Promise<void> {
        if (!filePath) { return; }
        this.imgPath = filePath;
        try {
            await this.updateDom();
        } catch (e) {
            console.error('[BackgroundCover] image preview failed:', e);
        }
    }

    /** Common video file extensions used by the extension. */
    private isVideoFile(f: string): boolean {
        const lower = f.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg') || lower.endsWith('.mov');
    }

    /** Push a path to the front of the recent-used list (globalState), keep at most 5. */
    private pushRecentImage(filePath: string): void {
        try {
            if (!filePath) { return; }
            const context = getContext();
            const normalize = (p: string) => p.replace(/\\/g, '/').toLowerCase();
            const prev = context.globalState.get<string[]>('backgroundCoverRecentImages', []) || [];
            const next = [filePath, ...prev.filter((p) => normalize(p) !== normalize(filePath))].slice(0, 20);
            context.globalState.update('backgroundCoverRecentImages', next);
        } catch (e) {
            console.warn('[BackgroundCover] pushRecentImage failed:', e);
        }
    }

    /** Pretty-print byte size into KB/MB. */
    private formatFileSize(bytes: number): string {
        if (!bytes || bytes < 1024) { return `${bytes}B`; }
        if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)}KB`; }
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    public static listFolderImages(pathUrl: string): string[] {
        if (!pathUrl || pathUrl === '') { return []; }
        return fs.readdirSync(path.resolve(pathUrl)).filter((s) => {
            // 增加视频文件 '.mp4', '.webm', '.ogg', '.mov'
            return s.endsWith('.png') || s.endsWith('.PNG') || s.endsWith('.jpg') || s.endsWith('.JPG')
                || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.bmp')
                || s.endsWith('.jfif') || s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.ogg') || s.endsWith('.mov');
        });
    }

    private getFolderImgList(pathUrl: string): string[] {
        return PickList.listFolderImages(pathUrl);
    }

    private checkFolder(folderPath: string) {
        if (!folderPath) { return false; }
        const fsStatus = fs.existsSync(path.resolve(folderPath));
        if (!fsStatus) { return false; }
        const stat = fs.statSync(folderPath);
        return stat.isDirectory();
    }

    /**
     * Show an opacity slider with live preview.
     * Arrow keys preview each preset instantly; Enter commits; ESC restores.
     */
    private showOpacitySlider() {
        const presets: { value: number; label: string }[] = [
            { value: 0,    label: '0%   (Off / 关闭)' },
            { value: 0.05, label: '5%' },
            { value: 0.1,  label: '10%' },
            { value: 0.15, label: '15%' },
            { value: 0.2,  label: '20%  (Default / 默认)' },
            { value: 0.25, label: '25%' },
            { value: 0.3,  label: '30%' },
            { value: 0.4,  label: '40%' },
            { value: 0.5,  label: '50%' },
            { value: 0.6,  label: '60%' },
            { value: 0.7,  label: '70%' },
            { value: 0.8,  label: '80%  (Max / 最大)' },
        ];
        this.showSliderPicker(
            'opacity',
            this.opacity,
            presets,
            'Background Opacity / 背景透明度（←→ 预览，Enter 确认，ESC 还原）'
        );
    }

    /**
     * Show a blur slider with live preview.
     */
    private showBlurSlider() {
        const presets: { value: number; label: string }[] = [
            { value: 0,   label: '0px   (Off / 关闭)' },
            { value: 2,   label: '2px' },
            { value: 5,   label: '5px' },
            { value: 10,  label: '10px' },
            { value: 20,  label: '20px' },
            { value: 30,  label: '30px' },
            { value: 50,  label: '50px' },
            { value: 80,  label: '80px' },
            { value: 100, label: '100px (Max / 最大)' },
        ];
        this.showSliderPicker(
            'blur',
            this.blur,
            presets,
            'Background Blur / 背景模糊度（←→ 预览，Enter 确认，ESC 还原）'
        );
    }

    /**
     * Reusable slider-style picker with live preview & restore-on-cancel.
     */
    private showSliderPicker(
        configKey: 'opacity' | 'blur',
        originalValue: number,
        presets: { value: number; label: string }[],
        placeholder: string
    ) {
        // Hide the parent invoker quickPick (if any) so only the slider is on screen.
        if (this.quickPick) {
            try { this.quickPick.hide(); } catch { /* ignored */ }
        }

        const picker = window.createQuickPick<ImgItem>();
        picker.placeholder = placeholder;
        picker.matchOnDescription = false;
        picker.matchOnDetail = false;
        picker.ignoreFocusOut = false;

        const items: ImgItem[] = presets.map((p) => ({
            label: p.label,
            description: p.value === originalValue ? '$(check) current / 当前' : '',
            detail: this.renderSliderBar(p.value, presets[presets.length - 1].value),
            imageType: 0,
            path: String(p.value),
        }));
        picker.items = items;

        // Pre-select the row matching the current value (if any).
        const activeItem = items.find((it) => Number(it.path) === originalValue);
        if (activeItem) {
            picker.activeItems = [activeItem];
        }

        // Debounced live preview as the user moves the highlight.
        let previewTimer: NodeJS.Timeout | undefined;
        let committed = false;

        picker.onDidChangeActive((active) => {
            if (!active || active.length === 0) { return; }
            const v = Number(active[0].path);
            if (Number.isNaN(v)) { return; }
            if (previewTimer) { clearTimeout(previewTimer); }
            previewTimer = setTimeout(() => {
                this.applyPreview(configKey, v);
            }, 80);
        });

        picker.onDidAccept(async () => {
            const selected = picker.selectedItems[0];
            if (!selected) { return; }
            const v = Number(selected.path);
            if (Number.isNaN(v)) { return; }
            committed = true;
            if (previewTimer) { clearTimeout(previewTimer); }
            picker.hide();
            await this.setConfigValue(configKey, v, true);
        });

        picker.onDidHide(async () => {
            if (previewTimer) { clearTimeout(previewTimer); }
            // ESC / focus loss without commit: restore original look.
            if (!committed) {
                await this.applyPreview(configKey, originalValue);
            }
            picker.dispose();
        });

        picker.show();
    }

    /** Apply opacity/blur for live preview without touching settings.json. */
    private async applyPreview(configKey: 'opacity' | 'blur', value: number): Promise<void> {
        if (configKey === 'opacity') {
            this.opacity = value;
        } else {
            this.blur = value;
        }
        try {
            await this.updateDom();
        } catch (e) {
            console.error('[BackgroundCover] preview failed:', e);
        }
    }

    /** Render a 12-cell unicode bar e.g. ████░░░░░░░░ for the slider detail row. */
    private renderSliderBar(value: number, max: number): string {
        const cells = 16;
        const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
        const filled = Math.round(ratio * cells);
        return '█'.repeat(filled) + '░'.repeat(cells - filled) + `  ${value}`;
    }

    private async showInputBox(type: InputType) {
        const context = getContext();
        let placeString = '';
        let promptString = '';

        switch (type) {
            case InputType.Path:
                placeString = 'Please enter the image path to support local and HTTPS';
                promptString = '输入图片路径：支持本地/https/json(api接口)/html(解析a标签)/在线图库（帖子地址）';
                break;
            case InputType.Opacity:
                placeString = 'Opacity ranges：0.00 - 1,current:(' + this.opacity + ')';
                promptString = '设置图片不透明度：0 - 0.8,当前值：' + this.opacity;
                break;
            case InputType.Blur:
                placeString = 'Set image blur: 0-100,current:(' + this.blur + ')';
                promptString = '设置图片模糊度：0 - 100,当前值：' + this.blur;
                break;
            case InputType.AutoRandomSettings:
                placeString = 'Auto update current:(' + this.config.get('autoInterval', 0) + ')';
                promptString = '设置自动更换间隔(秒)，0表示关闭自动定时更换 / Set interval (0 to disable)';
                break;
            case InputType.ParticleOpacity:
                placeString = 'Particle opacity (0.1 - 1),current:(' + context.globalState.get("backgroundCoverParticleOpacity") + ')';
                promptString = '粒子透明度 (0.1 - 1),当前值：' + context.globalState.get("backgroundCoverParticleOpacity");
                break;
            case InputType.ParticleColor:
                placeString = 'Particle color (e.g.:255,255,255),current:(' + context.globalState.get("backgroundCoverParticleColor") + ')';
                promptString = '粒子颜色 (例如:255,255,255),当前值：' + context.globalState.get("backgroundCoverParticleColor");
                break;
            case InputType.ParticleCount:
                placeString = 'Particle count (1 - 200),current:(' + context.globalState.get("backgroundCoverParticleCount") + ')';
                promptString = '粒子数量 (1 - 200),当前值：' + context.globalState.get("backgroundCoverParticleCount");
                break;
        }

        const option: InputBoxOptions = {
            ignoreFocusOut: true,
            password: false,
            placeHolder: placeString,
            prompt: promptString
        };

        let value = await window.showInputBox(option);
        if (!value) {
            window.showWarningMessage('Please enter configuration parameters / 请输入配置参数！');
            return false;
        }

        let shouldClearOnlineCache = false;

        if (type === InputType.Path) {
            const fsStatus = fs.existsSync(path.resolve(value));
            const isUrl = (value.slice(0, 8).toLowerCase() === 'https://') || (value.slice(0, 7).toLowerCase() === 'http://');
            if (!fsStatus && !isUrl) {
                window.showWarningMessage('No access to the file or the file does not exist! / 无权限访问文件或文件不存在！');
                return false;
            }
            if (!isUrl) { shouldClearOnlineCache = true; }

            if (isUrl) {
                let shouldReturn = false;
                await window.withProgress({
                    location: ProgressLocation.Notification,
                    title: "正在检测在线资源类型... / Detecting online resource type...",
                    cancellable: false
                }, async () => {
                    try {
                        const images = await OnlineImageHelper.getOnlineImages(value!);
                        if (images && images.length > 1) {
                            const config = workspace.getConfiguration('backgroundCover');
                            PickList.itemList = new PickList(config);
                            PickList.itemList.setImageFileType(2);
                            const context = getContext();
                            await context.globalState.update('backgroundCoverOnlineFolder', value);
                            await context.globalState.update('backgroundCoverOnlineImageList', images);
                            await config.update('randomImageFolder', value, ConfigurationTarget.Global);
                            const randomImage = images[Math.floor(Math.random() * images.length)];
                            PickList.itemList.updateBackgound(randomImage);
                            shouldReturn = true;
                        } else if (images && images.length === 1) {
                            value = images[0];
                            shouldClearOnlineCache = true;
                        }
                    } catch (err: any) {
                        console.error('[background-cover] OnlineImageHelper error:', err && err.message ? err.message : err);
                        window.showWarningMessage('在线资源检测失败，按单张图片处理 / Online detection failed, treating as single image');
                        shouldClearOnlineCache = true;
                    }
                });
                if (shouldReturn) { return true; }
            } else {
                shouldClearOnlineCache = true;
            }
        } else if (type === InputType.Opacity) {
            const isOpacity = parseFloat(value);
            if (isOpacity < 0 || isOpacity > 0.8 || isNaN(isOpacity)) {
                window.showWarningMessage('Opacity ranges in：0 - 0.8！');
                return false;
            }
        } else if (type === InputType.Blur) {
            const blur = parseFloat(value);
            if (blur < 0 || blur > 100 || isNaN(blur)) {
                window.showWarningMessage('Blur ranges in：0 - 100！');
                return false;
            }
        } else if (type === InputType.AutoRandomSettings) {
            const interval = parseInt(value);
            if (interval < 0 || isNaN(interval)) {
                window.showWarningMessage('Interval must be >= 0!');
                return false;
            }
        } else if (type === InputType.ParticleOpacity) {
            const particleOpacity = parseFloat(value);
            if (particleOpacity < 0 || particleOpacity > 1 || isNaN(particleOpacity)) {
                window.showWarningMessage('粒子透明度范围：0 - 1！');
                return false;
            }
        } else if (type === InputType.ParticleColor) {
            if (!value.includes(',')) {
                window.showWarningMessage('颜色格式无效，请使用RGB(255,255,255)格式！');
                return false;
            }
        } else if (type === InputType.ParticleCount) {
            const particleCount = parseInt(value);
            if (particleCount < 1 || particleCount > 200 || isNaN(particleCount)) {
                window.showWarningMessage('粒子数量范围：1 - 200！');
                return false;
            }
        }

        if (type === InputType.Path && shouldClearOnlineCache) {
            this.clearOnlineFolder(true);
        }

        if (type === InputType.Path) {
            return this.updateBackgound(value, shouldClearOnlineCache);
        } else if (type === InputType.ParticleCount) {
            this.setContextValue('backgroundCoverParticleCount', parseInt(value), true);
        } else if (type === InputType.ParticleColor) {
            this.setContextValue('backgroundCoverParticleColor', value, true);
        } else if (type === InputType.ParticleOpacity) {
            this.setContextValue('backgroundCoverParticleOpacity', parseFloat(value), true);
        } else if (type === InputType.Opacity) {
            await this.setConfigValue('opacity', parseFloat(value), true);
        } else if (type === InputType.Blur) {
            await this.setConfigValue('blur', parseFloat(value), true);
        } else if (type === InputType.AutoRandomSettings) {
            const interval = parseInt(value);
            if (interval > 0) {
                const context = getContext();
                const hasRandomFolder = this.config.get('randomImageFolder');
                const hasOnlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
                const hasSingleSource = context.globalState.get('backgroundCoverSingleImageSource');
                if (!hasRandomFolder && !hasOnlineFolder && !hasSingleSource) {
                    window.showWarningMessage('Please add a directory first! / 请先添加目录！');
                    return false;
                }
                await this.setConfigValue('autoInterval', interval, false);
                await this.setConfigValue('autoStatus', true, false);
                await this.autoUpdateBackground();
            } else {
                await this.setConfigValue('autoStatus', false, false);
                await this.setConfigValue('autoInterval', 0, false);
            }
        }
    }

    private async setSizeModel(value?: string) {
        if (!value) { return vsHelp.showInfo('No parameter value was obtained / 未获取到参数值'); }
        await this.setConfigValue('sizeModel', value, true);
    }

    public setImageFileType(value: number) {
        this.imageFileType = value;
    }

    public async updateBackgound(path?: string, clearOnlineCache: boolean = false, persist: boolean = true) {
        if (!path) { path = this.config.get<string>('imagePath'); }
        if (!path) { return vsHelp.showInfo('Unfetched Picture Path / 未获取到图片路径'); }

        // Large local-file pre-check: warn user before applying anything > 5MB so
        // they don't get blindsided by a multi-second freeze on switch.
        if (persist && !this.isOnlineUrl(path)) {
            const proceed = await this.confirmLargeLocalImage(path);
            if (!proceed) { return false; }
        }

        // Record into the most-recently-used list (for QuickPick reordering).
        if (persist) { this.pushRecentImage(path); }

        if (clearOnlineCache || !this.isOnlineUrl(path)) {
            this.clearOnlineFolder(true);
        }
        const shouldDisableAuto = persist && clearOnlineCache && this.isSingleImagePath(path);
        await this.setConfigValue('imagePath', path, true, persist);
        if (shouldDisableAuto) {
            await this.disableAutoRandomForSingleImage();
        }
    }

    /**
     * Warn before applying a >5MB local image; returns true if the user wants to proceed.
     */
    private async confirmLargeLocalImage(filePath: string): Promise<boolean> {
        try {
            if (!fs.existsSync(filePath)) { return true; }
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) { return true; }
            const sizeMB = stat.size / (1024 * 1024);
            if (sizeMB <= 5) { return true; }
            const sizeLabel = `${sizeMB.toFixed(1)}MB`;
            const choice = await window.showWarningMessage(
                `图片体积较大 (${sizeLabel})，应用时可能会出现短暂卡顿。是否继续？ / Large image (${sizeLabel}) may cause a brief stutter. Continue?`,
                'Continue / 继续', 'Cancel / 取消'
            );
            return choice === 'Continue / 继续';
        } catch (e) {
            console.warn('[BackgroundCover] confirmLargeLocalImage failed:', e);
            return true;
        }
    }

    private async openFieldDialog(type: number) {
        const isFolders = type === 1 ? false : true;
        const isFiles = type === 2 ? false : true;
        const filters = type === 1 ? { 'Images': ['png', 'jpg', 'gif', 'jpeg', 'jfif', 'webp', 'bmp', 'mp4', 'webm', 'ogg', 'mov'] } : undefined;
        const folderUris = await window.showOpenDialog({
            canSelectFolders: isFolders,
            canSelectFiles: isFiles,
            canSelectMany: false,
            openLabel: 'Select folder',
            filters: filters
        });
        if (!folderUris) { return false; }
        const fileUri = folderUris[0];
        if (type === 2) {
            this.clearOnlineFolder(true);
            await this.setConfigValue('randomImageFolder', fileUri.fsPath, false);
            if (this.quickPick) {
                return this.showImageSelectionList(fileUri.fsPath);
            }
            return true;
        }
        if (type === 1) {
            this.clearOnlineFolder(true);
            return this.updateBackgound(fileUri.fsPath, true);
        }
        return false;
    }

    private async setConfigValue(name: string, value: any, updateDom: Boolean = true, persist: boolean = true) {
        if (persist) {
            await this.config.update(name, value, ConfigurationTarget.Global);
            this.config = workspace.getConfiguration('backgroundCover');
        }
        if (name === 'imagePath') {
            const context = getContext();
            const hasOnlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
            if (typeof value === 'string' && value && this.isOnlineUrl(value) && !hasOnlineFolder) {
                context.globalState.update('backgroundCoverSingleImageSource', value);
            } else {
                context.globalState.update('backgroundCoverSingleImageSource', undefined);
            }
        }
        switch (name) {
            case 'opacity': this.opacity = value; break;
            case 'imagePath': this.imgPath = value; break;
            case 'sizeModel': this.sizeModel = value; break;
            case 'blur': this.blur = value; break;
            default: break;
        }
        if (updateDom) { await this.updateDom(); }
        return true;
    }

    private setContextValue(name: string, value: any, updateDom: Boolean = true) {
        getContext().globalState.update(name, value);
        onDidChangeGlobalState.fire();
        if (updateDom) { this.updateDom(); }
        return true;
    }

    private async disableAutoRandomForSingleImage(): Promise<void> {
        const autoStatus = this.config.get<boolean>('autoStatus');
        if (!autoStatus) {
            return;
        }
        await this.config.update('autoStatus', false, ConfigurationTarget.Global);
        this.config = workspace.getConfiguration('backgroundCover');
        window.showInformationMessage('检测到单张图片，已自动关闭自动更新功能。 / Detected single image source, auto update disabled.');
    }

    private isSingleImagePath(value: string): boolean {
        if (!value) {
            return false;
        }
        const sanitized = value.split('?')[0].split('#')[0];
        const ext = path.extname(sanitized).toLowerCase();
        if (!ext) {
            return false;
        }
        const singleExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.jfif', '.svg', '.mp4', '.webm', '.ogg', '.mov'];
        return singleExts.includes(ext);
    }

    public setRandUpdate(value: boolean) {
        this.randUpdate = value;
    }

    public setSkipOnlineCache(value: boolean) {
        this.skipOnlineCache = value;
    }

    private async updateDom(uninstall: boolean = false, colorThemeKind: string = ""): Promise<boolean> {
        if (colorThemeKind == "") {
            colorThemeKind = BlendHelper.autoBlendModel();
        }

        const context = getContext();
        context.globalState.update('backgroundCoverBlendModel', colorThemeKind);

        const seq = ++PickList._updateSeq;
        const isCurrentUpdate = () => seq === PickList._updateSeq;
        const dom = new FileDom(this.config, this.imgPath, this.opacity, this.sizeModel, this.blur, colorThemeKind, this.skipOnlineCache, isCurrentUpdate);
        let result = false;

        try {
            if (uninstall) {
                this.config.update("imagePath", "", ConfigurationTarget.Global);
                result = await dom.clearBackground();
            } else {
                result = await dom.install();
            }

            if (seq !== PickList._updateSeq) {
                console.log('[BackgroundCover] Ignoring stale background update result');
                return false;
            }

            if (result) {
                if (!dom.requiresReload) {
                    if (this.quickPick) {
                        this.quickPick.hide();
                    }
                    if (!dom.didUpdateCss) {
                        window.setStatusBarMessage('Background already up to date. / 背景已是最新。', 3000);
                        return false;
                    }
                    // Unique trigger per call so the MutationObserver in the
                    // injected loader always detects a DOM change (VSCode may
                    // skip mutation events if the text is identical).
                    PickList._reloadTriggerSeq += 1;
                    const triggerText = `background-cover-reload-trigger:${PickList._reloadTriggerSeq}`;
                    const triggerMsg = window.setStatusBarMessage(triggerText);

                    setTimeout(() => {
                        triggerMsg.dispose();
                        window.setStatusBarMessage('Background updated successfully! / 背景更新成功！', 5000);
                    }, 1000);

                    return false;
                }

                if (this.quickPick) {
                    this.quickPick.placeholder = 'Reloading takes effect? / 重新加载生效？';
                    this.quickPick.items = [
                        { label: '$(check) YES', detail: '立即重新加载窗口生效', imageType: ActionType.ReloadWindow },
                        { label: '$(x) NO', detail: '稍后手动重启', imageType: ActionType.CloseMenu }
                    ];
                    this.quickPick.ignoreFocusOut = true;
                    this.quickPick.show();
                } else {
                    if (this.imageFileType === 2) {
                        const value = await window.showInformationMessage(
                            `"${this.imgPath}" | Reloading takes effect? / 重新加载生效？`,
                            'YES', 'NO'
                        );
                        if (value === 'YES') {
                            await commands.executeCommand('workbench.action.reloadWindow');
                        }
                    }
                    if (this.randUpdate) {
                        window.showInformationMessage(`背景将在1秒后自动更新！ / The background will be automatically updated in 1 second!`);
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        await commands.executeCommand('workbench.action.reloadWindow');
                    }
                }
            }
        } catch (error: any) {
            await window.showErrorMessage(`更新失败: ${error.message}`);
        }
        return result && (dom.requiresReload || uninstall);
    }
}
