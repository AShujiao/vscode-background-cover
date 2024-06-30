import * as path from 'path';
import * as fs from 'fs';
import version from './version';
import * as os from 'os';
import {
	Uri,
	window,
	InputBoxOptions,
	commands,
  } from 'vscode';
import { exec } from 'child_process';
import vsHelp from './vsHelp';

const cssName: string = version >= "1.38" ? 'workbench.desktop.main.css' : 'workbench.main.css';
export class FileDom {

	// 文件路径
	private filePath = path.join(path.dirname((require.main as NodeModule).filename), 'vs', 'workbench', cssName);
	private extName = "backgroundCover";
	private imagePath: string = '';
	private imageOpacity: number = 1;
	private sizeModel: string = 'cover';


	constructor(imagePath: string, opacity: number, sizeModel: string = 'cover') {
		this.imagePath = imagePath;
		this.imageOpacity = opacity;
		if(sizeModel == ""){
			sizeModel = "cover";
		}
		this.sizeModel = sizeModel;
		if(imagePath.substr(0, 8).toLowerCase() !== 'https://'){
			// mac对vscodefile协议支持存在异常，所以mac下使用base64
			var osType = os.type()
			if(osType == 'Darwin'){
				this.imageToBase64();
			}else{
				this.localImgToVsc();
			}
			
		}
	}


	public install(): boolean {
		let content: any = this.getCss().replace(/\s*$/, ''); // 去除末尾空白
		if (content === '') {
			return false;
		}
		// 添加代码到文件中，并尝试删除原来已经添加的
		let newContent = this.getContent();
		newContent = this.clearCssContent(newContent);
		newContent += content;
		try{
			this.saveContent(newContent);
		}catch(ex:any){
			vsHelp.showInfo('更新背景图片异常，请确保以管理员身份运行或对该文件赋予写入权限！ / Unexpected update of background image, please make sure to run as administrator or grant write permission to the file!                        \n ' + ex.message);

			return false;
		}
		
		return true;
	}

	private getCss(): string {

		// 重新计算透明度
		let opacity = this.imageOpacity;
		opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
		opacity = 0.59 + (0.4 - ((opacity * 4) / 10));
		
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
		body{
			background-size: ${sizeModelVal};
			background-repeat: ${repeatVal};
			background-position: ${positionVal};
			opacity:${opacity};
			background-image:url('${this.imagePath}');
		}
		/*ext-${this.extName}-end*/
		`;
	}


	/**
    * 获取文件内容
    * @var mixed
    */
	private getContent(): string {
		return fs.readFileSync(this.filePath, 'utf-8');
	}

	/**
    * 本地图片文件转base64
    * @var mixed
    */
	public imageToBase64(){
		try{
			let extname    = path.extname(this.imagePath);
			extname        = extname.substr(1);
			this.imagePath = fs.readFileSync(path.resolve(this.imagePath)).toString('base64');
			this.imagePath = `data:image/${extname};base64,${this.imagePath}`;
		}catch(e){
			return false;
		}
		
		return true;
	}


    private localImgToVsc() {
		var url =  "vscode-file://vscode-app/" + this.imagePath
		this.imagePath = Uri.parse(url).toString();
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
	public uninstall(): boolean {
		try {
			let content = this.getContent();
			content = this.clearCssContent(content);
			this.saveContent(content);
			return true;
		} catch (ex) {
			//console.log(ex);
			return false;
		}
	}

	/**
     * 在 MacOS 上写入样式，需要注意权限问题
     */
     public installMac(): boolean {
        let content: any = this.getCss().replace(/\s*$/, '');
        if (content === '') {
            return false;
        }
        let newContent = this.getContent();
        newContent = this.clearCssContent(newContent);
        newContent += content;
        fs.writeFile(this.filePath, newContent, { encoding: 'utf-8' }, (error) => {
            if (error) {
                // console.log('EACCES: permission denied', error?.message);
                // 对文件没有读写权限则提示输入管理员密码以继续写入样式
                let option: InputBoxOptions = {
                    ignoreFocusOut: true,
                    password: false,
                    placeHolder: 'Please enter the root password for access / 请输入 ROOT 密码用于获取权限',
                    prompt: '请输入管理员密码',
                }
                window.showInputBox(option).then((value) => {
                    if (!value) {
                        window.showWarningMessage(
                            'Please enter password / 请输入密码！'
                        );
                        return;
                    }
                    // 回调中无法返回标识，所以授权后异步写入样式并自动重启程序
                    this.saveContentMac(value, newContent);
                });
            }
        });
        return true;
    }

    /**
     * 执行授权命令并写入样式
     * 
     * @param password 管理员秘密
     * @param content 待写入的样式
     */
    public saveContentMac(password: string, content: string) {
        // SUDO+密码对css文件进行’读与写‘授权
        exec(
            `echo "${password}" | sudo -S chmod a+rwx "${this.filePath}"`,
            (error) => {
                // console.log('Chmod error:', error?.message);
                if (error) {
                    window.showWarningMessage(
                        `${error.name}: 密码可能输入有误，请重新尝试！`
                    );
                }
                // 写入样式并自动重启程序
                fs.writeFileSync(this.filePath, content, 'utf-8');
                commands.executeCommand('workbench.action.reloadWindow');
            }
        );
    }

}
