import {
	window,
	commands,
    Uri,
    env,
  } from 'vscode';
import { PickList } from './PickList';

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

    showInfoSupport(content: any): Thenable<void> {
        return window.showInformationMessage(content, { modal: true }, { title: "❤️赞助" }, { title: "详情" }, { title: "加入群聊" })
            .then(function (item) {
                if (!item) { return; }
                if (item.title === '详情') {
                    env.openExternal( Uri.parse( "https://vs.20988.xyz/d/66-ai-xin-juan-zeng/3" ) )
                }else if(item.title === '加入群聊'){
                    PickList.gotoFilePath('//resources//wx.jpg');
                }else{
                    PickList.gotoFilePath('//resources//support.jpg');
                }
                
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