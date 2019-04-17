import * as vscode from 'vscode';
import { imgItem } from './ImgItem';
import * as fs from 'fs';
import * as path from 'path';


export class PickList{
	public static itemList:PickList|undefined;

	private readonly quickPick : vscode.QuickPick<imgItem>;

	private _disposables: vscode.Disposable[] = [];

	private config = vscode.workspace.getConfiguration('backgroundCover');

	public static createItemLIst(){

		const list = vscode.window.createQuickPick<imgItem>();
		list.placeholder = '请选择相关配置！';
		let items: imgItem[] = [
			{ label: '选择图片', description: '选择一张背景图', type: 1 },
			{ label: '添加目录', description: '添加图片目录', type: 2 },
			{ label: '透明度', description: '更新图片透明度', type: 2 },
			{ label: '手动输入/https', description: '手动输入图片地址', type: 2 },
			{ label: '关闭/开启背景', description: '背景图是否展示', type: 2 },
		];
		list.items = items;
		PickList.itemList = new PickList(list);
	}

	private constructor(pickList:vscode.QuickPick<imgItem>){
		this.quickPick = pickList;

		this.quickPick.onDidChangeSelection( e => {
			let item = e[0];
			this.listChange(item.type);
		})

		this.quickPick.onDidHide(()=>{
			this.dispose();
		},null,this._disposables)

		this.quickPick.show();
	}

	private listChange(type:number){

		switch (type) {
			case 1:
				this.imgList();
				break;
			case 2:
				this.updateConfig(2);
				break;
			case 3:
				this.updateConfig(1);
			default:
				break;
		}
	}

	//释放资源
	private dispose() {
		PickList.itemList = undefined;
		// Clean up our resources
		this.quickPick.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private imgList(){
		let items: imgItem[] = [
			{ label: '手动选择', description: '选择一张背景图', type: 3 }
		];
		let randomPath:any = this.config.randomImageFolder;
		if(this.checkFolder(randomPath)){
			// 获取目录下的所有图片
			let files: string[] = fs.readdirSync(path.resolve(randomPath)).filter((s) => {
				return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.gif');
			});
			// 是否存在图片
			if (files.length > 0) {
				// 获取一个随机路径存入数组中
				let randomFile = files[Math.floor(Math.random() * files.length)];
				items.push({label:'随机图片',description:'随机选择',type:4,path:path.join(randomPath,randomFile)});
				items = items.concat(files.map((e)=> new imgItem(e,e,4,path.join(randomPath,e))));
			}
		}
		this.quickPick.ignoreFocusOut = true;
		this.quickPick.items = items;
		this.quickPick.show();
	}


	private checkFolder(folderPath:string){
		if(!folderPath){
			return false;
		}
		// 判断路径是否存在
		let fsStatus = fs.existsSync(path.resolve(folderPath));
		if(!fsStatus){
			return false;
        }
        // 判断是否为目录路径
        let stat = fs.statSync(folderPath);
        if(!stat.isDirectory()){
            return false;
		}
		
		return true;
	}

	private updateBackgound(path:string){
		this.setConfigValue('imagePath',path);
	}

	private async updateConfig(type:number){
		let isFolders = type == 1 ? false:true;
		let isFiles   = type == 2 ? false:true;
		let folderUris = await vscode.window.showOpenDialog({ canSelectFolders: isFolders, canSelectFiles: isFiles, canSelectMany: false, openLabel: 'Select folder',filters:{'Images': ['png', 'jpg','gif','jpeg']} });
		if(!folderUris){
			return false;
		}
		let fileUri = folderUris[0];
		if(type == 2){
			return this.setConfigValue('randomImageFolder',fileUri.fsPath);
		}
		if(type == 1){
			return this.setConfigValue('imagePath',fileUri.fsPath);
		}

		return false;
	}

	private setConfigValue(name:string,value:any){
		return this.config.update(name,value,vscode.ConfigurationTarget.Global);
	}
}