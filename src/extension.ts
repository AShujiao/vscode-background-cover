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
import * as fs from 'fs';
import { PickList } from './PickList';
import { ImgItem } from './ImgItem';
import vsHelp from './vsHelp';
import ReaderViewProvider from './readerView';
import { setContext } from './global';
import { CUSTOM_CSS_FILE_PATH } from './FileDom';
import { BackgroundCoverViewProvider } from './backgroundCoverView';
import { StudioViewProvider } from './StudioViewProvider';


export function activate(context: ExtensionContext) {
	setContext(context);
	// 创建底部按钮 - 背景图片配置
	let backImgBtn = window.createStatusBarItem(StatusBarAlignment.Right, -999);
	backImgBtn.text = '$(file-media)';
	backImgBtn.command = 'extension.backgroundCover.showMenu';
	backImgBtn.tooltip = 'Switch background image / 切换背景图';
	backImgBtn.show();
	context.subscriptions.push(backImgBtn);

	// 创建底部按钮 - 粒子效果配置
	let particleBtn = window.createStatusBarItem(StatusBarAlignment.Right, -999);
	particleBtn.text = '$(sparkle)';
	particleBtn.command = 'extension.backgroundCover.nest';
	particleBtn.tooltip = 'Particle effect / 粒子效果';
	particleBtn.show();
	context.subscriptions.push(particleBtn);

	// 异步检查 VSCode 版本变化，不阻塞启动
	checkVSCodeVersionChanged(context).then(isChanged => {
		if (!isChanged) {
			const config = workspace.getConfiguration('backgroundCover');
			if (config.imagePath && !fs.existsSync(CUSTOM_CSS_FILE_PATH)) {
				window.showInformationMessage(
					'BackgroundCover 3.0：新版本支持免重启切换背景，需要重新初始化核心文件。是否立即执行？ / BackgroundCover 3.0: Supports background switching without restart. Core file re-initialization required. Proceed?',
					'Yes', 'No'
				).then(result => {
					if (result === 'Yes') {
						PickList.needAutoUpdate(config);
					}
				});
			} else {
				// 防止同时运行
				PickList.autoUpdateBackground();
			}
		}
	});

	// 启动自动更换任务
	PickList.startAutoRandomTask();

	// 监听配置变化
	context.subscriptions.push(workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('backgroundCover.autoStatus') || e.affectsConfiguration('backgroundCover.autoInterval')) {
			PickList.startAutoRandomTask();
		}
	}));

	let randomCommand = commands.registerCommand('extension.backgroundCover.refresh', () => { PickList.randomUpdateBackground(); });
	let startCommand = commands.registerCommand('extension.backgroundCover.start', () => { 
		commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
		commands.executeCommand('workbench.view.extension.backgroundCover-explorer');
	});
	let particleEffectCommand = commands.registerCommand('extension.backgroundCover.nest', () => { PickList.startNest() });
	let showMenuCommand = commands.registerCommand('extension.backgroundCover.showMenu', () => {
		commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
		commands.executeCommand('workbench.view.extension.backgroundCover-explorer');
	});
	context.subscriptions.push(startCommand);
	context.subscriptions.push(randomCommand);
	context.subscriptions.push(particleEffectCommand);
	context.subscriptions.push(showMenuCommand);

	// webview
	const readerViewProvider = new ReaderViewProvider();
	window.registerWebviewViewProvider('backgroundCover.readerView', readerViewProvider, {
	  webviewOptions: {
		retainContextWhenHidden: true,
	  },
	});

	// New Vue-powered Studio webview (primary configuration UI)
	const studioViewProvider = new StudioViewProvider(context);
	context.subscriptions.push(window.registerWebviewViewProvider(
		StudioViewProvider.viewType,
		studioViewProvider,
		{ webviewOptions: { retainContextWhenHidden: true } }
	));

	commands.registerCommand('backgroundCover.refreshEntry',() => {
		commands.executeCommand('setContext', 'backgroundCover.mode', 'gallery');
		readerViewProvider.refresh();
		studioViewProvider.navigate('gallery');
		}
	);
	commands.registerCommand('backgroundCover.home',() => {
		commands.executeCommand('setContext', 'backgroundCover.mode', 'gallery');
		readerViewProvider.home();
		studioViewProvider.navigate('gallery');
	});
	commands.registerCommand('backgroundCover.switchMode',() => {
		commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
		studioViewProvider.navigate('home');
	});
	commands.registerCommand('backgroundCover.support',() => readerViewProvider.support());

	// Register Tree Data Provider (with drag-and-drop support)
	const backgroundCoverViewProvider = new BackgroundCoverViewProvider();
	const backgroundCoverTreeView = window.createTreeView('backgroundCover.menu', {
		treeDataProvider: backgroundCoverViewProvider,
		dragAndDropController: backgroundCoverViewProvider,
		canSelectMany: false
	});
	context.subscriptions.push(backgroundCoverTreeView);

	// Register Command for Tree Item Click
	context.subscriptions.push(commands.registerCommand('backgroundCover.runAction', (type: number, path?: string) => {
		const config = workspace.getConfiguration('backgroundCover');
		const quickPick = window.createQuickPick<ImgItem>();
		const pickList = new PickList(config, quickPick);
		pickList.handleAction(type, path);
	}));


	context.subscriptions.push(commands.registerCommand('backgroundCover.setConfig', async (key: string, value: any) => {
		const config = workspace.getConfiguration();
		await config.update(key, value, true);
		// Trigger update
		const newConfig = workspace.getConfiguration('backgroundCover');
		PickList.needAutoUpdate(newConfig);
	}));

	// Initialize context
	commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');

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
🚀 更新内容：
    1.  修复远程随机图片自动切换时 "Lock file is already being held" 错误 (#193 by @Aierlanta)
    2.  优化自动轮播任务防止并发执行 (#193 by @Aierlanta)
    3.  修复 code-server 模式下静态资源缓存导致背景不更新的问题 (#194 by @WaaSakura)

感谢 @Aierlanta 和 @WaaSakura 的贡献！
❤️ 觉得好用吗？支持一下在线图库运营吧！`);
	}
}

// 检查 VSCode 版本是否变化
async function checkVSCodeVersionChanged(context: ExtensionContext): Promise<boolean> {
	// 获取配置
	let config = workspace.getConfiguration('backgroundCover');
	// 如果没有设置背景图，则不处理
	if (!config.imagePath) {
		return false;
	}

	// 从全局状态中获取上次记录的 VSCode 版本
	let lastVSCodeVersion = context.globalState.get('vscode_version');
	// 如果版本不同，说明 VSCode 更新了
	if (lastVSCodeVersion && lastVSCodeVersion !== vscodeVersion) {
		// 弹出提示框确认是否更新背景
		const value = await window.showInformationMessage(
			`检测到 VSCode 已更新，背景图可能已被重置，是否重新应用背景图？ / Reapply the background image?`,
			'YES',
			'NO'
		);
		
		if (value === 'YES') {
			// 更新DOM
			PickList.needAutoUpdate(config);
		}
		
		// 更新全局状态中的 VSCode 版本
		context.globalState.update('vscode_version', vscodeVersion);
		return true;
	}

	// 修复：首次运行或版本未记录时，也需要更新版本号，防止下次误判
	if (!lastVSCodeVersion) {
		context.globalState.update('vscode_version', vscodeVersion);
	}

	return false;
}

// this method is called when your extension is deactivated
export function deactivate() {
	PickList.stopAutoRandomTask();
}

