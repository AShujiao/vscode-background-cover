import * as vscode from 'vscode';
import { imgItem } from './ImgItem';
import { FileDom } from './FileDom';
import * as fs from 'fs';
import * as path from 'path';
import vsHelp from './vsHelp';


export class PickList{

	public static itemList:PickList|undefined;

	// 下拉列表
	private readonly quickPick : vscode.QuickPick<imgItem>;

	private _disposables: vscode.Disposable[] = [];

	// 当前配置
	private config = this.getConfig();

	// 当前配置的背景图路径
	private imgPath:string = this.config.imagePath;

	// 当前配置的背景图透明度
	private opacity:number = this.config.opacity;

	// 初始下拉列表
	public static createItemLIst(){

		let list:vscode.QuickPick<imgItem> = vscode.window.createQuickPick<imgItem>();
		list.placeholder = 'Please choose configuration! / 请选择相关配置！';
		let items: imgItem[] = [
			{ label: 'Select pictures',    description: '选择一张背景图', imageType: 1 },
			{ label: 'Add directory',      description: '添加图片目录', imageType: 2 },
			{ label: 'Background opacity', description: '更新图片不透明度', imageType: 5 },
			{ label: 'input : path/https', description: '输入图片路径：本地/https', imageType: 6 },
			{ label: 'Closing background', description: '关闭背景图', imageType: 7 },
		];
		list.items = items;
		PickList.itemList = new PickList(list);
	}

	// 列表构造方法
	private constructor(pickList:vscode.QuickPick<imgItem>){
		this.quickPick = pickList;

		this.quickPick.onDidAccept( e => this.listChange(this.quickPick.selectedItems[0]));

		this.quickPick.onDidHide(()=>{
			this.dispose();
		},null,this._disposables);

		this.quickPick.show();
	}

	// 获取当前配置
	private getConfig():vscode.WorkspaceConfiguration{
		return vscode.workspace.getConfiguration('backgroundCover');
	}

	// 列表点击事件分配
	private listChange(item:imgItem){
		
		let type = item.imageType; // 类型
		let path = item.path;      // 路径
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
				this.showInputBox(2); // 更改透明度
				break;
			case 6:
				this.showInputBox(1); // 输入图片路径更新背景
				break;
			case 7:
				this.updateDom(true); // 关闭背景图片展示
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

	// 根据图片目录展示图片列表
	private imgList(folderPath?:string){
		let items:imgItem[] = [
			{ label: 'Manual selection', description: '选择一张背景图', imageType: 3 }
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
				items.push({label:'Random pictures',description:'随机自动选择',imageType:4,path:path.join(randomPath,randomFile)});
				items = items.concat(files.map((e)=> new imgItem(e,e,4,path.join(randomPath,e))));
			}
		}
		//console.log(items);
		//this.quickPick.ignoreFocusOut = true;
		this.quickPick.items = items;
		this.quickPick.show();
	}


	// 检查选择的文件及目录是否正确
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

	// 创建一个输入框
	private showInputBox(type:number){
		if(type<=0 || type > 2) return false;

		let placeString  = type==2 ? "Opacity ranges：0.00 - 1,current:("+this.opacity+")" : "Please enter the image path to support local and HTTPS";
		let promptString = type==2 ? "设置图片不透明度：0-1" : "请输入图片路径，支持本地及https";


		let option:vscode.InputBoxOptions = {ignoreFocusOut:true,password:false,placeHolder:placeString,prompt:promptString};

		vscode.window.showInputBox(option).then(value=>{
            //未输入值返回false
            if(!value){
                vscode.window.showWarningMessage('Please enter configuration parameters / 请输入配置参数！');
                return;
			}
			if(type==1){
				// 判断路径是否存在
				let fsStatus = fs.existsSync(path.resolve(value));
				let isUrl    = (value.substr(0,8).toLowerCase() == "https://");
				if(!fsStatus && !isUrl){
					vscode.window.showWarningMessage('Please enter the correct file format path! / 请输入正确的文件格式路径！');
					return false;
				}
			}else{
				let isOpacity  = parseFloat(value);

				if(isOpacity < 0 || isOpacity > 1 || isNaN(isOpacity)){
					vscode.window.showWarningMessage('Opacity ranges in：0 - 1！');
					return false;
				}

			}

			this.setConfigValue((type==1 ? "imagePath":"opacity"),(type==1 ? value:parseFloat(value)),true);
		})
		
	}

	// 更新配置
	private updateBackgound(path?:string){
		if(!path){
			return vsHelp.showInfo('Unfetched Picture Path / 未获取到图片路径');
		}
		this.setConfigValue('imagePath',path);
	}

	// 文件、目录选择
	private async openFieldDialog(type:number){
		let isFolders = type == 1 ? false:true;
		let isFiles   = type == 2 ? false:true;
		let filters   = type == 1 ? {'Images': ['png', 'jpg','gif','jpeg']} : undefined;
		let folderUris = await vscode.window.showOpenDialog({ canSelectFolders: isFolders, canSelectFiles: isFiles, canSelectMany: false, openLabel: 'Select folder',filters:filters });
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

	// 更新配置
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


	// 更新、卸载css
	private updateDom(uninstall:boolean = false){
		let dom:FileDom = new FileDom(this.imgPath,this.opacity);
		let result = false;
		if(uninstall){
			result =dom.uninstall();
		}else{
			result = dom.install();
		}
		if(result){
			this.quickPick.placeholder = 'Reloading takes effect? / 重新加载生效？';
			this.quickPick.items = [{ label: 'YES', description: '立即重新加载窗口生效',imageType:8 }, { label: 'NO', description: '稍后手动重启',imageType:9 }];
			this.quickPick.ignoreFocusOut = true;
			this.quickPick.show();
		}
	}
}