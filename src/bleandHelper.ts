
import { window, ColorThemeKind } from 'vscode';

const bleandHelper = {

	autoBlendModel(): string {
		let blendStr = '';
		let themeKind = window.activeColorTheme.kind;
		if ( themeKind === ColorThemeKind.Dark ) {
			blendStr = 'lighten';
		} else if ( themeKind === ColorThemeKind.Light ) {
			// console.log('浅色模式');
			blendStr = 'multiply';
		} else {
			// console.log('高对比模式');
			blendStr = 'lighten';
		}
		return blendStr;
	}

}

export default bleandHelper;

