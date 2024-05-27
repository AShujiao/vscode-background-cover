import {
	window,
	commands,
  } from 'vscode';
import { PickList } from './PickLIst';

const vsHelp = {
    /**
     * 展示信息提示框
     * 
     * @param {string} content 提示内容
     * @returns {Thenable<string>} 
     */
    showInfo(content: string): Thenable<string | undefined> {
        return window.showInformationMessage(content);
    },

    /**
     * 提示信息并重启
     * 
     * @param {any} content 提示内容
     * @returns {Thenable<void>} 
     */
    showInfoRestart(content: any): Thenable<void> {
        return window.showInformationMessage(content, { title: "Reload" })
            .then(function (item) {
                if (!item) { return; }
                commands.executeCommand('workbench.action.reloadWindow');
            });
    },

    showInfoWxChat(content: any): Thenable<void> {
        return window.showInformationMessage(content, { title: "OK" })
            .then(function (item) {
                if (!item) { return; }
                PickList.gotoFilePath('//resources//wx.jpg');
            });
    },

    showWebview(content: any): Thenable<void> {
        return window.showInformationMessage(content, { title: "OK" })
        .then(function (item) {
            if (!item) { return; }
            commands.executeCommand('workbench.view.extension.backgroundCover-explorer');
        });
        
    }
}

export default vsHelp;