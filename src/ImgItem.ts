import {
	QuickPickItem,
	QuickPickItemKind,
	Uri,
  } from 'vscode';
/**
 * imgItem / 图片List类
 */
export class ImgItem implements QuickPickItem {

	label: string;
	description?: string;
	detail?: string;
	imageType: number;
	path?: string | undefined;
	kind?: QuickPickItemKind | undefined;
	iconPath?: Uri;

	constructor(label: string, detail: string, type: number, path?: string | undefined, iconPath?: Uri) {
		this.label = label;
		this.detail = detail;
		this.imageType = type;
		this.path = path;
		if (iconPath) { this.iconPath = iconPath; }
	}
}