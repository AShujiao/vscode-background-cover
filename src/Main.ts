
import * as vscode from 'vscode';
import version from './version';
import { Dom } from './Dom';
import * as path from 'path';
export class Main{
	public static watch():vscode.Disposable{
		// 文件路径
		const base = path.dirname(require.main.filename);
		const filePath = path.join(base, 'vs', 'workbench', 'workbench.main.css');
		const extName = "backgroundCover";
		//入口
		let DomApi = new Dom(extName,filePath,version,extName);
		return vscode.workspace.onDidChangeConfiguration(() => DomApi.install());
	}
}