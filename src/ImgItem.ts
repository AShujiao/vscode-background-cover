import {
	QuickPickItem,
	QuickPickItemKind,
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

	constructor(label: string, detail: string, type: number, path?: string | undefined) {
		this.label = label;
		this.detail = detail;
		this.imageType = type;
		this.path = path;
	}
}