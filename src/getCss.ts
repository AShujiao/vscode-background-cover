import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
export default function (config: any, extName: string, version: string): string {
	let opacity: number = config.opacity;
	let imagePath: string;
	if (config.randomImageFolder) { //random select image in folder
		let fdPath: string = config.randomImageFolder;
		let files: string[] = fs.readdirSync(path.resolve(fdPath)).filter((s) => {
			return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.gif');
		});
		let selectFile = files[Math.floor(Math.random() * files.length)];
		imagePath = path.join(fdPath, selectFile).toString().replace(/\\/g, '/'); //Path conversion for Windows
	} else {
		imagePath = config.imagePath ? config.imagePath : vscode.Uri.file(path.join(__filename, '..', '..', 'resources', 'ow.jpg'));
	}

	opacity = opacity <= 0.1 ? 0.1 : opacity >= 1 ? 1 : opacity;
	//opacity = 0.89 + (0.1 - (opacity / 10));  0.1--0.98
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