/*
 * @Description: 
 * @Author: czw
 * @Date: 2023-08-25 10:00:03
 * @FilePath: \vscode-background-cover\src\extension.ts
 */
'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {
	commands,
	window,
	Extension,
	extensions,
	ExtensionContext,
	StatusBarAlignment,
	version as vscodeVersion,
	workspace, // 获取 VSCode 版本
} from 'vscode';
import { PickList } from './PickLIst';
import vsHelp from './vsHelp';
import ReaderViewProvider from './readerView';
import { setContext } from './global';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {
	setContext(context);
	// 创建底部按钮 - 背景图片配置
	let backImgBtn = window.createStatusBarItem(StatusBarAlignment.Right, -999);
	backImgBtn.text = '$(file-media)';
	backImgBtn.command = 'extension.backgroundCover.start';
	backImgBtn.tooltip = 'Switch background image / 切换背景图';
	backImgBtn.show();

	// 检查 VSCode 版本变化
	let isChanged = checkVSCodeVersionChanged(context);
	if (!isChanged) {
		// 防止同时运行
		PickList.autoUpdateBackground();
	}

	// 创建底部按钮 - 粒子效果配置
	let particleBtn = window.createStatusBarItem(StatusBarAlignment.Right, -999);
	particleBtn.text = '$(sparkle)';
	particleBtn.command = 'extension.backgroundCover.nest';
	particleBtn.tooltip = 'Particle effect / 粒子效果';
	particleBtn.show();



	let randomCommand = commands.registerCommand('extension.backgroundCover.refresh', () => { PickList.randomUpdateBackground(); });
	let startCommand = commands.registerCommand('extension.backgroundCover.start', () => { PickList.createItemLIst() });
	let particleEffectCommand = commands.registerCommand('extension.backgroundCover.nest', () => { PickList.startNest() });
	context.subscriptions.push(startCommand);
	context.subscriptions.push(randomCommand);
	context.subscriptions.push(particleEffectCommand);

	// webview
	const readerViewProvider = new ReaderViewProvider();
	window.registerWebviewViewProvider('backgroundCover.readerView', readerViewProvider, {
	  webviewOptions: {
		retainContextWhenHidden: true,
	  },
	});
	commands.registerCommand('backgroundCover.refreshEntry',() => readerViewProvider.refresh());
	commands.registerCommand('backgroundCover.home',() => readerViewProvider.home());


	// 监听主题变化
	window.onDidChangeActiveColorTheme((event) => {
        PickList.autoUpdateBlendModel();
    });



	 // 首次打开-提示语
	let openVersion:string|undefined           = context.globalState.get('ext_version');
	let ex:Extension<any>|undefined = extensions.getExtension('manasxx.background-cover');
	let version:string           = ex ? ex.packageJSON['version'] : '';
	
	if(openVersion != version){
		context.globalState.update('ext_version',version);
		vsHelp.showInfoSupport(`🎉 BackgroundCover 已更新至 ${version}
� 新特性：
1. 新增支持 code-server 平台
2. 输入图片地址功能增强 (支持 JSON API / HTML / 在线图库)
3. 支持将在线图库帖子设为背景源

❤️ 觉得好用吗？支持一下在线图库运营吧！`);
	}
}

// 检查 VSCode 版本是否变化
function checkVSCodeVersionChanged(context: ExtensionContext): boolean {
	// 获取配置
	let config = workspace.getConfiguration('backgroundCover');
	// 如果没有设置背景图，则不处理
	if (!config.imagePath) {
		return false;
	}

	// 从全局状态中获取上次记录的 VSCode 版本
	let lastVSCodeVersion = context.globalState.get('vscode_version');
	// 如果版本不同，说明 VSCode 更新了
	if (true) {
		// 弹出提示框确认是否更新背景
		window.showInformationMessage(
			`检测到 VSCode 已更新，背景图可能已被重置，是否重新应用背景图？ / Reapply the background image?`,
			'YES',
			'NO'
		).then((value) => {
			if (value === 'YES') {
				// 更新DOM
				PickList.needAutoUpdate(config);
			}
		});
		// 更新全局状态中的 VSCode 版本
		context.globalState.update('vscode_version', vscodeVersion);
		return true;
	}

	return false;
}

// this method is called when your extension is deactivated
export function deactivate() {
}

