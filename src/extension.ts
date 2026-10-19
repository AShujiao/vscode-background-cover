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
import { CUSTOM_JS_FILE_PATH, collectStaleWindowCssFiles, detectPatchState } from './FileDom';
import { pruneOnlineCache } from './onlineCache';
import { BackgroundCoverViewProvider } from './backgroundCoverView';
import { StudioViewProvider } from './StudioViewProvider';
import { adoptSettingsLevelValue, consumeSelfWrittenLevel, hasCurrentImageRecord, resolveCurrentImagePath, setCurrentBlur, setCurrentImagePath, setCurrentOpacity } from './windowBackground';


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

			// A1: 以实际内核文件的内容标记判定补丁状态（none/legacy/latest）。
			// 覆盖"同一版本重装 VS Code / 用户手动还原 workbench 文件 / 打过旧版补丁"
			// 这些仅凭版本号或文件存在性检测不到的丢失场景。
			const patchState = await detectPatchState();
			const patchOutdated = patchState !== 'latest' || !fs.existsSync(CUSTOM_JS_FILE_PATH);

			if (hasImage && patchOutdated) {
				const ex: Extension<any> | undefined = extensions.getExtension('manasxx.background-cover');
				const extensionVersion: string = ex ? ex.packageJSON['version'] : '';
				window.showInformationMessage(
					`BackgroundCover ${extensionVersion || ''}：检测到背景补丁缺失或版本过旧，需要重新应用。是否立即执行？ / BackgroundCover ${extensionVersion || ''}: Background patch is missing or outdated. Apply it now?`,
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
	}).catch(err => {
		console.error('[BackgroundCover] startup apply failed:', err);
	});

	// 启动自动更换任务
	PickList.startAutoRandomTask();

	// 回收历史窗口会话遗留的 CSS 文件，不阻塞启动
	void collectStaleWindowCssFiles();

	// 收敛在线图片缓存目录：无扩展名在线源每次换图都会新增缓存文件，长期自动换图
	// 会让 images/ 无限增长（#233）。启动时清一次超过上限的最旧文件，不阻塞启动。
	void pruneOnlineCache();

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
		if (e.affectsConfiguration('backgroundCover.cacheLimit')) {
			// 调小上限后立即收敛一次，不必等下次下载或重启窗口。
			void pruneOnlineCache();
		}
		if (e.affectsConfiguration('backgroundCover.opacity') || e.affectsConfiguration('backgroundCover.blur')) {
			// 直接改 settings.json / 设置界面的透明度、模糊度也要立即生效，不必重载窗口。
			// affectsConfiguration 只在本次事件回调内可靠，先同步取好受影响的键再走异步处理。
			const opacityChanged = e.affectsConfiguration('backgroundCover.opacity');
			const blurChanged = e.affectsConfiguration('backgroundCover.blur');
			void syncLevelSettings(opacityChanged, blurChanged);
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
	context.subscriptions.push(window.registerWebviewViewProvider('backgroundCover.readerView', readerViewProvider, {
	  webviewOptions: {
		retainContextWhenHidden: true,
	  },
	}));

	// New Vue-powered Studio webview (primary configuration UI)
	const studioViewProvider = new StudioViewProvider(context);
	context.subscriptions.push(window.registerWebviewViewProvider(
		StudioViewProvider.viewType,
		studioViewProvider,
		{ webviewOptions: { retainContextWhenHidden: true } }
	));

	context.subscriptions.push(
		commands.registerCommand('backgroundCover.refreshEntry', () => {
			commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
			studioViewProvider.refresh();
		}),
		commands.registerCommand('backgroundCover.home', () => {
			commands.executeCommand('setContext', 'backgroundCover.mode', 'gallery');
			readerViewProvider.home();
			studioViewProvider.navigate('gallery');
		}),
		commands.registerCommand('backgroundCover.switchMode', () => {
			commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');
			studioViewProvider.navigate('home');
		}),
		commands.registerCommand('backgroundCover.support', () => readerViewProvider.support())
	);

	// Register Tree Data Provider (with drag-and-drop support)
	const backgroundCoverViewProvider = new BackgroundCoverViewProvider();
	const backgroundCoverTreeView = window.createTreeView('backgroundCover.menu', {
		treeDataProvider: backgroundCoverViewProvider,
		dragAndDropController: backgroundCoverViewProvider,
		canSelectMany: false
	});
	context.subscriptions.push(backgroundCoverTreeView, backgroundCoverViewProvider);

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
		const config = workspace.getConfiguration('backgroundCover');
		if (key === 'backgroundCover.opacity' || key === 'backgroundCover.blur') {
			// 独立模式下透明度/模糊度按窗口+工作区记录在 globalState 里，让每个
			// 窗口的 webview 显示各自的值；共用模式下才回写全局 settings.json。
			const num = typeof value === 'number' ? value : parseFloat(value);
			if (Number.isNaN(num)) { return; }
			if (key === 'backgroundCover.opacity') {
				await setCurrentOpacity(num, config);
			} else {
				await setCurrentBlur(num, config);
			}
			// 配置对象是快照，保存后重新读取，避免共享模式应用上一次的值。
			PickList.needAutoUpdate(workspace.getConfiguration('backgroundCover'));
			return;
		}
		await config.update(key.replace(/^backgroundCover\./, ''), value, true);
		if (key === 'backgroundCover.perWindowBackground') {
			// 重新应用交给 onDidChangeConfiguration 统一处理，避免连开两次。
			return;
		}
		PickList.needAutoUpdate(workspace.getConfiguration('backgroundCover'));
	}));

	// Initialize context
	commands.executeCommand('setContext', 'backgroundCover.mode', 'menu');

	// A4: 主题感知混合模式已改为注入 CSS 的变量 + :has() 即时适配（见 backgroundCss.ts），
	// 不再需要监听主题变化并弹窗确认 / 重打补丁 / 重载窗口。



	 // 首次打开-提示语
	let openVersion:string|undefined           = context.globalState.get('ext_version');
	let ex:Extension<any>|undefined = extensions.getExtension('manasxx.background-cover');
	let version:string           = ex ? ex.packageJSON['version'] : '';
	
	if(openVersion != version){
	context.globalState.update('ext_version',version);
	vsHelp.showInfoSupport(`🎉 BackgroundCover ${version}
🚀 更新内容：
    1. 修复未打开文件夹的窗口重启后透明度/模糊度回落到默认值的问题（#252）。
    2. 直接修改 settings.json / 设置界面里的透明度、模糊度立即生效，无需重载。
    3. 透明度/模糊度写入串行化，快速连续调整不再丢失最新值。

❤️ 觉得好用吗？支持一下在线图库运营吧！`);
	}
}

/**
 * settings.json / 设置界面里直接改透明度、模糊度后立即重新应用（#252 附带问题）。
 * - 共用模式：配置本身就是生效值，重新应用一次即可；
 * - 独立模式：窗口/工作区记录优先，必须先把新值采纳为当前窗口的记录，否则改动
 *   会被旧记录遮蔽，看起来"改了没反应"（要重载窗口才会回落）。
 *   注意：改用户级(User)设置会被每个已打开窗口采纳，即覆盖各窗口已保存的独立值；
 *   工作区级设置只影响该工作区，不会写成无 folder 窗口的全局兜底。
 * 扩展自己在共用模式下回写 settings.json 也会触发本事件，用 self-written 标记跳过，
 * 避免同一次改动被应用两遍。
 */
async function syncLevelSettings(opacityChanged: boolean, blurChanged: boolean): Promise<void> {
	try {
		const config = workspace.getConfiguration('backgroundCover');
		let shouldApply = false;
		if (opacityChanged && !consumeSelfWrittenLevel('opacity', config.get<number>('opacity'))) {
			// 'shared' 表示共用模式下配置本身就是生效值，必须重新应用；'adopted' 表示
			// 已写成当前窗口记录；'skipped'（值非法）则什么都不用做。
			if (await adoptSettingsLevelValue(config, 'opacity') !== 'skipped') {
				shouldApply = true;
			}
		}
		if (blurChanged && !consumeSelfWrittenLevel('blur', config.get<number>('blur'))) {
			if (await adoptSettingsLevelValue(config, 'blur') !== 'skipped') {
				shouldApply = true;
			}
		}
		if (shouldApply) {
			PickList.needAutoUpdate(workspace.getConfiguration('backgroundCover'));
		}
	} catch (error) {
		console.error('[BackgroundCover] failed to apply opacity/blur setting change:', error);
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
				await promptRestartWindow();
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
