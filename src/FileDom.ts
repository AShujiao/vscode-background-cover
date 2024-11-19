
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { env, Uri, window} from 'vscode';
import * as lockfile from 'lockfile';
import version from './version';
import { SudoPromptHelper } from './SudoPromptHelper';
//const fse = require('fs-extra')
import * as fse from 'fs-extra';
import { getContext } from './global';


const jsName: string = 'workbench.desktop.main.js';
const cssName: string = 'workbench.desktop.main.css';
const bakName: string = 'workbench.desktop.main.js.bak';
const jsFilePath = path.join(env.appRoot, "out", "vs", "workbench", jsName);
const cssFilePath = path.join(env.appRoot, "out", "vs", "workbench", cssName);
const bakFilePath = path.join(env.appRoot, "out", "vs", "workbench", bakName);

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
    private upCssContent: string = '';
    private bakStatus: boolean = false;
    private bakJsContent: string = '';

    constructor(
        imagePath: string,
        opacity: number,
        sizeModel: string = 'cover',
        blur: number = 0,
        blendModel: string = ''
    ) {
        this.filePath     = jsFilePath;
        this.imagePath    = imagePath;
        this.imageOpacity = Math.min(opacity, 0.8);
        this.sizeModel    = sizeModel || "cover";
        this.blur         = blur;
        this.blendModel   = blendModel;
        this.systemType   = os.type();

        this.initializeImage();
    }

    private async initializeImage(): Promise<void> {
        if (!this.imagePath.toLowerCase().startsWith('https://')) {
            if (this.systemType === SystemType.MACOS) {
                await this.imageToBase64();
            } else {
                this.localImgToVsc();
            }
        }
    }

    public async install(): Promise<boolean> {

        // 文件是否存在
        const isExist = await fse.pathExists(this.filePath);
        if (!isExist) {
            await window.showErrorMessage(`文件不存在，提醒开发者修复吧！`);
            return false
        }


        // 获取全局变量是否已经清除
        let vsContext = getContext();
        let isClear = vsContext.globalState.get('ext_backgroundCover_clear');
        if(!isClear){
            // 验证旧版css文件是否需要清除
            const cssContent = this.getContent(cssFilePath);
            if(this.getPatchContent(cssContent)){
                // 清除旧版css文件
                this.upCssContent = this.clearCssContent(cssContent);
            }else{
                // 不存在旧版css文件，设置全局变量
                vsContext.globalState.update('ext_backgroundCover_clear',true);
            }
        }

        // 备份文件是否存在
        const bakExist = await fse.pathExists(bakFilePath);
        if (!bakExist) {
            this.bakStatus = true;
        }
        

        const lockPath = os.tmpdir() + '/vscode-background.lock';

        try {
            // 加锁
            await new Promise((resolve, reject) => {
                lockfile.lock(lockPath, { retries: 10, retryWait: 100 }, (err:any) => {
                    if (err) reject(err);
                    else resolve(null);
                });
            });

            const content = this.getJs().trim();
            if (!content) return false;

            const bakContent = this.clearCssContent(this.getContent(this.filePath))
            if(this.bakStatus){
                this.bakJsContent = bakContent;
            }

            const newContent = bakContent + content;

            switch (this.systemType) {
                case SystemType.WINDOWS:
                    return await this.installWindows(newContent);
                case SystemType.MACOS:
                    return await this.installMacOS(newContent);
                case SystemType.LINUX:
                    return await this.installLinux(newContent);
                default:
                    throw new Error('Unsupported operating system');
            }
        } catch (error: any) {
            await window.showErrorMessage(`Installation failed: ${error.message}`);
            return false;
        } finally {
            // 解锁
            lockfile.unlock(lockPath, (err:any) => {
                if (err) console.error(`Failed to unlock ${lockPath}:`, err);
            });
        }
    }

    private async installWindows(content: string): Promise<boolean> {
        try {
            await this.saveContent(content);
            return true;
        } catch (error) {
            // 权限不足时，修改文件权限,使用cmd命令
            await SudoPromptHelper.exec(`takeown /f "${this.filePath}" /a`);
            await SudoPromptHelper.exec(`icacls "${this.filePath}" /grant Users:F`);
            await this.saveContent(content);
            return true;
        }
    }

    private async installMacOS(content: string): Promise<boolean> {
        try {
            await this.saveContent(content);
            return true;
        } catch {
            await SudoPromptHelper.exec(`chmod a+rwx "${this.filePath}"`);
            await this.saveContent(content);
            return true;
        }
    }

    private async installLinux(content: string): Promise<boolean> {
        try {
            await this.saveContent(content);
            return true;
        } catch {
            await SudoPromptHelper.exec(`chmod 666 "${this.filePath}"`);
            await this.saveContent(content);
            return true;
        }
    }

    public async uninstall(): Promise<boolean> {
        try {
            const content = this.clearCssContent(this.getContent(this.filePath));
            await this.saveContent(content);
            //await commands.executeCommand('workbench.action.reloadWindow');
            return true;
        } catch (error) {
            await window.showErrorMessage(`卸载失败: ${error}`);
            return false;
        }
    }

    private getContent(filePath:string): string {
        return fs.readFileSync(filePath, 'utf-8');
    }

    private async saveContent(content: string): Promise<void> {
        // 追加新内容到原文件
        await fse.writeFile(this.filePath,content, {encoding: 'utf-8'});
        // 清除旧版css文件
        if(this.upCssContent){
            await fse.writeFile(cssFilePath,this.upCssContent, {encoding: 'utf-8'});
            this.upCssContent = '';
        }
        if(this.bakStatus){
            await this.bakFile();
        }
    }

    private async bakFile(): Promise<void> {
        try{
            await fse.writeFile(bakFilePath,this.bakJsContent, {encoding: 'utf-8'});
        }catch(err){
            // 权限不足,根据不同系统获取创建文件权限
            if(this.systemType === SystemType.WINDOWS){
                await SudoPromptHelper.exec(`echo ${this.bakJsContent} > ${bakFilePath}`);
            }else if(this.systemType === SystemType.MACOS){
                await SudoPromptHelper.exec(`echo ${this.bakJsContent} | sudo tee ${bakFilePath}`);
            }else if(this.systemType === SystemType.LINUX){
                await SudoPromptHelper.exec(`echo ${this.bakJsContent} | sudo tee ${bakFilePath}`);
            }
            
        }
    }

    private getJs(): string {
        let css = this.getCss();
        return `
        /*ext-${this.extName}-start*/
		/*ext.${this.extName}.ver.${version}*/
        const style = document.createElement('style');
        style.textContent = \`${css}\`;
        document.head.appendChild(style);
        /*ext-${this.extName}-end*/
        `;
    }

    private getCss(): string {
		// 透明度最大0.8
		let opacity = this.imageOpacity;
		opacity = opacity > 0.8 ? 0.8 : opacity;

		// 图片填充方式
		let sizeModelVal = this.sizeModel;
		let repeatVal    = "no-repeat";
		let positionVal  = "center";
		switch(this.sizeModel){
			case "cover":
				sizeModelVal = "cover";
				break;
			case "contain":
				sizeModelVal = "100% 100%";
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
			background-image:url('${this.imagePath}');
			z-index: 2;
			pointer-events: none;
			filter: blur(${this.blur}px);
			mix-blend-mode: ${this.blendModel};
		}
		`;
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

    // 获取文件里是否存在补丁样式代码
    public getPatchContent(content:string): boolean {
        const match = content.match(/\/\*ext-backgroundCover-start\*\/[\s\S]*?\/\*ext-backgroundCover-end\*\//g);
        if(match){
            return true;
        }
        return false;
    }
}
