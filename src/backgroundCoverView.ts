import * as vscode from 'vscode';
import { ActionType } from './PickList';
import { getContext } from './global';

// Localization
const messages = {
    en: {
        imageSource: 'Image Source',
        appearance: 'Appearance',
        autoRandom: 'Auto Random',
        particleEffects: 'Particle Effects',
        actions: 'Actions',
        currentImage: 'Current Image',
        selectImage: 'Select Image...',
        addDirectory: 'Add Directory...',
        inputPath: 'Input Path/URL...',
        opacity: 'Opacity',
        blur: 'Blur',
        sizeMode: 'Size Mode',
        blendMode: 'Blend Mode',
        enabled: 'Enabled',
        interval: 'Interval (s)',
        sourceFolder: 'Source Folder',
        openSettings: 'Open Settings...',
        toggleParticles: 'Toggle Particles',
        clearBackground: 'Clear Background',
        refresh: 'Refresh',
        refreshFolder: 'Refresh Online Folder',
        openCacheFolder: 'Open Cache Folder',
        supportAuthor: 'Support Author',
        setSizeMode: 'Set Size Mode',
        setBlendMode: 'Set Blend Mode',
        toggle: 'Toggle',
        notSet: 'Not Set',
        none: 'None'
    },
    zh: {
        imageSource: '图片来源',
        appearance: '外观设置',
        autoRandom: '自动随机',
        particleEffects: '粒子效果',
        actions: '操作',
        currentImage: '当前图片',
        selectImage: '选择图片/视频文件...',
        addDirectory: '添加目录...',
        inputPath: '输入路径/URL...',
        opacity: '透明度',
        blur: '模糊度',
        sizeMode: '尺寸模式',
        blendMode: '混合模式',
        enabled: '启用',
        interval: '间隔 (秒)',
        sourceFolder: '来源目录',
        openSettings: '打开设置...',
        toggleParticles: '切换粒子效果',
        clearBackground: '清除背景',
        refresh: '刷新',
        refreshFolder: '刷新在线文件夹',
        openCacheFolder: '打开缓存目录',
        supportAuthor: '支持作者',
        setSizeMode: '设置尺寸模式',
        setBlendMode: '设置混合模式',
        toggle: '切换',
        notSet: '未设置',
        none: '无'
    }
};

function t(key: keyof typeof messages.en): string {
    const lang = vscode.env.language;
    if (lang.startsWith('zh')) {
        return messages.zh[key];
    }
    return messages.en[key];
}

// Define a data structure for tree items
export class ConfigItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: 'group' | 'setting' | 'action' | 'value',
        public readonly key?: string, // Config key e.g. 'backgroundCover.opacity'
        public readonly value?: any, // Value for 'value' type items
        public readonly commandType?: ActionType, // For mapping to PickList actions
        public readonly description?: string,
        public readonly icon?: string
    ) {
        super(label, collapsibleState);
        this.contextValue = type;
        if (description) {
            this.description = description;
        }
        if (icon) {
            this.iconPath = new vscode.ThemeIcon(icon);
        }
    }
}

export class BackgroundCoverViewProvider implements vscode.TreeDataProvider<ConfigItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfigItem | undefined | void> = new vscode.EventEmitter<ConfigItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfigItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {
        // Listen to configuration changes to refresh the tree
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('backgroundCover')) {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfigItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ConfigItem): Thenable<ConfigItem[]> {
        const config = vscode.workspace.getConfiguration('backgroundCover');
        
        if (!element) {
            return Promise.resolve(this.getRootItems(config));
        }

        if (element.type === 'group') {
            return Promise.resolve(this.getGroupChildren(element, config));
        }

        if (element.type === 'setting' && element.key === 'backgroundCover.sizeModel') {
             return Promise.resolve(this.getSizeModeOptions(config));
        }
        
        if (element.type === 'setting' && element.key === 'backgroundCover.blendModel') {
             return Promise.resolve(this.getBlendModeOptions(config));
        }

        return Promise.resolve([]);
    }

    private getRootItems(config: vscode.WorkspaceConfiguration): ConfigItem[] {
        const items: ConfigItem[] = [];

        // 1. Image Source
        items.push(new ConfigItem(t('imageSource'), vscode.TreeItemCollapsibleState.Expanded, 'group', undefined, undefined, undefined, undefined, 'file-media'));

        // 2. Appearance
        items.push(new ConfigItem(t('appearance'), vscode.TreeItemCollapsibleState.Expanded, 'group', undefined, undefined, undefined, undefined, 'paintcan'));

        // 3. Auto Random
        items.push(new ConfigItem(t('autoRandom'), vscode.TreeItemCollapsibleState.Collapsed, 'group', undefined, undefined, undefined, undefined, 'sync'));

        // 4. Particle Effects
        items.push(new ConfigItem(t('particleEffects'), vscode.TreeItemCollapsibleState.Collapsed, 'group', undefined, undefined, undefined, undefined, 'sparkle'));

        // 5. Actions
        items.push(new ConfigItem(t('actions'), vscode.TreeItemCollapsibleState.Expanded, 'group', undefined, undefined, undefined, undefined, 'tools'));

        return items;
    }

    private getGroupChildren(element: ConfigItem, config: vscode.WorkspaceConfiguration): ConfigItem[] {
        const items: ConfigItem[] = [];

        const context = getContext();
        const onlineFolder = context?.globalState.get<string>('backgroundCoverOnlineFolder');

        if (element.label === t('imageSource')) {
            const currentPath = config.get<string>('imagePath') || t('none');
            const displayPath = currentPath.length > 30 ? '...' + currentPath.substr(-30) : currentPath;
            
            items.push(new ConfigItem(t('currentImage'), vscode.TreeItemCollapsibleState.None, 'value', undefined, undefined, undefined, displayPath, 'file'));
            
            items.push(this.createActionItem(t('selectImage'), ActionType.SelectPictures, 'folder-opened'));
            items.push(this.createActionItem(t('addDirectory'), ActionType.AddDirectory, 'file-directory'));
            items.push(this.createActionItem(t('inputPath'), ActionType.InputPath, 'link'));

            if (onlineFolder) {
                const displayOnlineFolder = onlineFolder.length > 30 ? '...' + onlineFolder.substr(-30) : onlineFolder;
                items.push(this.createActionItem(t('refreshFolder'), ActionType.RefreshOnlineFolder, 'cloud-download', displayOnlineFolder));
            }
        }

        if (element.label === t('appearance')) {
            items.push(this.createSettingItem(t('opacity'), 'backgroundCover.opacity', config.get('opacity'), ActionType.BackgroundOpacity, 'eye'));
            items.push(this.createSettingItem(t('blur'), 'backgroundCover.blur', config.get('blur'), ActionType.BackgroundBlur, 'blur'));
            
            items.push(new ConfigItem(t('sizeMode'), vscode.TreeItemCollapsibleState.Collapsed, 'setting', 'backgroundCover.sizeModel', config.get('sizeModel'), undefined, config.get('sizeModel'), 'layout'));
            items.push(new ConfigItem(t('blendMode'), vscode.TreeItemCollapsibleState.Collapsed, 'setting', 'backgroundCover.blendModel', config.get('blendModel'), undefined, config.get('blendModel'), 'symbol-color'));
        }

        if (element.label === t('autoRandom')) {
            const status = config.get<boolean>('autoStatus') || false;
            items.push(this.createToggleItem(t('enabled'), 'backgroundCover.autoStatus', status, 'play-circle'));
            items.push(this.createSettingItem(t('interval'), 'backgroundCover.autoInterval', config.get('autoInterval'), ActionType.AutoRandomSettings, 'watch'));
            
            const randomFolder = config.get<string>('randomImageFolder') || t('notSet');
            const displayFolder = randomFolder.length > 30 ? '...' + randomFolder.substr(-30) : randomFolder;
            items.push(this.createActionItem(t('sourceFolder'), ActionType.AddDirectory, 'folder', displayFolder));
        }

        if (element.label === t('particleEffects')) {
            items.push(this.createActionItem(t('openSettings'), ActionType.ParticleSettings, 'settings-gear'));
            items.push(this.createActionItem(t('toggleParticles'), ActionType.ToggleParticle, 'circle-filled'));
        }

        if (element.label === t('actions')) {
            items.push(this.createActionItem(t('clearBackground'), ActionType.CloseBackground, 'trash'));
            items.push(this.createActionItem(t('refresh'), ActionType.UpdateBackground, 'refresh'));
            items.push(this.createActionItem(t('openCacheFolder'), ActionType.OpenCacheFolder, 'folder-opened'));
            items.push(this.createActionItem(t('supportAuthor'), ActionType.OpenFilePath, 'heart', undefined, '//resources//support.jpg'));
        }

        return items;
    }

    private getSizeModeOptions(config: vscode.WorkspaceConfiguration): ConfigItem[] {
        const modes = [
            "cover", "repeat", "contain", "center", "not_center", 
            "not_right_bottom", "not_right_top", "not_left", 
            "not_right", "not_top", "not_bottom"
        ];
        const current = config.get<string>('sizeModel');
        
        return modes.map(mode => {
            const item = new ConfigItem(mode, vscode.TreeItemCollapsibleState.None, 'value', 'backgroundCover.sizeModel', mode, undefined, undefined, current === mode ? 'check' : 'circle-outline');
            item.command = {
                command: 'backgroundCover.setConfig',
                title: t('setSizeMode'),
                arguments: ['backgroundCover.sizeModel', mode]
            };
            return item;
        });
    }

    private getBlendModeOptions(config: vscode.WorkspaceConfiguration): ConfigItem[] {
        const modes = ["auto", "multiply", "lighten"];
        const current = config.get<string>('blendModel');
        
        return modes.map(mode => {
            const item = new ConfigItem(mode, vscode.TreeItemCollapsibleState.None, 'value', 'backgroundCover.blendModel', mode, undefined, undefined, current === mode ? 'check' : 'circle-outline');
            item.command = {
                command: 'backgroundCover.setConfig',
                title: t('setBlendMode'),
                arguments: ['backgroundCover.blendModel', mode]
            };
            return item;
        });
    }

    private createActionItem(label: string, actionType: ActionType, icon: string, description?: string, path?: string): ConfigItem {
        const item = new ConfigItem(label, vscode.TreeItemCollapsibleState.None, 'action', undefined, undefined, actionType, description, icon);
        item.command = {
            command: 'backgroundCover.runAction',
            title: label,
            arguments: [actionType, path]
        };
        return item;
    }

    private createSettingItem(label: string, key: string, value: any, actionType: ActionType, icon: string): ConfigItem {
        const item = new ConfigItem(label, vscode.TreeItemCollapsibleState.None, 'setting', key, value, actionType, String(value), icon);
        item.command = {
            command: 'backgroundCover.runAction',
            title: label,
            arguments: [actionType]
        };
        return item;
    }

    private createToggleItem(label: string, key: string, value: boolean, icon: string): ConfigItem {
        const item = new ConfigItem(label, vscode.TreeItemCollapsibleState.None, 'setting', key, value, undefined, value ? 'ON' : 'OFF', value ? 'check' : 'circle-outline');
        item.command = {
            command: 'backgroundCover.setConfig',
            title: t('toggle'),
            arguments: [key, !value]
        };
        return item;
    }
}
