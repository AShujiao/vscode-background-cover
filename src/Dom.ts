import * as path from 'path';
import * as fs from 'fs';
import FileType from './FileType';
import * as vscode from 'vscode';
import vsHelp from './vsHelp';
import getNewContent from './getCss';

export class Dom {
    //当前用户配置
    private config: any;
    //配置名称
    private configName: string;
    //要修改的文件路径
    private filePath: string;
    //插件版本号
    private version: string;
    //插件名称
    private extName: string;
    //底部切换按钮
    private selectImageBar: vscode.StatusBarItem | undefined;

    //初始化参数
    public constructor(
        configName: string,
        filePath: string,
        version: string,
        extName: string,
    ) {
        this.configName = configName;
        this.filePath = filePath;
        this.version = version;
        this.extName = extName;
        this.config = vscode.workspace.getConfiguration(this.configName);
        let firstload = this.checkFirstload();                               // 是否初次加载插件
        let fileType = this.getFileType(); // css 文件目前状态

        //如果配置了文件夹背景路径展示底部选择图片按钮
        this.switchStatusBar();

        // 如果是第一次加载插件，或者旧版本
        if (firstload || fileType == FileType.isOld || fileType == FileType.empty) {
            this.install(true);
        }
    }

    /**
    * 安装插件，hack css
    *
    * @private
    * @param {boolean} [refresh] 需要更新
    * @returns {void}
    */
    public install(refresh?: boolean): void {

        let lastConfig = this.config;                                         // 之前的配置
        let config = vscode.workspace.getConfiguration(this.configName);  // 当前用户配置

        // 1.如果配置文件改变到时候，当前插件配置没有改变，则返回
        if (!refresh && JSON.stringify(lastConfig) == JSON.stringify(config)) {
            // console.log('配置文件未改变.')
            return;
        }

        // 之后操作有两种：1.初次加载  2.配置文件改变

        // 2.两次配置均为，未启动插件
        if (!lastConfig.enabled && !config.enabled) {
            // console.log('两次配置均为，未启动插件');
            return;
        }

        // 3.保存当前配置
        this.config = config; // 更新配置

        // 4.切换按钮状态
        this.switchStatusBar();

        // 4.如果关闭插件
        if (!config.enabled) {
            this.uninstall();
            vsHelp.showInfoRestart(this.extName + 'The plugin has been closed, please restart!');
            return;
        }

        // 5.hack 样式
        if(!this.updateContent()){
            vsHelp.showInfo('Failed, please confirm that the path is correct! / 背景更新失败，请确认路径是否正确!')
        }else{
            vsHelp.showInfoRestart(this.extName + ' The configuration has been updated, please restart!');
        }

    }

    /**
    * Restart without confirmation / 扩展重启命令
    */
    public refresh() {
        let config = this.config;
        if (!config.enabled) {
            this.uninstall();
            vscode.commands.executeCommand('workbench.action.reloadWindow');
            return;
        }
        if(!this.updateContent()){
            return vsHelp.showInfo('Failed, please confirm that the path is correct! / 背景更新失败，请确认路径是否正确!')
        }
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    }

    /**
    * updateContent / 更新背景
    */
    public updateContent(imgUrl?: string):boolean {
        let content:any = getNewContent(this.config, this.extName, this.version, imgUrl).replace(/\s*$/, ''); // 去除末尾空白
        if(content == ''){
            return false;
        }
        // 添加代码到文件中，并尝试删除原来已经添加的
        let newContent = this.getContent();
        newContent = this.clearCssContent(newContent);
        newContent += content;
        this.saveContent(newContent);
        return true;
    }

    /**
    * 获取文件内容
    * @var mixed
    */
    private getContent(): string {
        return fs.readFileSync(this.filePath, 'utf-8');
    }

    /**
    * 设置文件内容
    *
    * @private
    * @param {string} content
    */
    private saveContent(content: string): void {
        fs.writeFileSync(this.filePath, content, 'utf-8');
    }
    /**
    * 清理已经添加的代码
    *
    * @private
    * @param {string} content
    * @returns {string}
    */
    private clearCssContent(content: string): string {
        let re = new RegExp("\\/\\*ext-" + this.extName + "-start\\*\\/[\\s\\S]*?\\/\\*ext-" + this.extName + "-end\\*" + "\\/", "g");
        content = content.replace(re, '');
        content = content.replace(/\s*$/, '');
        return content;
    }

    /**
    * 卸载
    *
    * @private
    */
    private uninstall(): boolean {
        try {
            let content = this.getContent();
            content = this.clearCssContent(content);
            this.saveContent(content);
            return true;
        }
        catch (ex) {
            //console.log(ex);
            return false;
        }
    }

    /**
    * 检测是否初次加载，并在初次加载的时候提示用户
    *
    * @private
    * @returns {boolean} 是否初次加载
    */
    private checkFirstload(): boolean {
        const configPath = path.join(__dirname, '../resources/config.json');
        let info: { firstload: boolean } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (info.firstload) {
            // 提示
            vsHelp.showInfo('Plugin： ' + this.extName + 'Started! ')
            // 标识插件已启动过
            info.firstload = false;
            fs.writeFileSync(configPath, JSON.stringify(info, null, '    '), 'utf-8');

            return true;
        }
        return false;
    }

    /**
    * 获取文件状态
    *
    * @private
    * @returns {FileType}
    */
    private getFileType(): FileType {
        let cssContent = this.getContent();

        // 未 hack 过
        let ifUnInstall: boolean = !~cssContent.indexOf(`ext.${this.extName}.ver`);

        if (ifUnInstall) {
            return FileType.empty;
        }

        // hack 过的旧版本
        let ifVerOld: boolean = !~cssContent.indexOf(`/*ext.${this.extName}.ver.${this.version}*/`);

        if (ifVerOld) {
            return FileType.isOld;
        }

        // hack 过的新版本
        return FileType.isNew;
    }


    /**
    *  switchStatusBar / 切换选择背景图按钮展示状态
    */
    private switchStatusBar(): void {

        let hideBar: boolean = (!this.config.randomImageFolder || !this.config.enabled);

        if (this.selectImageBar != undefined && hideBar) {
            return this.selectImageBar.hide();
        }

        if (this.selectImageBar != undefined && !hideBar) {
            return this.selectImageBar.show();
        }

        if (this.selectImageBar == undefined && !hideBar) {
            //创建按钮
            this.selectImageBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -999);
            this.selectImageBar.text = '$(file-media)';
            this.selectImageBar.command = 'extension.backgroundCover.selectImg';
            this.selectImageBar.tooltip = 'Switch background image / 切换背景图';
            return this.selectImageBar.show();
        }

        return;
    }


    /**
     * showImageItem / 展示切换背景图下拉列表
     */
    public showImageItem() {
        if (!this.config.randomImageFolder) {
            return vscode.window.showInformationMessage('The random folder path is not configured / 未配置随机文件夹路径！');
        }
        // 读取路径下的所有图片
        let fdPath: string = this.config.randomImageFolder;
        // 判断路径是否存在
		let fsStatus = fs.existsSync(path.resolve(fdPath));
		if(!fsStatus){
			return vscode.window.showInformationMessage('There is no image under the folder / 文件夹下不存在图片！');
        }
        // 判断是否为目录路径
        let stat = fs.statSync(fdPath);
        if(!stat.isDirectory()){
            return vscode.window.showInformationMessage('There is no image under the folder / 文件夹下不存在图片！');
        }
        // 获取目录下的所有图片
        let files: string[] = fs.readdirSync(path.resolve(fdPath)).filter((s) => {
            return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.gif');
        });
        // 是否存在图片
        if (files.length == 0) {
            return vscode.window.showInformationMessage('There is no image under the folder / 文件夹下不存在图片！');
        }
        // 获取一个随机路径存入数组中
        let randomFile = files[Math.floor(Math.random() * files.length)];
        files.unshift(randomFile);


        // 创建图片选择下拉框
        const quickItem = vscode.window.createQuickPick<imgItem>();
        quickItem.placeholder = 'Choose a background image / 选择一张你要切换的背景图片';
        quickItem.items = files.map((i, n) => new imgItem(i, n));
        // 点击事件
        quickItem.onDidChangeSelection(items => {
            const item = items[0];
            item.path = path.join(fdPath, item.path).toString().replace(/\\/g, '/');
            this.updateContent(item.path);
            quickItem.hide();
            // 弹出确认重启弹窗
            this.reloadWindow();
        })
        // 隐藏事件
        quickItem.onDidHide(() => {
            quickItem.dispose();
        })
        quickItem.show();

    }

    /**
     * reloadWindow / 重新加载窗口
     */
    private reloadWindow() {
        const listItem = vscode.window.createQuickPick();
        listItem.placeholder = 'Reloading takes effect? / 重新加载生效？';
        listItem.items = [{ label: 'YES', description: '立即重新加载窗口生效' }, { label: 'NO', description: '稍后手动重启' }];

        listItem.onDidChangeSelection(items => {
            if (items[0].label == 'YES') {
                return vscode.commands.executeCommand('workbench.action.reloadWindow');
            } else {
                listItem.hide();
            }
        });
        listItem.onDidHide(() => {
            listItem.dispose();
        })
        listItem.show();
    }

}

/**
 * imgItem / 图片List类
 */
class imgItem implements vscode.QuickPickItem {

    label: string;
    description: string;
    path: string;

    constructor(url: string, index: number) {
        this.label = index == 0 ? 'Random Image' : url;
        this.description = index == 0 ? '随机选择一张背景图片' : '';
        this.path = url;
    }
}