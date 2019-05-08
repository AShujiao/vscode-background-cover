import * as path from 'path';
import * as fs from 'fs';


export class FileDom{

	// 文件路径
	private static base = path.dirname(require.main.filename);
	private static filePath = path.join(FileDom.base, 'vs', 'workbench', 'workbench.main.css');
	private static extName = "backgroundCover";

	
}