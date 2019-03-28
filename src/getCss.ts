import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
export default function (config: any, extName: string, version: string,imgUrl?:string): string {
	let opacity: number = config.opacity;
	let imagePath: string = imgUrl ? imgUrl : '';
	// 是否配置了随机文件夹路径
	if (config.randomImageFolder && !imgUrl) { //random select image in folder
		let fdPath: string = config.randomImageFolder;
		// 判断路径是否存在
		let fsStatus = fs.existsSync(path.resolve(fdPath));
		if(!fsStatus){
			return '';
		}
		// 获取文件夹下的图片
		let files: string[] = fs.readdirSync(path.resolve(fdPath)).filter((s) => {
			return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.gif');
		});
		// 随机选出一张
		let selectFile = files[Math.floor(Math.random() * files.length)];
		imagePath = path.join(fdPath, selectFile).toString().replace(/\\/g, '/'); //Path conversion for Windows
	} else if(!imgUrl) {
		imagePath = config.imagePath ? config.imagePath.replace(/\\/g, '/') : vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'ow.jpg'));
	}

	//判断图片路径是否存在
	if(!fs.existsSync(imagePath)){
		return '';
	}
	let stat = fs.statSync(imagePath);
	if(!stat.isFile()){
		return '';
	}

	opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
	opacity = 0.62 + (0.4 - ((opacity*4) / 10));

	return `
	/*ext-${extName}-start*/
	/*ext.${extName}.ver.${version}*/
	body{
		background-size:cover;
		opacity:${opacity};
		background-image:url('${imagePath}');
	}
	/*ext-${extName}-end*/
	`;
}