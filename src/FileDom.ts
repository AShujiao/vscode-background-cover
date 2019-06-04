import * as path from 'path';
import * as fs from 'fs';
import version from './version';


export class FileDom{

	// 文件路径
	private  filePath = path.join(path.dirname(require.main.filename), 'vs', 'workbench', 'workbench.main.css');
	private  extName = "backgroundCover";
	private  imagePath:string = '';
	private  imageOpacity:number = 1;


	constructor(imagePath:string,opacity:number){
		this.imagePath = imagePath;
		this.imageOpacity = opacity;
	}


	public install():boolean{
		let content:any = this.getCss().replace(/\s*$/, ''); // 去除末尾空白
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

	private getCss():string{

		// 重新计算透明度
		let opacity = this.imageOpacity;
		opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
		opacity = 0.62 + (0.4 - ((opacity*4) / 10));

		let imagePath = this.imagePath.replace(/\\/g, '/');

		return `
		/*ext-${this.extName}-start*/
		/*ext.${this.extName}.ver.${version}*/
		body{
			background-size:cover;
			background-repeat: no-repeat;
			opacity:${opacity};
			background-image:url('${imagePath}');
		}
		/*ext-${this.extName}-end*/
		`;
	}


	/**
    * 获取文件内容
    * @var mixed
    */
	private getContent(): string {
		return fs.readFileSync( this.filePath, 'utf-8' );
	}

	/**
    * 设置文件内容
    *
    * @private
    * @param {string} content
    */
	private saveContent( content: string ): void {
		fs.writeFileSync( this.filePath, content, 'utf-8' );
	}

	/**
	* 清理已经添加的代码
	*
	* @private
	* @param {string} content
	* @returns {string}
	*/
	private clearCssContent( content: string ): string {
		let re = new RegExp( "\\/\\*ext-" + this.extName + "-start\\*\\/[\\s\\S]*?\\/\\*ext-" + this.extName + "-end\\*" + "\\/", "g" );
		content = content.replace( re, '' );
		content = content.replace( /\s*$/, '' );
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
			content = this.clearCssContent( content );
			this.saveContent( content );
			return true;
		}
		catch ( ex ) {
			//console.log(ex);
			return false;
		}
	}
}