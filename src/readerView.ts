import {
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  window
} from 'vscode';
import { PickList } from './PickLIst';
import { getContext } from './global';

export default class ReaderViewProvider implements WebviewViewProvider {

  public static readonly viewType = 'manzhuxing.readerView';

  private _view ? : WebviewView;
  private _pendingPage?: string;
  private _isProcessing: boolean = false;

  //监听面板事件
  private _disposables: Disposable[] = [];

  constructor() {}

  refresh():void{
    if (this._view) {
      this._view.webview.postMessage({ command: 'refresh' });
      // 重新载入
      this._view.webview.html = "页面刷新中······";
      this._view.webview.html = this.getHtmlForWebview();
    }
  }

  home():void{
    if (this._view) {
      this._view.webview.postMessage({ command: 'home' });
      // 重新载入
      this._view.webview.html = "页面刷新中······";
      this._view.webview.html = this.getHtmlForWebview('home');
    } else {
      this._pendingPage = 'home';
    }
  }

  switchMode():void{
    // Deprecated
  }

  support():void{
    PickList.gotoFilePath("//resources//support.jpg");
  }

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    _token: CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.onDidDispose(() => {
      this._view = undefined;
    });

    this._view.webview.options = {
      enableScripts: true,
    };

    const pageToLoad = this._pendingPage;
    this._pendingPage = undefined;
    this._view.webview.html = this.getHtmlForWebview(pageToLoad);
    this._view.webview.onDidReceiveMessage(
        async message => {
            if (this._isProcessing) { return; }
            this._isProcessing = true;
            try {
                switch (message.command) {
                    case 'set_img':
                      if(message.data.link){
                        let context = getContext();
                        await context.globalState.update('backgroundCoverOnlineDefault', message.data.link);
                      }
                      await PickList.updateImgPath(message.data.url);
                      break;
                    case 'set_home':
                      let context = getContext();
                      await context.globalState.update('backgroundCoverOnlineDefault', message.data.url);
                      await PickList.updateImgPath(message.data.url);
                      window.showInformationMessage("配置帖子图库成功，记得开启自动更换功能噢！/ Set successfully, remember to turn on the auto-change function!");
                      break;
                }
            } finally {
                this._isProcessing = false;
            }
        },
        this,
        this._disposables
    );
  }

  private getHtmlForWebview(page ? : string) {
    var url:string = 'https://vs.20988.xyz/d/24-bei-jing-tu-tu-ku';
    if(page == 'home'){
      url = 'https://vs.20988.xyz';
    }else{
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
        <title>Background Cover</title>
        <style>
          body { padding: 0; margin: 0; overflow: hidden; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
          iframe { width: 100%; height: 100vh; border: none; }
        </style>
      </head>
      <body>
        <iframe id="gallery-frame" src="${url}"></iframe>
      <script>
          const vscode = acquireVsCodeApi();
          
          // Handle iframe messages
          window.addEventListener('message', event => {
              const message = event.data;
              if (message.command === 'set_img' || message.command === 'set_home') {
                  // Forward from iframe to extension
                  vscode.postMessage(message);
              }
          });
      </script>
      </body>
    </html>`;
  }
}