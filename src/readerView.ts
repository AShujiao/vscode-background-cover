import * as crypto from 'crypto';
import {
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
  CancellationToken,
  Disposable,
  window
} from 'vscode';
import { PickList } from './PickList';
import { getContext } from './global';
import { GALLERY_ORIGIN, isGalleryUrl, isValidGalleryMessage } from './netSafety';

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
      this._disposables.forEach(d => d.dispose());
      this._disposables = [];
    });

    this._view.webview.options = {
      enableScripts: true,
    };

    const pageToLoad = this._pendingPage;
    this._pendingPage = undefined;
    this._view.webview.html = this.getHtmlForWebview(pageToLoad);
    this._view.webview.onDidReceiveMessage(
        async message => {
            if (!message || !isValidGalleryMessage(message.command, message.data)) { return; }
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
    let url: string = GALLERY_ORIGIN;
    if (page !== 'home') {
      const saved = getContext().globalState.get<string>('backgroundCoverOnlineDefault');
      if (isGalleryUrl(saved)) {
        url = saved;
      }
    }
    const safeUrl = escapeHtmlAttr(url);
    const nonce = crypto.randomBytes(16).toString('base64');
    
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-src ${GALLERY_ORIGIN};">
        <meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0" name="viewport">
        <title>Background Cover</title>
        <style>
          body { padding: 0; margin: 0; overflow: hidden; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); }
          iframe { width: 100%; height: 100vh; border: none; }
        </style>
      </head>
      <body>
        <iframe id="gallery-frame" title="Online gallery" src="${safeUrl}"></iframe>
      <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          
          // Handle iframe messages
          const frame = document.getElementById('gallery-frame');
          window.addEventListener('message', event => {
              if (!frame || event.source !== frame.contentWindow || event.origin !== '${GALLERY_ORIGIN}') { return; }
              const message = event.data;
              if (message && (message.command === 'set_img' || message.command === 'set_home')) {
                  // Forward from iframe to extension
                  vscode.postMessage(message);
              }
          });
      </script>
      </body>
    </html>`;
  }
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
