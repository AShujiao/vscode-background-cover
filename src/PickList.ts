import * as fs from 'fs';
import * as path from 'path';
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

export class PickList {
    public static itemList: PickList | undefined;
    private static intervalHandle: NodeJS.Timeout | undefined;

    private readonly quickPick: QuickPick<ImgItem> | any;
    private _disposables: Disposable[] = [];
    private config: WorkspaceConfiguration;
    private imgPath: string;
    private opacity: number;
    private imageFileType: number;
    private sizeModel: string;
    private blur: number;
    private randUpdate: boolean = false;

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
                commands.executeCommand('workbench.action.reloadWindow');
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
        PickList.itemList.autoUpdateBackground();
        PickList.itemList = undefined;
    }

    public static startAutoRandomTask() {
        const config = workspace.getConfiguration('backgroundCover');
        const autoStatus = config.get<boolean>('autoStatus');
        const interval = config.get<number>('autoInterval', 10);

        PickList.stopAutoRandomTask();

        if (autoStatus && interval > 0) {
            console.log(`[BackgroundCover] Starting auto update task. Interval: ${interval}s`);
            PickList.intervalHandle = setInterval(() => {
                const cfg = workspace.getConfiguration('backgroundCover');
                const context = getContext();
                const hasOnlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
                const hasSingleSource = context.globalState.get('backgroundCoverSingleImageSource');
                if (cfg.randomImageFolder || hasOnlineFolder || hasSingleSource) {
                    const pl = new PickList(cfg);
                    // Silent update: no persist, no UI messages
                    pl.autoUpdateBackground(false).catch(err => console.error(err));
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
        const extPath = extensions.getExtension("manasxx.background-cover")?.extensionPath;
        const tmpPath = "file:///" + extPath + path;
        const tmpurl = Uri.parse(tmpPath);
        commands.executeCommand('vscode.openFolder', tmpurl);
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

    public handleAction(type: ActionType, path?: string) {
        switch (type) {
            case ActionType.SelectPictures: this.showImageSelectionList(); break;
            case ActionType.AddDirectory: this.openFieldDialog(2); break;
            case ActionType.ManualSelection: this.openFieldDialog(1); break;
            case ActionType.UpdateBackground: this.updateBackgound(path); break;
            case ActionType.BackgroundOpacity: this.showInputBox(InputType.Opacity); break;
            case ActionType.InputPath: this.showInputBox(InputType.Path); break;
            case ActionType.CloseBackground: this.updateDom(true); break;
            case ActionType.ReloadWindow: commands.executeCommand('workbench.action.reloadWindow'); break;
            case ActionType.CloseMenu: this.quickPick.hide(); break;
            case ActionType.MoreMenu: this.showMoreMenu(); break;
            case ActionType.OpenExternalUrl: this.gotoPath(path); break;
            case ActionType.OpenFilePath: PickList.gotoFilePath(path); break;
            case ActionType.SizeModeMenu: this.showSizeModeMenu(); break;
            case ActionType.SetSizeMode: this.setSizeModel(path); break;
            case ActionType.OnlineImages: commands.executeCommand('workbench.view.extension.backgroundCover-explorer'); break;
            case ActionType.BackgroundBlur: this.showInputBox(InputType.Blur); break;
            case ActionType.RefreshOnlineFolder: this.refreshOnlineFolder(); break;
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
        const pets = [
            { label: 'Akita (Dog)', value: 'akita', desc: '秋田犬' },
            { label: 'Totoro', value: 'totoro', desc: '龙猫' },
            { label: 'Fox', value: 'fox', desc: '狐狸' },
            { label: 'Pika', value: 'pika', desc: '皮卡丘' },
            { label: 'Deno2', value: 'deno2', desc: '恐龙2' },
            { label: 'Clippy', value: 'clippy', desc: '大眼夹' },
            { label: 'Rubber Duck', value: 'rubber-duck', desc: '小黄鸭' },
            { label: 'Crab', value: 'crab', desc: '螃蟹' },
            { label: 'Zappy', value: 'zappy', desc: '闪电' },
            { label: 'Cockatiel', value: 'cockatiel', desc: '玄凤鹦鹉' },
            { label: 'Snake', value: 'snake', desc: '蛇' },
            { label: 'Chicken', value: 'chicken', desc: '鸡' },
            { label: 'Turtle', value: 'turtle', desc: '乌龟' },
            { label: 'Panda', value: 'panda', desc: '熊猫' },
            { label: 'Snail', value: 'snail', desc: '蜗牛' },
            { label: 'Deno', value: 'deno', desc: '恐龙' },
            { label: 'Morph', value: 'morph', desc: 'Morph' },
        ];

        return pets.map(p => ({
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
                        this.updateBackgound(randomImage, false, false);
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
                this.updateBackgound(singleSource, false, false);
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
                    this.updateBackgound(file, false, false);
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
                items = items.concat(files.map(
                    (e) => new ImgItem('$(tag) ' + e, e, ActionType.UpdateBackground, path.join(randomPath, e))
                ));
            }
        }
        this.quickPick.items = items;
        this.quickPick.show();
    }

    private getFolderImgList(pathUrl: string): string[] {
        if (!pathUrl || pathUrl === '') { return []; }
        return fs.readdirSync(path.resolve(pathUrl)).filter((s) => {
            // 增加视频文件 '.mp4', '.webm', '.ogg', '.mov'
            return s.endsWith('.png') || s.endsWith('.PNG') || s.endsWith('.jpg') || s.endsWith('.JPG')
                || s.endsWith('.jpeg') || s.endsWith('.gif') || s.endsWith('.webp') || s.endsWith('.bmp')
                || s.endsWith('.jfif') || s.endsWith('.mp4') || s.endsWith('.webm') || s.endsWith('.ogg') || s.endsWith('.mov');
        });
    }

    private checkFolder(folderPath: string) {
        if (!folderPath) { return false; }
        const fsStatus = fs.existsSync(path.resolve(folderPath));
        if (!fsStatus) { return false; }
        const stat = fs.statSync(folderPath);
        return stat.isDirectory();
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
        if (clearOnlineCache || !this.isOnlineUrl(path)) {
            this.clearOnlineFolder(true);
        }
        const shouldDisableAuto = persist && clearOnlineCache && this.isSingleImagePath(path);
        await this.setConfigValue('imagePath', path, true, persist);
        if (shouldDisableAuto) {
            await this.disableAutoRandomForSingleImage();
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
            this.setConfigValue('randomImageFolder', fileUri.fsPath, false);
            return this.showImageSelectionList(fileUri.fsPath);
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

    private async updateDom(uninstall: boolean = false, colorThemeKind: string = ""): Promise<boolean> {
        if (colorThemeKind == "") {
            colorThemeKind = BlendHelper.autoBlendModel();
        }

        const context = getContext();
        context.globalState.update('backgroundCoverBlendModel', colorThemeKind);

        const dom = new FileDom(this.config, this.imgPath, this.opacity, this.sizeModel, this.blur, colorThemeKind);
        let result = false;

        try {
            if (uninstall) {
                this.config.update("imagePath", "", ConfigurationTarget.Global);
                result = await dom.clearBackground();
            } else {
                result = await dom.install();
            }

            if (result) {
                if (!dom.requiresReload) {
                    if (this.quickPick) {
                        this.quickPick.hide();
                    }
                    const triggerMsg = window.setStatusBarMessage('background-cover-reload-trigger');
                    
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