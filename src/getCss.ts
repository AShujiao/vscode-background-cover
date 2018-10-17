import * as path from 'path';
export default function(config:any,extName:string,version:string):string{
	let opacity:number = config.opacity;
	let imagePath:string = config.imagePath ?config.imagePath: path.join(__filename,  '..', '..', 'resources', 'ow.jpg');
	

	return `
	/*ext-${extName}-start*/
	/*ext.${extName}.ver.${version}*/
	body{
		background-size:cover;
		opacity:${opacity};
		background-image:url('file:///${imagePath}');
	}
	/*ext-${extName}-end*/
	`;
}