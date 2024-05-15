'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PickList } from './PickLIst';
import vsHelp from './vsHelp';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// 创建底部按钮
	let backImgBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, -999);
	backImgBtn.text = '$(file-media)';
	backImgBtn.command = 'extension.backgroundCover.start';
	backImgBtn.tooltip = 'Switch background image / 切换背景图';
	PickList.autoUpdateBackground();
	backImgBtn.show();
	let randomCommand = vscode.commands.registerCommand('extension.backgroundCover.refresh', () => { PickList.randomUpdateBackground(); });
	let startCommand = vscode.commands.registerCommand('extension.backgroundCover.start', () => { PickList.createItemLIst() });
	context.subscriptions.push(startCommand);
	context.subscriptions.push(randomCommand);

	 // 首次打开-提示语
	let openVersion:string|undefined           = context.globalState.get('ext_version');
	let ex:vscode.Extension<any>|undefined = vscode.extensions.getExtension('manasxx.background-cover');
	let version:string           = ex ? ex.packageJSON['version'] : '';
	let title:string = ex ?  ex.packageJSON['one_title'] : '';
	if(openVersion != version && title != ""){
		context.globalState.update('ext_version',version);
		vsHelp.showInfoWxChat('🐷已更新到2.4.0：支持设置图片填充方式及图片位置 --- 🐷\r🐶🐷🐔🦊加入开发者微信群聊🐯🐮🐹🐽❓');
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
}

