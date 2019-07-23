'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PickList } from './PickLIst';

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
}

// this method is called when your extension is deactivated
export function deactivate() {
}

