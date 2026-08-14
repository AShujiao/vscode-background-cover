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
import vsHelp from './vsHelp';
import ReaderViewProvider from './readerView';
import { setContext } from './global';
import { CUSTOM_JS_FILE_PATH, collectStaleWindowCssFiles } from './FileDom';
import { BackgroundCoverViewProvider } from './backgroundCoverView';
import { StudioViewProvider } from './StudioViewProvider';
import { hasCurrentImageRecord, resolveCurrentImagePath, setCurrentImagePath } from './windowBackground';


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
	checkVSCodeVersionChanged(context).then(async isChanged => {
		if (!isChanged) {
			const config = workspace.getConfiguration('backgroundCover');
			const resolved = resolveCurrentImagePath(config.imagePath || '');
			const hasImage = !!resolved || hasCurrentImageRecord();
			if (hasImage && !fs.existsSync(CUSTOM_JS_FILE_PATH)) {
				const ex: Extension<any> | undefined = extensions.getExtension('manasxx.background-cover');
				const extensionVersion: string = ex ? ex.packageJSON['version'] : '';
				window.showInformationMessage(
					`BackgroundCover ${extensionVersion || ''}：检测到核心文件尚未初始化，需要重新应用背景补丁。是否立即执行？ / BackgroundCover ${extensionVersion || ''}: Core files are not initialized. Apply the background patch now?`,
					'Apply / 应用',
					'Later / 稍后'
				).then(async result => {
					if (result === 'Apply / 应用') {
						const requiresReload = await PickList.applyCurrentBackground();
						if (requiresReload) {
							await promptRestartWindow();
						}
					}
				});
			} else {
				if (hasImage) {
					await PickList.applyCurrentBackground();
				}
				PickList.autoUpdateBackground();
			}
		}
	});

	// 启动自动更换任务
	PickList.startAutoRandomTask();

	// 回收历史窗口会话遗留的 CSS 文件，不阻塞启动
	void collectStaleWindowCssFiles();

	// 监听配置变化
	context.subscriptions.push(workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration('backgroundCover.autoStatus') || e.affectsConfiguration('backgroundCover.autoInterval')) {
			PickList.startAutoRandomTask();
		}
		if (e.affectsConfiguration('backgroundCover.perWindowBackground')) {
			// 切换独立/共用模式：重新应用一次，让本窗口写到新的目标 CSS 文件，
			// 并把注入端的地址复位。其余窗口各自收到同一事件后自行处理。
			void PickList.applyCurrentBackground();
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
		commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
		studioViewProvider.refresh();
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
	context.subscriptions.push(commands.registerCommand('backgroundCover.runAction', async (type: number, path?: string) => {
		const config = workspace.getConfiguration('backgroundCover');
		// No QuickPick: webview-originated actions must not flash a native popup
		// or open the legacy "Reloading takes effect?" prompt. The Studio panel
		// is the user-facing UI now.
		const pickList = new PickList(config);
		await pickList.handleAction(type, path);
	}));


	context.subscriptions.push(commands.registerCommand('backgroundCover.setConfig', async (key: string, value: any) => {
		if (key === 'backgroundCover.imagePath') {
			// 全局兜底由 windowBackground 的 globalState 承担，不再回写 settings.json
			// （旧实现只在首次为空时写入，之后永久冻结在第一张图上）。
			await setCurrentImagePath(typeof value === 'string' ? value : '');
			await PickList.applyCurrentBackground();
			return;
		}
		const config = workspace.getConfiguration();
		await config.update(key, value, true);
		if (key === 'backgroundCover.perWindowBackground') {
			// 重新应用交给 onDidChangeConfiguration 统一处理，避免连开两次。
			return;
		}
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
    1.  新增多窗口独立背景，每个窗口可显示各自的背景图（可在高级设置中切回全部窗口共用）。
    2.  优化多窗口授权体验，新开窗口不再反复弹出 UAC 授权窗口。
    3.  优化自动换图容错，网络失败会静默重试或换图，不再弹窗打断。

❤️ 觉得好用吗？支持一下在线图库运营吧！`);
	}
}

// 检查 VSCode 版本是否变化
async function checkVSCodeVersionChanged(context: ExtensionContext): Promise<boolean> {
	// 获取配置
	let config = workspace.getConfiguration('backgroundCover');
	const resolved = resolveCurrentImagePath(config.imagePath || '');
	if (!resolved && !hasCurrentImageRecord()) {
		return false;
	}

	// 从全局状态中获取上次记录的 VSCode 版本
	let lastVSCodeVersion = context.globalState.get('vscode_version');
	// 如果版本不同，说明 VSCode 更新了
	if (lastVSCodeVersion && lastVSCodeVersion !== vscodeVersion) {
		// 弹出提示框确认是否更新背景
		const value = await window.showInformationMessage(
			`检测到 VS Code 已从 ${lastVSCodeVersion} 更新到 ${vscodeVersion}，背景补丁可能已被重置。是否重新应用并重载窗口？ / VS Code was updated from ${lastVSCodeVersion} to ${vscodeVersion}. Reapply the background patch and reload the window?`,
			'Apply and Reload / 应用并重载',
			'Later / 稍后'
		);

		if (value === 'Apply and Reload / 应用并重载') {
			// Update the stored version BEFORE any operation that might reload/close the window
			await context.globalState.update('vscode_version', vscodeVersion);

			// Apply the background patch
			const requiresReload = await PickList.applyCurrentBackground();
			if (requiresReload) {
				// VSCode updates replace workbench files; the Electron main process has
				// already cached the compiled bytecode of the old (unpatched) workbench.
				// A soft reload (workbench.action.reloadWindow) only rebuilds the renderer
				// process and still pulls from the stale cache. A full restart is required
				// to clear the main process cache and recompile the patched file.
				const restartChoice = await window.showInformationMessage(
					'背景补丁已应用，但需要完全关闭并重新打开 VS Code 才能生效（软重载不会清除编译缓存）。是否现在退出？ / Background patch applied. You must fully quit and restart VS Code for it to take effect (soft reload won\'t clear the compilation cache). Quit now?',
					'Quit / 退出',
					'Later / 稍后'
				);
				if (restartChoice === 'Quit / 退出') {
					await commands.executeCommand('workbench.action.quit');
				}
			} else {
				window.setStatusBarMessage('Background already applied. / 背景已应用。', 5000);
			}
		} else {
			// User chose "Later / 稍后" — still update the version so we don't prompt again
			await context.globalState.update('vscode_version', vscodeVersion);
		}

		return true;
	}

	// 修复：首次运行或版本未记录时，也需要更新版本号，防止下次误判
	if (!lastVSCodeVersion) {
		await context.globalState.update('vscode_version', vscodeVersion);
	}

	return false;
}

async function promptRestartWindow(): Promise<void> {
	const value = await window.showInformationMessage(
		'背景补丁已应用，但需要完全关闭并重新打开 VS Code 才能生效（软重载不会清除编译缓存）。是否现在退出？ / Background patch applied. You must fully quit and restart VS Code for it to take effect (soft reload won\'t clear the compilation cache). Quit now?',
		'Quit / 退出',
		'Later / 稍后'
	);
	if (value === 'Quit / 退出') {
		await commands.executeCommand('workbench.action.quit');
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	PickList.stopAutoRandomTask();
}
