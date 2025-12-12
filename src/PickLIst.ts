import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
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
} from 'vscode';

import { FileDom } from './FileDom';
import { ImgItem } from './ImgItem';
import vsHelp from './vsHelp';
import { getContext } from './global';
import bleandHelper from './bleandHelper';
import Color, { getColorList } from './color'; // 导入颜色定义
import { OnlineImageHelper } from './OnlineImageHelper';



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
		let config: WorkspaceConfiguration = workspace.getConfiguration( 'backgroundCover' );
		let list: QuickPick<ImgItem> = window.createQuickPick<ImgItem>();
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
		let context = getContext();
		const onlineFolder = context.globalState.get('backgroundCoverOnlineFolder');
		if (onlineFolder) {
			items.push({
				label: '$(cloud-download)    Refresh Online Folder   ',
				description: '刷新在线文件夹图片列表',
				imageType: 19
			});
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
				label: '$(sparkle)    Particle Effects🎉           ',
				description: '粒子效果设置🎉',
				imageType: 30
			},
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

	/**
	 *  随机更新一张背景
	 */
	public static startNest() {
		let config = workspace.getConfiguration( 'backgroundCover' );
		let list: QuickPick<ImgItem> = window.createQuickPick<ImgItem>();
		list.placeholder = 'Please choose configuration! / 请选择相关配置！';
		list.totalSteps = 2
		PickList.itemList = new PickList( config, list );
		PickList.itemList.particleEffectSettings();
		//return commands.executeCommand( 'workbench.action.reloadWindow' );
	}

	public static async updateImgPath( path: string ) {
		// 检测图片地址格式
		let isUrl = ( path.slice( 0, 8 ).toLowerCase() === 'https://' ) || ( path.slice( 0, 7 ).toLowerCase() === 'http://' );
		if ( !isUrl ) {
			vsHelp.showInfo( "非http/https格式图片，不支持配置！ / Non HTTP/HTTPS format image, configuration not supported!" );
			return false;
		}
		try {
			window.showInformationMessage( '正在检测在线资源类型... / Detecting online resource type...' );
			const images = await OnlineImageHelper.getOnlineImages( path );
			let config = workspace.getConfiguration( 'backgroundCover' );
			PickList.itemList = new PickList( config );
			PickList.itemList.setImageFileType( 2 );
			if ( images && images.length > 1 ) {
				window.showInformationMessage( `检测到在线文件夹，包含 ${images.length} 张图片！将随机选择一张作为背景。` );
				let context = getContext();
				context.globalState.update( 'backgroundCoverOnlineFolder', path );
				context.globalState.update( 'backgroundCoverOnlineImageList', images );
				await config.update( 'randomImageFolder', path, ConfigurationTarget.Global );
				const randomImage = images[Math.floor( Math.random() * images.length )];
				PickList.itemList.updateBackgound( randomImage );
			} else {
				window.showInformationMessage( '检测到单张在线图片！' );
				const actualImage = ( images && images.length > 0 ) ? images[0] : path;
				PickList.itemList.updateBackgound( actualImage, true );
			}
		} catch ( error: any ) {
			window.showErrorMessage( `在线资源检测失败: ${error.message}` );
			let config = workspace.getConfiguration( 'backgroundCover' );
			PickList.itemList = new PickList( config );
			PickList.itemList.setImageFileType( 2 );
			PickList.itemList.updateBackgound( path, true );
		}
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
			case 19:
				this.refreshOnlineFolder(); // 刷新在线文件夹
				break;
			case 30:
				this.particleEffectSettings();
				break;
			case 31:
				this.toggleParticleEffect();
				break;
			case 32:
				this.showInputBox( 10 ); // 粒子透明度
				break;
			case 33:
				this.showColorSelection(); // 粒子颜色
				break;
			case 34:
				this.showInputBox( 12 ); // 粒子数量
				break;
			case 101:
				if (path) {
					const colorValue = Color(path); // 获取颜色RGB值
					this.setContextValue('backgroundCoverParticleColor', colorValue, true);
				}
				break;
			case 102:
				this.showInputBox(11); // 输入自定义颜色
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
				label: '$(diff-added)    center                             ',
				description: '居中' + ( this.sizeModel == 'center' ? '$(check)' : '' ),
				imageType: 16,
				path: "center"
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

	public particleEffectSettings() {
		let enabled = getContext().globalState.get('backgroundCoverParticleEffect', false);
		
		let items: ImgItem[] = [
			{
				label: enabled ? 
					'$(circle-filled)    Disable Particles        ' :
					'$(circle-outline)    Enable Particles        ',
				description: enabled ? '关闭粒子效果' : '启用粒子效果',
				imageType: 31
			},
			{
				label: '$(settings)    Particle Opacity         ',
				description: '设置粒子透明度',
				imageType: 32
			},
			{
				label: '$(symbol-color)    Select Color               ',
				description: '选择粒子颜色',
				imageType: 33
			},
			{
				label: '$(multiple-windows)    Particle Count           ',
				description: '设置粒子数量',
				imageType: 34
			},

		];

		this.quickPick.items = items;
		this.quickPick.show();
	}

	private toggleParticleEffect() {
		let currentValue = getContext().globalState.get('backgroundCoverParticleEffect', false);
		this.setContextValue('backgroundCoverParticleEffect', !currentValue, true);
	}

	private showColorSelection() {
		let items: ImgItem[] = [];

		// 添加自定义颜色选项
		items.push({
			label: '$(pencil)    Custom Color',
			description: '输入自定义RGB颜色 (例如: 255,255,255)',
			imageType: 102
		});
		
		// 遍历color.ts中定义的所有颜色
		const colorList = getColorList();
		for (const colorName of colorList) {
			items.push({
				label: `$(symbol-color)    ${colorName}`,
				description: ``,
				imageType: 101, // 使用新的类型标识颜色选择
				path: colorName
			});
		}
		
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
	private async autoUpdateBackground(): Promise<boolean> {
		let context = getContext();
		const onlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
		const cachedImages = context.globalState.get<string[]>('backgroundCoverOnlineImageList');
		if ( onlineFolder && this.isOnlineUrl( onlineFolder ) ) {
			try {
				let images = cachedImages as string[] | undefined;
				if ( !images || images.length === 0 ) {
					window.showInformationMessage('正在从在线文件夹获取图片列表...');
					images = await OnlineImageHelper.getOnlineImages( onlineFolder );
					context.globalState.update('backgroundCoverOnlineImageList', images);
				}
				if ( images && images.length > 0 ) {
					const randomImage = images[Math.floor( Math.random() * images.length )];
					this.listChange( 4, randomImage );
					return true;
				}
			} catch ( error: any ) {
				console.error('从在线文件夹获取图片失败:', error);
				window.showWarningMessage('在线文件夹访问失败，请检查网络连接！');
				this.clearOnlineFolder(true);
			}
		}
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

	/**
	 * 刷新在线文件夹列表
	 */
	private async refreshOnlineFolder() {
		let context = getContext();
		const onlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
		if ( !onlineFolder ) {
			window.showWarningMessage('未找到在线文件夹配置！');
			return;
		}
		let success = false;
		try {
			window.showInformationMessage('正在刷新在线文件夹图片列表...');
			const images = await OnlineImageHelper.getOnlineImages( onlineFolder );
			if ( images && images.length > 0 ) {
				const normalizedFolder = this.normalizePathKey(onlineFolder);
				if (images.length === 1 && this.normalizePathKey(images[0]) === normalizedFolder) {
					window.showInformationMessage('检测到链接仅返回单张图片，已切换为单图模式。');
					this.updateBackgound( images[0], true );
					success = true;
				} else {
					context.globalState.update('backgroundCoverOnlineImageList', images);
					window.showInformationMessage(`刷新成功！发现 ${images.length} 张图片。`);
					const randomImage = images[Math.floor( Math.random() * images.length )];
					this.updateBackgound( randomImage );
					success = true;
				}
			} else {
				window.showWarningMessage('未在该URL找到图片！');
				this.clearOnlineFolder(true);
			}
		} catch ( error: any ) {
			window.showErrorMessage(`刷新失败: ${error.message}`);
			this.clearOnlineFolder(true);
		}
		if ( success ) {
			this.quickPick.hide();
		}
	}

	/**
	 * 清理在线文件夹缓存
	 */
	private clearOnlineFolder(resetRandomFolder: boolean = false) {
		const context = getContext();
		const previousOnlineFolder = context.globalState.get<string>('backgroundCoverOnlineFolder');
		context.globalState.update('backgroundCoverOnlineFolder', undefined);
		context.globalState.update('backgroundCoverOnlineImageList', undefined);
		if (resetRandomFolder && previousOnlineFolder) {
			const currentRandomFolder = this.config.get<string>('randomImageFolder');
			if (this.normalizePathKey(currentRandomFolder) === this.normalizePathKey(previousOnlineFolder)) {
				this.config.update('randomImageFolder', '', ConfigurationTarget.Global);
			}
		}
	}

	private normalizePathKey(value?: string | null): string {
		if (!value) {
			return '';
		}
		const trimmed = value.trim();
		if (/^https?:/i.test(trimmed)) {
			try {
				const parsed = new URL(trimmed);
				const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/';
				const search = parsed.search ?? '';
				return `${parsed.protocol}//${parsed.host}${normalizedPath}${search}`;
			} catch {
				return trimmed.replace(/\/+$/, '');
			}
		}
		return path.normalize(trimmed).replace(/\\+/g, '/');
	}

	/**
	 * 判断URL是否为在线地址
	 */
	private isOnlineUrl( url?: string ): boolean {
		if ( !url ) {
			return false;
		}
		const lower = url.toLowerCase();
		return lower.startsWith( 'http://' ) || lower.startsWith( 'https://' );
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
	private async showInputBox( type: number ) {
		if ( type <= 0 || type > 12 ) { return false; }
		let context = getContext();
		let placeStringArr: string[] = [
			'',
			'Please enter the image path to support local and HTTPS',
			'Opacity ranges：0.00 - 1,current:(' + this.opacity + ')' ,
			'Set image blur: 0-100,current:(' + this.blur + ')' ,
			'','','','','','',
			'Particle opacity (0.1 - 1),current:(' + context.globalState.get("backgroundCoverParticleOpacity") + ')' ,
			'Particle color (e.g.:255,255,255),current:(' + context.globalState.get("backgroundCoverParticleColor") + ')' ,
			'Particle count (1 - 200),current:(' + context.globalState.get("backgroundCoverParticleCount") + ')'
		];

		let promptStringArr: string[] = [
			'',
			'请输入图片路径，支持本地及https',
			'设置图片不透明度：0 - 0.8,当前值：' + this.opacity,
			'设置图片模糊度：0 - 100,当前值：' + this.blur,
			'','','','','','',
			'粒子透明度 (0.1 - 1),当前值：' + context.globalState.get("backgroundCoverParticleOpacity"),
			'粒子颜色 (例如:255,255,255),当前值：' + context.globalState.get("backgroundCoverParticleColor"),
			'粒子数量 (1 - 200),当前值：' + context.globalState.get("backgroundCoverParticleCount")
		];

		let placeString = placeStringArr[type];
		let promptString = promptStringArr[type];

		let option: InputBoxOptions = {
			ignoreFocusOut: true,
			password: false,
			placeHolder: placeString,
			prompt: promptString
		};

		let value = await window.showInputBox( option );
		// 未输入值返回false
		if ( !value ) {
			window.showWarningMessage(
				'Please enter configuration parameters / 请输入配置参数！' );
			return false;
		}

		let shouldClearOnlineCache = false;

		if ( type === 1 ) {
			let fsStatus = fs.existsSync( path.resolve( value ) );
			let isUrl = ( value.slice( 0, 8 ).toLowerCase() === 'https://' ) || ( value.slice( 0, 7 ).toLowerCase() === 'http://' );
			if ( !fsStatus && !isUrl ) {
				window.showWarningMessage(
					'No access to the file or the file does not exist! / 无权限访问文件或文件不存在！' );
				return false;
			}

			if ( !isUrl ) {
				shouldClearOnlineCache = true;
			}

			if ( isUrl ) {
				try {
					window.showInformationMessage('正在检测在线资源类型... / Detecting online resource type...');
					const images = await OnlineImageHelper.getOnlineImages( value );
					console.log('[background-cover] OnlineImageHelper result count:', images ? images.length : 0);
					if ( images && images.length > 1 ) {
						let config = workspace.getConfiguration( 'backgroundCover' );
						PickList.itemList = new PickList( config );
						PickList.itemList.setImageFileType( 2 );
						let context = getContext();
						await context.globalState.update( 'backgroundCoverOnlineFolder', value );
						await context.globalState.update( 'backgroundCoverOnlineImageList', images );
						await config.update( 'randomImageFolder', value, ConfigurationTarget.Global );
						const randomImage = images[Math.floor( Math.random() * images.length )];
						PickList.itemList.updateBackgound( randomImage );
						return true;
					} else if ( images && images.length === 1 ) {
						value = images[0];
						shouldClearOnlineCache = true;
					}
				} catch ( err: any ) {
					console.error('[background-cover] OnlineImageHelper error:', err && err.message ? err.message : err);
					window.showWarningMessage('在线资源检测失败，按单张图片处理 / Online detection failed, treating as single image');
					shouldClearOnlineCache = true;
				}
			} else {
				shouldClearOnlineCache = true;
			}
		}
		else if (type === 2) {
			let isOpacity = parseFloat( value );

			if ( isOpacity < 0 || isOpacity > 0.8 || isNaN( isOpacity ) ) {
				window.showWarningMessage( 'Opacity ranges in：0 - 0.8！' );
				return false;
			}
		}
		else if (type === 3) {
			let blur = parseFloat( value );

			if ( blur < 0 || blur > 100 || isNaN( blur ) ) {
				window.showWarningMessage( 'Blur ranges in：0 - 100！' );
				return false;
			}
		} else if (type === 10) {
			let particleOpacity = parseFloat(value);
			if (particleOpacity < 0 || particleOpacity > 1 || isNaN(particleOpacity)) {
				window.showWarningMessage('粒子透明度范围：0 - 1！');
				return false;
			}
		} else if (type === 11) {
			if (!value.includes(',')) {
				window.showWarningMessage('颜色格式无效，请使用RGB(255,255,255)格式！');
				return false;
			}
		} else if (type === 12) {
			let particleCount = parseInt(value);
			if (particleCount < 1 || particleCount > 200 || isNaN(particleCount)) {
				window.showWarningMessage('粒子数量范围：1 - 200！');
				return false;
			}
		}

		let keyArr = [
			'',
			'imagePath',
			'opacity',
			'blur',
			'','','','','','',
			'backgroundCoverParticleOpacity',
			'backgroundCoverParticleColor',
			'backgroundCoverParticleCount'
		];
	let setKey = keyArr[type];

		if (type === 1 && shouldClearOnlineCache) {
			this.clearOnlineFolder(true);
		}

		if (type === 12) {
			this.setContextValue(setKey, parseInt(value), true);
		} else if (type === 11) {
			this.setContextValue(setKey, value, true);
		} else if (type === 10) {
			this.setContextValue(setKey, parseFloat(value), true);
		} else {
			this.setConfigValue(setKey, ( type === 1 ? value : parseFloat( value ) ), true );
		}
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
	public updateBackgound( path?: string, clearOnlineCache: boolean = false ) {
		if ( !path ) {
			return vsHelp.showInfo( 'Unfetched Picture Path / 未获取到图片路径' );
		}
		if ( clearOnlineCache || !this.isOnlineUrl( path ) ) {
			this.clearOnlineFolder( true );
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
			this.clearOnlineFolder(true);
			this.setConfigValue( 'randomImageFolder', fileUri.fsPath, false );
			return this.imgList( fileUri.fsPath );
		}
		if ( type === 1 ) {
			this.clearOnlineFolder(true);
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


	// 更新配置
	private setContextValue( name: string, value: any, updateDom: Boolean = true ) {
		// 更新变量
		getContext().globalState.update( name, value );

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
		const dom = new FileDom(this.config,this.imgPath, this.opacity, this.sizeModel, this.blur, colorThemeKind);
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