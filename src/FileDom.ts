import * as path from 'path';
import * as fs from 'fs';
import version from './version';
import * as vscode from 'vscode';
import * as crypto from 'crypto';

const cssName: string = vscode.version >= "1.38" ? 'workbench.desktop.main.css' : 'workbench.main.css';
export class FileDom {

	// 文件路径
	private filePath = path.join(path.dirname((require.main as NodeModule).filename), 'vs', 'workbench', cssName);
	private extName = "backgroundCover";

	/**
	 * CSS文件操作类 只是读取操作时无需构造参数
	 * @param imageDataOrUrl 需要设置的图片数据(^data:)或链接(^https:) 因权限原因不再传入任何(^file:)地址
	 * @param opacity 需要设置的图片透明度
	 */
	constructor(
		private imageDataOrUrl: string = '', 
		private imageOpacity: number = 1) {
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

	/**
	 * 取正在生效的背景图数据的md5
	 * @returns md5小写文本或undefined
	 */
	public getCurrentDataHash(): string | undefined {
		let find = new RegExp(`/\\*ext\\.${this.extName}\\.dataHash\\.([0-9a-f]{32})\\*/`).exec(this.getContent());
		return find ? find[1] : undefined;
	}

	private getCss(): string {

		// 重新计算透明度
		let opacity = this.imageOpacity;
		opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
		opacity = 0.79 + (0.2 - ((opacity * 2) / 10));

		// 计算数据md5校验
		let hash = crypto.createHash('md5').update(this.imageDataOrUrl, 'utf8').digest('hex').toLowerCase();

		// 生成css内容
		return `
		/*ext-${this.extName}-start*/
		/*ext.${this.extName}.ver.${version}*/
		/*ext.${this.extName}.dataHash.${hash}*/
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