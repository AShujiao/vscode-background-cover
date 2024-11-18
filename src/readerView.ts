import {
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  window,
} from 'vscode';
import { PickList } from './PickLIst';
import { getContext } from './global';

export default class ReaderViewProvider implements WebviewViewProvider {

  public static readonly viewType = 'manzhuxing.readerView';

  private _view ? : WebviewView;

  //监听面板事件
  private _disposables: Disposable[] = [];

  constructor() {}

  refresh():void{
    if (this._view) {
      // 重新载入
      this._view.webview.html = "页面刷新中······";
      this._view.webview.html = this.getHtmlForWebview();
    }
  }

  home():void{
    if (this._view) {
      // 重新载入
      this._view.webview.html = "页面刷新中······";
      this._view.webview.html = this.getHtmlForWebview('home');
    }
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    _token: CancellationToken,
  ) {
    this._view = webviewView;

    this._view.webview.options = {
      enableScripts: true,
    };

    this._view.webview.html = this.getHtmlForWebview();

    this._view.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'set_img':
                    PickList.updateImgPath(message.data.url);
                    //window.showInformationMessage(message.data.url);
                    break;
                case 'set_home':
                  // 设置vscode本地全局变更
                  let context = getContext();
                  context.globalState.update('backgroundCoverOnlineDefault', message.data.url);
                  window.showInformationMessage("Successfully set default online gallery page / 设置默认在线图库页面成功！");
                  break;
            }
        },
        this,
        this._disposables
    );
  }

  private getHtmlForWebview(page ? : string) {
    // 获取默认页面
    var url:string = 'https://vs.20988.xyz/d/24-bei-jing-tu-tu-ku';
    if(page == 'home'){
      url = 'https://vs.20988.xyz';
    }else{
      // 获取vscode本地全局变量
      let context = getContext();
      let backgroundCoverOnlineDefault:string|undefined = context.globalState.get('backgroundCoverOnlineDefault');
      if(backgroundCoverOnlineDefault){
        url = backgroundCoverOnlineDefault;
      }
    }
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" name="viewport">
        <title>bbs</title>
        <style>
          html, body, iframe { margin: 0; width: 100%; height: 100%; border: none; overflow: hidden; }
          iframe {
            transform-origin: top left;
          }
        </style>
      </head>
      <body>
      <script>
          const vscode = acquireVsCodeApi();
          window.addEventListener('message', event => {
              console.log('message from iframe:', event.data);
              const message = event.data; 

              vscode.postMessage({
                command: message.command,
                data: message.data
              });
          });
      </script>
        <iframe src="${url}" />
      </body>

    </html>`;
  }
}