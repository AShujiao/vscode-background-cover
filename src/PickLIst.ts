import * as fs from 'fs';
import * as path from 'path';
import {
	QuickPick,
	Disposable,
	QuickPickItemKind,
	workspace,
	WorkspaceConfiguration,
	window,
	commands,
	env,
	Uri,
	extensions,
	InputBoxOptions,
	ConfigurationTarget,
	ColorThemeKind,
} from 'vscode';

import { FileDom } from './FileDom';
import { ImgItem } from './ImgItem';
import vsHelp from './vsHelp';
import { getContext } from './global';
import bleandHelper from './bleandHelper';



export class PickList {
	public static itemList: PickList | undefined;

	// 下拉列表
	private readonly quickPick: QuickPick<ImgItem> | any;

	private _disposables: Disposable[] = [];

	// 当前配置
	private config: WorkspaceConfiguration;

	// 当前配置的背景图路径
	private imgPath: string;

	// 当前配置的背景图透明度
	private opacity: number;

	// 图片类型 1:本地文件，2：https
	private imageFileType: number;

	// 当前配置的背景图尺寸模式
	private sizeModel: string;

	private blur: number;

	private randUpdate: boolean = false;


	// 初始下拉列表
	public static createItemLIst() {
		let config: WorkspaceConfiguration =
			workspace.getConfiguration( 'backgroundCover' );
		let list: QuickPick<ImgItem> =
			window.createQuickPick<ImgItem>();
		list.placeholder = 'Please choose configuration! / 请选择相关配置！';
		list.totalSteps = 2
		let items: ImgItem[] = [
			{
				label: '$(file-media)    Select Pictures               ',
				description: '选择一张背景图',
				imageType: 1
			},
			{
				label: '$(file-directory)    Add Directory                ',
				description: '添加图片目录',
				imageType: 2
			},
			{
				label: '$(settings)    Background Opacity      ',
				description: '更新图片不透明度',
				imageType: 5
			},
			{
				label: '$(settings)    Background Blur            ',
				description: '模糊度',
				imageType: 18
			},
			{
				label: '$(layout)    Size Mode                      ',
				description: '尺寸适应模式 / size adaptive mode',
				imageType: 15
			},
			{
				label: '$(pencil)    Input : Path/Https          ',
				description: '输入图片路径：本地/https',
				imageType: 6
			},
			{
				label: '$(eye-closed)    Closing Background      ',
				description: '关闭背景图',
				imageType: 7
			},
		];
		if ( config.autoStatus ) {
			items.push( {
				label: '$(sync)    OFF Start Replacement  ',
				description: '关闭启动自动更换',
				imageType: 10
			} )
		} else {
			items.push( {
				label: '$(sync)    ON Start Replacement   ',
				description: '开启启动自动更换',
				imageType: 11
			} )
		}
		// 更多
		items.push(
			{
				label: '',
				description: '--------------------',
				imageType: 0,
				kind: QuickPickItemKind.Separator
			},
			{
				label: '$(github)    Github                            ',
				description: 'Github信息',
				imageType: 12,
			},
			{
				label: '$(heart)    Support                          ',
				description: '请作者喝一杯咖啡吧~       ',
				imageType: 14,
				path: "//resources//support.jpg"
			},
			{
				label: '$(organization)    Wechat                           ',
				description: '微信群聊~      ',
				imageType: 14,
				path: "//resources//wx.jpg"
			},
			{
				label: '$(ports-open-browser-icon)    Online images                ',
				description: '在线图库',
				imageType: 17,
				path: "https://vs.20988.xyz/d/24-bei-jing-tu-tu-ku"
			}
		)
		list.items = items;
		list.title = "背景图设置";

		PickList.itemList = new PickList( config, list );
	}

	/**
	 *  强制更新背景
	 */
	public static needAutoUpdate(config: WorkspaceConfiguration) {
		// 检查是否存在背景图片
		if(config.imagePath == ''){
			return;
		}

		let nowBlenaStr = bleandHelper.autoBlendModel();

		PickList.itemList = new PickList( config );
		PickList.itemList.updateDom(false, nowBlenaStr as string).then(()=>{
				commands.executeCommand( 'workbench.action.reloadWindow' );
		}).catch(error => {
			console.error("Error updating the DOM:", error);
		});
	}

	/**
	 *  主题变更后自动更新背景
	 */
	public static autoUpdateBlendModel() {
		let config = workspace.getConfiguration( 'backgroundCover' );
		//是否存在背景图片
		if(config.imagePath == ''){
			return;
		}

		let context = getContext();
		let blendStr = context.globalState.get('backgroundCoverBlendModel');
		let nowBlenaStr = bleandHelper.autoBlendModel();
		if(blendStr == nowBlenaStr){
			return false;
		}

		// 弹出提示框确认是否重启
		window.showInformationMessage('主题模式发生变更，是否更新背景混合模式？', 'YES', 'NO' ).then(
				( value ) => {
					if ( value === 'YES' ) {
						PickList.itemList = new PickList( config );
						PickList.itemList.updateDom(false, nowBlenaStr as string).then(()=>{
								commands.executeCommand( 'workbench.action.reloadWindow' );
							}
						)
						
					}
				} 
			);
	}

	/**
	 *  自动更新背景
	 */
	public static autoUpdateBackground() {
		let config = workspace.getConfiguration( 'backgroundCover' );
		if ( !config.randomImageFolder || !config.autoStatus ) {
			return false;
		}
		PickList.itemList = new PickList( config );
		PickList.itemList.autoUpdateBackground();
		return PickList.itemList = undefined;
	}

	/**
	 *  随机更新一张背景
	 */
	public static randomUpdateBackground() {
		let config = workspace.getConfiguration( 'backgroundCover' );
		if ( !config.randomImageFolder ) {
			window.showWarningMessage(
				'Please add a directory! / 请添加目录！' );
			return false;
		}
		PickList.itemList = new PickList( config );
		PickList.itemList.setRandUpdate( true );
		PickList.itemList.autoUpdateBackground();
		PickList.itemList = undefined;
		//return commands.executeCommand( 'workbench.action.reloadWindow' );
	}

	public static updateImgPath( path: string ) {
		// 检测图片地址格式
		let isUrl = ( path.substr( 0, 8 ).toLowerCase() === 'https://' );
		if ( !isUrl ) {
			vsHelp.showInfo( "非https格式图片，不支持配置！ / Non HTTPS format image, configuration not supported!" )
			return false
		}
		let config = workspace.getConfiguration( 'backgroundCover' );
		PickList.itemList = new PickList( config );
		PickList.itemList.setImageFileType( 2 );
		PickList.itemList.updateBackgound( path );
		
	}

	// 列表构造方法
	private constructor(
		config: WorkspaceConfiguration,
		pickList?: QuickPick<ImgItem> ) {
		this.config = config;
		this.imgPath = config.imagePath;
		this.opacity = config.opacity;
		this.sizeModel = config.sizeModel || 'cover';
		this.imageFileType = 0;
		this.blur = config.blur;

		if ( pickList ) {
			this.quickPick = pickList;
			this.quickPick.onDidAccept(
				( e: any ) => this.listChange(
					this.quickPick.selectedItems[0].imageType,
					this.quickPick.selectedItems[0].path ) );
			this.quickPick.onDidHide( () => {
				this.dispose();
			}, null, this._disposables );
			this.quickPick.show();
		}
	}

	// 列表点击事件分配
	private listChange( type: number, path?: string ) {
		switch ( type ) {
			case 1:
				this.imgList();  // 展示图片列表
				break;
			case 2:
				this.openFieldDialog( 2 );  // 弹出选择文件夹对话框
				break;
			case 3:
				this.openFieldDialog( 1 );  // 弹出选择图片文件对话框
				break;
			case 4:
				this.updateBackgound( path );  // 选择列表内图片，更新背景css
				break;
			case 5:
				this.showInputBox( 2 );  // 更改透明度
				break;
			case 6:
				this.showInputBox( 1 );  // 输入图片路径更新背景
				break;
			case 7:
				this.updateDom( true );  // 关闭背景图片展示
				break;
			case 8:
				commands.executeCommand(
					'workbench.action.reloadWindow' );  // 重新加载窗口，使设置生效
				break;
			case 9:
				this.quickPick.hide();  // 隐藏设置弹窗
				break;
			case 10:
				this.setConfigValue( 'autoStatus', false, false );
				this.quickPick.hide();
				break;
			case 11:
				if ( !this.config.randomImageFolder ) {
					window.showWarningMessage(
						'Please add a directory! / 请添加目录后再来开启！' );
				} else {
					this.setConfigValue( 'autoStatus', true, false );
					this.autoUpdateBackground();
				}
				this.quickPick.hide();
				break;
			case 12:
				this.moreMenu();
				break;
			case 13:
				this.gotoPath( path );
				break;
			case 14:
				PickList.gotoFilePath( path );
				break;
			case 15:
				this.sizeModelView();
				break;
			case 16:
				this.setSizeModel( path );
				break;
			case 17:
				// 打开viewsContainers
				commands.executeCommand( 'workbench.view.extension.backgroundCover-explorer' );
				break;
			case 18:
				this.showInputBox( 3 );  // 修改模糊度
				break;
			default:
				break;
		}
	}

	private gotoPath( path?: string ) {
		if ( path == undefined ) {
			return window.showWarningMessage( '无效菜单' );
		}
		let tmpUri: string = path

		env.openExternal( Uri.parse( tmpUri ) )
	}

	public static gotoFilePath( path?: string ) {
		if ( path == undefined ) {
			return window.showWarningMessage( '无效菜单' );
		}
		let tmpUri: string = path
		let extPath = extensions.getExtension( "manasxx.background-cover" )?.extensionPath
		let tmpPath = "file:///" + extPath + tmpUri
		let tmpurl = Uri.parse( tmpPath )

		commands.executeCommand( 'vscode.openFolder', tmpurl );
	}



	private moreMenu() {
		let items: ImgItem[] = [
			{
				label: '$(github)    Repository               ',
				description: '仓库地址',
				imageType: 13,
				path: "https://github.com/AShujiao/vscode-background-cover"
			},
			{
				label: '$(issues)    Issues                       ',
				description: '有疑问就来提问',
				imageType: 13,
				path: "https://github.com/AShujiao/vscode-background-cover/issues"
			},
			{
				label: '$(star)    Star                           ',
				description: '给作者点个Star吧',
				imageType: 13,
				path: "https://github.com/AShujiao/vscode-background-cover"
			}
		];

		this.quickPick.items = items;
		this.quickPick.show();
	}

	private sizeModelView() {
		let items: ImgItem[] = [
			{
				label: '$(diff-ignored)    cover (default)               ',
				description: '填充(默认) ' + ( this.sizeModel == 'cover' ? '$(check)' : '' ),
				imageType: 16,
				path: "cover"
			},
			{
				label: '$(layout-menubar)    repeat                            ',
				description: '平铺' + ( this.sizeModel == 'repeat' ? '$(check)' : '' ),
				imageType: 16,
				path: "repeat"
			},
			{
				label: '$(diff-added)    contain                           ',
				description: '拉伸' + ( this.sizeModel == 'contain' ? '$(check)' : '' ),
				imageType: 16,
				path: "contain"
			},
			{
				label: '$(diff-modified)    not(center)                     ',
				description: '无适应(居中)' + ( this.sizeModel == 'not_center' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_center"
			},
			{
				label: '$(layout)    not(right_bottom)          ',
				description: '无适应(右下角)' + ( this.sizeModel == 'not_right_bottom' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_right_bottom"
			},
			{
				label: '$(layout)    not(right_top)                ',
				description: '无适应(右上角)' + ( this.sizeModel == 'not_right_top' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_right_top"
			},
			{
				label: '$(layout)    not(left)                          ',
				description: '无适应(靠左)' + ( this.sizeModel == 'not_left' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_left"
			},
			{
				label: '$(layout)    not(right)                        ',
				description: '无适应(靠右)' + ( this.sizeModel == 'not_right' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_right"
			},
			{
				label: '$(layout)    not(top)                          ',
				description: '无适应(靠上)' + ( this.sizeModel == 'not_top' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_top"
			},
			{
				label: '$(layout)    not(bottom)                    ',
				description: '无适应(靠下)' + ( this.sizeModel == 'not_bottom' ? '$(check)' : '' ),
				imageType: 16,
				path: "not_bottom"
			},
		];

		this.quickPick.items = items;
		this.quickPick.show();
	}

	//释放资源
	private dispose() {
		PickList.itemList = undefined;
		// Clean up our resources
		this.quickPick.hide();

		while ( this._disposables.length ) {
			const x = this._disposables.pop();
			if ( x ) {
				x.dispose();
			}
		}
	}

	/**
	 * 启动时自动更新背景
	 */
	private autoUpdateBackground() {
		if ( this.checkFolder( this.config.randomImageFolder ) ) {
			// 获取目录下的所有图片
			let files: string[] =
				this.getFolderImgList( this.config.randomImageFolder );
			// 是否存在图片
			if ( files.length > 0 ) {
				// 获取一个随机路径存入数组中
				let randomFile = files[Math.floor( Math.random() * files.length )];
				let file = path.join( this.config.randomImageFolder, randomFile );
				this.listChange( 4, file );
			}
		}
		return true;
	}

	// 根据图片目录展示图片列表
	private imgList( folderPath?: string ) {
		let items: ImgItem[] = [{
			label: '$(diff-added)  Manual selection',
			description: '选择一张背景图',
			imageType: 3
		}];

		let randomPath: any =
			folderPath ? folderPath : this.config.randomImageFolder;
		if ( this.checkFolder( randomPath ) ) {
			// 获取目录下的所有图片
			let files: string[] = this.getFolderImgList( randomPath );
			// 是否存在图片
			if ( files.length > 0 ) {
				// 获取一个随机路径存入数组中
				let randomFile = files[Math.floor( Math.random() * files.length )];
				items.push( {
					label: '$(light-bulb)  Random pictures',
					description: '随机自动选择       ctrl+shift+F7',
					imageType: 4,
					path: path.join( randomPath, randomFile )
				} );
				items.push( {
					label: '',
					description: '',
					imageType: 0,
					kind: QuickPickItemKind.Separator
				} );
				items = items.concat( files.map(
					( e ) => new ImgItem( '$(tag) ' + e, e, 4, path.join( randomPath, e ) ) ) );
			}
		}

		this.quickPick.items = items;
		this.quickPick.show();
	}

	/**
	 * 获取目录下的所有图片
	 * @param pathUrl
	 */
	private getFolderImgList( pathUrl: string ): string[] {
		if ( !pathUrl || pathUrl === '' ) {
			return [];
		}
		// 获取目录下的所有图片
		let files: string[] = fs.readdirSync( path.resolve( pathUrl ) ).filter( ( s ) => {
			return s.endsWith( '.png' ) || s.endsWith( '.PNG' ) || s.endsWith( '.jpg' ) || s.endsWith( '.JPG' )
				|| s.endsWith( '.jpeg' ) || s.endsWith( '.gif' ) || s.endsWith( '.webp' ) || s.endsWith( '.bmp' )
				|| s.endsWith( '.jfif' );
		} );

		return files;
	}


	// 检查选择的文件及目录是否正确
	private checkFolder( folderPath: string ) {
		if ( !folderPath ) {
			return false;
		}
		// 判断路径是否存在
		let fsStatus = fs.existsSync( path.resolve( folderPath ) );
		if ( !fsStatus ) {
			return false;
		}
		// 判断是否为目录路径
		let stat = fs.statSync( folderPath );
		if ( !stat.isDirectory() ) {
			return false;
		}

		return true;
	}

	// 创建一个输入框
	private showInputBox( type: number ) {
		if ( type <= 0 || type > 3 ) { return false; }

		let placeStringArr: string[] = [
			'',
			'Please enter the image path to support local and HTTPS',
			'Opacity ranges：0.00 - 1,current:(' + this.opacity + ')' ,
			'Set image blur: 0-100',
		];

		let promptStringArr: string[] = [
			'',
			'请输入图片路径，支持本地及https',
			'设置图片不透明度：0 - 0.8' ,
			'设置图片模糊度：0 - 100',
		];

		let placeString = placeStringArr[type];
		let promptString = promptStringArr[type];


		let option: InputBoxOptions = {
			ignoreFocusOut: true,
			password: false,
			placeHolder: placeString,
			prompt: promptString
		};

		window.showInputBox( option ).then( value => {
			//未输入值返回false
			if ( !value ) {
				window.showWarningMessage(
					'Please enter configuration parameters / 请输入配置参数！' );
				return;
			}
			if ( type === 1 ) {
				// 判断路径是否存在
				let fsStatus = fs.existsSync( path.resolve( value ) );
				let isUrl = ( value.substr( 0, 8 ).toLowerCase() === 'https://' );
				if ( !fsStatus && !isUrl ) {
					window.showWarningMessage(
						'No access to the file or the file does not exist! / 无权限访问文件或文件不存在！' );
					return false;
				}
			} else if(type == 2) {
				let isOpacity = parseFloat( value );

				if ( isOpacity < 0 || isOpacity > 0.8 || isNaN( isOpacity ) ) {
					window.showWarningMessage( 'Opacity ranges in：0 - 0.8！' );
					return false;
				}
			}else if(type == 3) {
				let blur = parseFloat( value );

				if ( blur < 0 || blur > 100 || isNaN( blur ) ) {
					window.showWarningMessage( 'Blur ranges in：0 - 100！' );
					return false;
				}
			}

			// set配置
			let keyArr = [
				'',
				'imagePath',
				'opacity',
				'blur',
			];
			let setKey = keyArr[type]

			this.setConfigValue( setKey, ( type === 1 ? value : parseFloat( value ) ), true );
		} )
	}

	private setSizeModel( value?: string ) {
		if ( !value ) {
			return vsHelp.showInfo( 'No parameter value was obtained / 未获取到参数值' );
		}
		this.setConfigValue( 'sizeModel', value, true );
	}

	public setImageFileType( value: number ) {
		this.imageFileType = value;
	
	}

	// 更新配置
	public updateBackgound( path?: string ) {
		if ( !path ) {
			return vsHelp.showInfo( 'Unfetched Picture Path / 未获取到图片路径' );
		}
		this.setConfigValue( 'imagePath', path );
	}

	// 文件、目录选择
	private async openFieldDialog( type: number ) {
		let isFolders = type === 1 ? false : true;
		let isFiles = type === 2 ? false : true;
		let filters =
			type === 1 ? { 'Images': ['png', 'jpg', 'gif', 'jpeg', 'jfif', 'webp', 'bmp'] } : undefined;
		let folderUris = await window.showOpenDialog( {
			canSelectFolders: isFolders,
			canSelectFiles: isFiles,
			canSelectMany: false,
			openLabel: 'Select folder',
			filters: filters
		} );
		if ( !folderUris ) {
			return false;
		}
		let fileUri = folderUris[0];
		if ( type === 2 ) {
			this.setConfigValue( 'randomImageFolder', fileUri.fsPath, false );
			return this.imgList( fileUri.fsPath );
		}
		if ( type === 1 ) {
			return this.setConfigValue( 'imagePath', fileUri.fsPath );
		}

		return false;
	}

	// 更新配置
	private setConfigValue( name: string, value: any, updateDom: Boolean = true ) {
		// 更新变量
		this.config.update( name, value, ConfigurationTarget.Global );
		switch ( name ) {
			case 'opacity':
				this.opacity = value;
				break;
			case 'imagePath':
				this.imgPath = value;
				break;
			case 'sizeModel':
				this.sizeModel = value;
				break;
			case 'blur':
				this.blur = value;
				break;
			default:
				break;
		}
		// 是否需要更新Dom
		if ( updateDom ) {
			this.updateDom();
		}
		return true;
	}

	public setRandUpdate( value: boolean ) {
		this.randUpdate = value;
	}




	// 更新、卸载css
	private async updateDom(uninstall: boolean = false, colorThemeKind:string = ""): Promise<void> {
		// 自动修改混合模式
		if(colorThemeKind == ""){
			colorThemeKind     = bleandHelper.autoBlendModel();
		}
		

		let context = getContext();
		context.globalState.update('backgroundCoverBlendModel',colorThemeKind);

		// 写入文件
		const dom = new FileDom(this.imgPath, this.opacity, this.sizeModel, this.blur, colorThemeKind);
		let result = false;

		try {
			if (uninstall) {
				this.config.update( "imagePath", "", ConfigurationTarget.Global );
				result = await dom.uninstall();
			} else {
				result = await dom.install();
			}

			if (result) {
				if (this.quickPick) {
					this.quickPick.placeholder = 'Reloading takes effect? / 重新加载生效？';
					this.quickPick.items = [
						{
							label: '$(check)   YES',
							description: '立即重新加载窗口生效',
							imageType: 8
						},
						{ label: '$(x)   NO', description: '稍后手动重启', imageType: 9 }
					];
					this.quickPick.ignoreFocusOut = true;
					this.quickPick.show();
				} else {
					// 通过在线图库更新提示弹窗
					if (this.imageFileType === 2) {
						// 弹出提示框确认是否重启
						const value = await window.showInformationMessage(
							`"${this.imgPath}" | Reloading takes effect? / 重新加载生效？`,
							'YES',
							'NO'
						);
						if (value === 'YES') {
							await commands.executeCommand('workbench.action.reloadWindow');
						}
					}

					// 快捷键更新背景
					if(this.randUpdate){
						// 提醒，即将自动重启生效背景
						window.showInformationMessage(
							`背景将在1秒后自动更新！ / The background will be automatically updated in 1 second!`
						);
						// sleep 1s
						await new Promise((resolve) => setTimeout(resolve, 1000));
						await commands.executeCommand('workbench.action.reloadWindow');
					}
				}
			}
		} catch (error: any) {
			await window.showErrorMessage(`更新失败: ${error.message}`);
		}
	}
}