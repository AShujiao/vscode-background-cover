import * as path from 'path';
import * as fs from 'fs';
import version from './version';
import * as vscode from 'vscode';

const cssName: string = vscode.version >= "1.38" ? 'workbench.desktop.main.css' : 'workbench.main.css';
export class FileDom {

	// 文件路径
	private filePath = path.join(path.dirname((require.main as NodeModule).filename), 'vs', 'workbench', cssName);
	private extName = "backgroundCover";
	private imageDataOrUrl: string = '';
	private imageOpacity: number = 1;

	/**
	 * CSS文件操作类
	 * @param imageDataOrUrl 需要设置的图片数据(^data:)或链接(^https:) 因权限原因不再传入任何(^file:)地址
	 * @param opacity 需要设置的图片透明度
	 */
	constructor(imageDataOrUrl: string, opacity: number) {
		this.imageDataOrUrl = imageDataOrUrl;
		this.imageOpacity = opacity;
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
		this.saveContent(newContent);
		return true;
	}

	private getCss(): string {

		// 重新计算透明度
		let opacity = this.imageOpacity;
		opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
		opacity = 0.79 + (0.2 - ((opacity * 2) / 10));

		return `
		/*ext-${this.extName}-start*/
		/*ext.${this.extName}.ver.${version}*/
		body{
			background-size:cover;
			background-repeat: no-repeat;
			opacity:${opacity};
			background-image:url('${this.imageDataOrUrl}');
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
}