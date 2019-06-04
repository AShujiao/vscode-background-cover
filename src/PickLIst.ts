import * as vscode from 'vscode';
import { imgItem } from './ImgItem';
import { FileDom } from './FileDom';
import * as fs from 'fs';
import * as path from 'path';
import vsHelp from './vsHelp';


export class PickList{
	public static itemList:PickList|undefined;

	private readonly quickPick : vscode.QuickPick<imgItem>;

	private _disposables: vscode.Disposable[] = [];

	private config = this.getConfig();

	private imgPath:string = this.config.imagePath;

	private opacity:number = this.config.opacity;

	public static createItemLIst(){

		let list:vscode.QuickPick<imgItem> = vscode.window.createQuickPick<imgItem>();
		list.placeholder = '请选择相关配置！';
		let items: imgItem[] = [
			{ label: '选择图片', description: '选择一张背景图', imageType: 1 },
			{ label: '添加目录', description: '添加图片目录', imageType: 2 },
			{ label: '透明度', description: '更新图片透明度', imageType: 5 },
			{ label: '手动输入/https', description: '手动输入图片地址', imageType: 6 },
			{ label: '关闭背景', description: '关闭背景图展示', imageType: 7 },
		];
		list.items = items;
		PickList.itemList = new PickList(list);
	}

	private constructor(pickList:vscode.QuickPick<imgItem>){
		this.quickPick = pickList;

		// this.quickPick.onDidChangeSelection( e => {
		// 	this.listChange(e[0].imageType,e[0].path);
		// })

		this.quickPick.onDidAccept( e => this.listChange(this.quickPick.selectedItems[0]));

		this.quickPick.onDidHide(()=>{
			this.dispose();
		},null,this._disposables);

		this.quickPick.show();
	}

	private getConfig():vscode.WorkspaceConfiguration{
		return vscode.workspace.getConfiguration('backgroundCover');
	}

	private listChange(item:imgItem){
		
		let type = item.imageType;
		let path = item.path;
		switch (type) {
			case 1:
				this.imgList(); // 展示图片列表
				break;
			case 2:
				this.openFieldDialog(2); // 弹出选择文件夹对话框
				break;
			case 3:
				this.openFieldDialog(1); // 弹出选择图片文件对话框
				break;
			case 4:
				this.updateBackgound(path); // 选择列表内图片，更新背景css
				break;
			case 5:
				this.updateBackgound(path); // 更改透明度
				break;
			case 6:
				this.openFieldDialog(1); // 输入图片路径更新背景
				break;
			case 7:
				this.openFieldDialog(1); // 关闭背景图片展示
				break;
			case 8:
				vscode.commands.executeCommand('workbench.action.reloadWindow'); // 重新加载窗口，使设置生效
				break;
			case 9:
				this.quickPick.hide(); // 隐藏设置弹窗
				break;				
			default:
				break;
		}
	}

	//释放资源
	private dispose() {
		PickList.itemList = undefined;
		// Clean up our resources
		this.quickPick.hide();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private imgList(folderPath?:string){
		let items:imgItem[] = [
			{ label: '手动选择', description: '选择一张背景图', imageType: 3 }
		];
		let randomPath:any = folderPath ? folderPath : this.config.randomImageFolder;
		if(this.checkFolder(randomPath)){
			// 获取目录下的所有图片
			let files: string[] = fs.readdirSync(path.resolve(randomPath)).filter((s) => {
				return s.endsWith('.png') || s.endsWith('.jpg') || s.endsWith('.gif');
			});
			// 是否存在图片
			if (files.length > 0) {
				// 获取一个随机路径存入数组中
				let randomFile = files[Math.floor(Math.random() * files.length)];
				items.push({label:'随机图片',description:'随机选择',imageType:4,path:path.join(randomPath,randomFile)});
				items = items.concat(files.map((e)=> new imgItem(e,e,4,path.join(randomPath,e))));
			}
		}
		console.log(items);
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

	private updateBackgound(path?:string){
		if(!path){
			return vsHelp.showInfo('未获取到图片路径');
		}
		this.setConfigValue('imagePath',path);
	}

	private async openFieldDialog(type:number){
		let isFolders = type == 1 ? false:true;
		let isFiles   = type == 2 ? false:true;
		let folderUris = await vscode.window.showOpenDialog({ canSelectFolders: isFolders, canSelectFiles: isFiles, canSelectMany: false, openLabel: 'Select folder',filters:{'Images': ['png', 'jpg','gif','jpeg']} });
		if(!folderUris){
			return false;
		}
		let fileUri = folderUris[0];
		if(type == 2){
			this.setConfigValue('randomImageFolder',fileUri.fsPath,false);
			return this.imgList(fileUri.fsPath);
		}
		if(type == 1){
			return this.setConfigValue('imagePath',fileUri.fsPath);
		}

		return false;
	}

	private setConfigValue(name:string,value:any,updateDom:Boolean = true){
		// 更新变量		
		this.config.update(name,value,vscode.ConfigurationTarget.Global);
		switch (name) {
			case 'opacity':
				this.opacity = value;
				break;
			case 'imagePath':
				this.imgPath = value;
				break;
			default:
				break;
		}
		// 是否需要更新Dom
		if(updateDom){
			this.updateDom();
		}
		return true;
	}


	private updateDom(){
		let dom:FileDom = new FileDom(this.imgPath,this.opacity);
		let result = dom.install();
		if(result){
			this.quickPick.placeholder = 'Reloading takes effect? / 重新加载生效？';
			this.quickPick.items = [{ label: 'YES', description: '立即重新加载窗口生效',imageType:8 }, { label: 'NO', description: '稍后手动重启',imageType:9 }];
			this.quickPick.ignoreFocusOut = true;
			this.quickPick.show();
		}
	}
}