
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { env, Uri, window} from 'vscode';
import * as lockfile from 'lockfile';
import version from './version';
import { SudoPromptHelper } from './SudoPromptHelper';




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

    constructor(
        imagePath: string,
        opacity: number,
        sizeModel: string = 'cover',
        blur: number = 0,
        blendModel: string = ''
    ) {
        this.filePath = path.join(env.appRoot, "out", "vs", "workbench", "workbench.desktop.main.css");
        this.imagePath = imagePath;
        this.imageOpacity = Math.min(opacity, 0.8);
        this.sizeModel = sizeModel || "cover";
        this.blur = blur;
        this.blendModel = blendModel;
        this.systemType = os.type();

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

        const lockPath = os.tmpdir() + '/vscode-background.lock';

        try {
            // 加锁
            await new Promise((resolve, reject) => {
                lockfile.lock(lockPath, { retries: 10, retryWait: 100 }, (err:any) => {
                    if (err) reject(err);
                    else resolve(null);
                });
            });

            const content = this.getCss().trim();
            if (!content) return false;

            const newContent = this.clearCssContent(this.getContent()) + content;

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
            // const password = await window.showInputBox({
            //     password: true,
            //     placeHolder: '请输入管理员密码以获取写入权限',
            //     ignoreFocusOut: true
            // });

            // if (!password) {
            //     throw new Error('未提供管理员密码');
            // }

            //await SudoPromptHelper.exec(`echo "${password}" | sudo -S chmod a+rwx "${this.filePath}"`);
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
            const content = this.clearCssContent(this.getContent());
            await this.saveContent(content);
            //await commands.executeCommand('workbench.action.reloadWindow');
            return true;
        } catch (error) {
            await window.showErrorMessage(`卸载失败: ${error}`);
            return false;
        }
    }

    private getContent(): string {
        return fs.readFileSync(this.filePath, 'utf-8');
    }

    private async saveContent(content: string): Promise<void> {
        await fs.promises.writeFile(this.filePath, content, 'utf-8');
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
		/*ext-${this.extName}-start*/
		/*ext.${this.extName}.ver.${version}*/
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
		/*ext-${this.extName}-end*/
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
}
