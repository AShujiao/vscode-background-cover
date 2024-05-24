import {
	QuickPickItem,
	QuickPickItemKind,
  } from 'vscode';
/**
 * imgItem / 图片List类
 */
export class ImgItem implements QuickPickItem {

	label: string;
	description: string;
	imageType: number;
	path?: string | undefined;
	kind?: QuickPickItemKind | undefined;

	constructor(label: string, description: string, type: number, path?: string | undefined) {
		this.label = label;
		this.description = description;
		this.imageType = type;
		this.path = path;
	}
}