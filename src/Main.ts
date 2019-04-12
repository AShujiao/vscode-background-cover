
import * as vscode from 'vscode';
import version from './version';
import { Dom } from './Dom';
import * as path from 'path';
export class Main {


	public static watch(): vscode.Disposable {
		// 文件路径
		const base = path.dirname(require.main.filename);
		const filePath = path.join(base, 'vs', 'workbench', 'workbench.main.css');
		const extName = "backgroundCover";
		//入口
		let DomApi = new Dom(extName, filePath, version, extName);
		vscode.commands.registerCommand('extension.backgroundCover.refresh', () => { DomApi.refresh(); });
		vscode.commands.registerCommand('extension.backgroundCover.selectImg', () => { DomApi.showImageItem(); });
		return vscode.workspace.onDidChangeConfiguration(() => DomApi.install());
	}

	public showItem() {

		const itemList = vscode.window.createQuickPick<imgItem>();
		itemList.placeholder = '请选择相关配置！';
		let items: imgItem[] = [
			{ label: '选择图片', description: '选择一张背景图', type: 1 },
			{ label: '添加目录', description: '添加图片目录', type: 2 },
			{ label: '透明度', description: '更新图片透明度', type: 2 },
			{ label: '手动输入/https', description: '手动输入图片地址', type: 2 },
			{ label: '关闭/开启背景', description: '背景图是否展示', type: 2 },
		]
		itemList.items = items;
		itemList.onDidChangeSelection( e => {
			let item = e[0];
			this.updateConfig(item.type);
		})
		itemList.onDidHide(()=>{
			itemList.dispose();
		})
		itemList.show();
	}

	public async updateConfig(type:number){
		let isFolders = type == 1 ? false:true;
		let isFiles   = type == 2 ? false:true;
		let folderUris = await vscode.window.showOpenDialog({ canSelectFolders: isFolders, canSelectFiles: isFiles, canSelectMany: false, openLabel: 'Select folder',filters:{'Images': ['png', 'jpg','gif','jpeg']} });
		if(!folderUris){
			return false;
		}
		let fileUri = folderUris[0];
		if(type == 2){
			this.setConfigValue('randomImageFolder',fileUri.fsPath);
		}
	}

	private setConfigValue(name:string,value:any){
		let config = vscode.workspace.getConfiguration('backgroundCover');
		return config.update(name,value,vscode.ConfigurationTarget.Global);
	}

}

/**
 * imgItem / 图片List类
 */
class imgItem implements vscode.QuickPickItem {

	label: string;
	description: string;
	type: number;

	constructor(label: string, description: string,type:number) {
        this.label = label;
        this.description = description;
        this.type = type;
    }
}