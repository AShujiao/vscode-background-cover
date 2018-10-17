import * as path from 'path';
import * as vscode from 'vscode';
export default function(config:any,extName:string,version:string):string{
	let opacity:number = config.opacity;
	let imagePath:string = config.imagePath ?config.imagePath: vscode.Uri.file(path.join(__filename,  '..', '..', 'resources', 'ow.jpg'));

	opacity = opacity<=0.1?0.1:opacity>=1?1:opacity;
	opacity = 0.89 + (0.1-(opacity / 10));
	
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