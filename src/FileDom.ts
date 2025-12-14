import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { env, Uri, window, WorkspaceConfiguration } from 'vscode';
import * as lockfile from 'lockfile';
import version from './version';
import { SudoPromptHelper } from './SudoPromptHelper';
import * as fse from 'fs-extra';
import { getContext } from './global';

const workbenchTargets = [
    {
        name: 'desktop',
        root: path.join(env.appRoot, "out", "vs", "workbench"),
        js: 'workbench.desktop.main.js',
        css: 'workbench.desktop.main.css',
        bak: 'workbench.desktop.main.js.bak'
    },
    {
        name: 'code-server',
        root: path.join(env.appRoot, "out", "vs", "code", "browser", "workbench"),
        js: 'workbench.js',
        css: 'workbench.css',
        bak: 'workbench.js.bak'
    }
];
const selectedWorkbench = workbenchTargets.find((target) => fs.existsSync(path.join(target.root, target.js))) || workbenchTargets[0];
const jsFilePath      = path.join(selectedWorkbench.root, selectedWorkbench.js);
const cssFilePath     = path.join(selectedWorkbench.root, selectedWorkbench.css);
const bakFilePath     = path.join(selectedWorkbench.root, selectedWorkbench.bak);

enum SystemType {
    WINDOWS = 'Windows_NT',
    MACOS = 'Darwin',
    LINUX = 'Linux'
}

export class FileDom {
    private readonly filePath: string;
    private readonly extName = "backgroundCover";
    private imagePath: string;
    private readonly imageOpacity: number;
    private readonly sizeModel: string;
    private readonly blur: number;
    private readonly blendModel: string;
    private readonly systemType: string;
    private readonly forceHttpsUpgrade: boolean;
    private upCssContent: string = '';
    private bakStatus: boolean = false;
    private bakJsContent: string = '';
    private workConfig: WorkspaceConfiguration;
    private initializePromise?: Promise<void>;

    constructor(
        workConfig:WorkspaceConfiguration,
        imagePath: string,
        opacity: number,
        sizeModel: string = 'cover',
        blur: number = 0,
        blendModel: string = ''
    ) {
        this.workConfig = workConfig;
        this.blendModel   = blendModel || this.workConfig.get('blendModel', '');
        this.filePath     = jsFilePath;
        this.imagePath    = imagePath;
        this.imageOpacity = Math.min(opacity, 0.8);
        this.sizeModel    = sizeModel || "cover";
        this.blur         = blur;
        this.blendModel   = blendModel;
        this.systemType   = os.type();
        this.forceHttpsUpgrade = this.workConfig.get('forceHttpsUpgrade', true);
        this.initializePromise = this.initializeImage().catch((error: unknown) => {
            console.error('[FileDom] Failed to preprocess image:', error);
        });
    }

    private async initializeImage(): Promise<void> {
        const lowerPath = this.imagePath.toLowerCase();
        if (
            !lowerPath.startsWith('http://') &&
            !lowerPath.startsWith('https://') &&
            !lowerPath.startsWith('data:')
        ) {
            const converted = await this.imageToBase64();
            if (!converted) {
                this.localImgToVsc();
            }
        }
    }

    public async install(): Promise<boolean> {

        // 文件是否存在
        const isExist = await fse.pathExists(this.filePath);
        if (!isExist) {
            await window.showErrorMessage(`文件不存在，提醒开发者修复吧！`);
            return false
        }


        // 获取全局变量是否已经清除
        let vsContext = getContext();
        let clearCssNum = Number(vsContext.globalState.get('ext_backgroundCover_clear_v2')) || 0;
        // 尝试5次清除旧版css文件
        if(clearCssNum <= 5){
            // 验证旧版css文件是否需要清除
            const cssContent = this.getContent(cssFilePath);
            if(this.getPatchContent(cssContent)){
                // 清除旧版css文件
                this.upCssContent = this.clearCssContent(cssContent);
            }else{
                // 不存在旧版css文件，设置全局变量
                vsContext.globalState.update('ext_backgroundCover_clear_v2',clearCssNum + 1);
            }
        }

        // 备份文件是否存在
        const bakExist = await fse.pathExists(bakFilePath);
        if (!bakExist) {
            this.bakStatus = true;
            // 触发备份提醒用户稍等片刻
            window.showInformationMessage(`首次使用正在获取权限及备份文件，处理中... / First use is getting permission and backing up files, processing...`);
        }
        

        const lockPath = os.tmpdir() + '/vscode-background.lock';

        try {
            // 加锁
            await new Promise((resolve, reject) => {
                lockfile.lock(lockPath, { retries: 10, retryWait: 100 }, (err:any) => {
                    if (err) reject(err);
                    else resolve(null);
                });
            });

            if (this.initializePromise) {
                await this.initializePromise;
                this.initializePromise = undefined;
            }

            const content = this.getJs().trim();
            if (!content) return false;

            const bakContent = this.clearCssContent(this.getContent(this.filePath))
            if(this.bakStatus){
                this.bakJsContent = bakContent;
            }

            const newContent = bakContent + content;
            return await this.saveContent(newContent);

        } catch (error: any) {
            await window.showErrorMessage(`Installation failed: ${error.message}`);
            return false;
        } finally {
            // 解锁
            lockfile.unlock(lockPath, (err:any) => {
                if (err) console.error(`Failed to unlock ${lockPath}:`, err);
            });
        }
    }

    // 获取文件权限通用方法
    public async getFilePermission(filePath:string): Promise<void> {
        switch(this.systemType){
            case SystemType.WINDOWS:
                await SudoPromptHelper.exec(`takeown /f "${filePath}" /a`);
                await SudoPromptHelper.exec(`icacls "${filePath}" /grant Users:F`);
                break;
            case SystemType.MACOS:
                await SudoPromptHelper.exec(`chmod a+rwx "${filePath}"`);
                break;
            case SystemType.LINUX:
                await SudoPromptHelper.exec(`chmod 666 "${filePath}"`);
                break;
        }
    }


    public async uninstall(): Promise<boolean> {
        try {
            const content = this.clearCssContent(this.getContent(this.filePath));
            await this.saveContent(content);
            //await commands.executeCommand('workbench.action.reloadWindow');
            return true;
        } catch (error) {
            await window.showErrorMessage(`卸载失败: ${error}`);
            return false;
        }
    }

    private getContent(filePath:string): string {
        return fs.readFileSync(filePath, 'utf-8');
    }

    private async saveContent(content: string): Promise<boolean> {

        // 追加新内容到原文件
        try{
            await fse.writeFile(this.filePath,content, {encoding: 'utf-8'});
        }catch(err){
            // 权限不足,根据不同系统获取创建文件权限
            await this.getFilePermission(this.filePath);
            await fse.writeFile(this.filePath,content, {encoding: 'utf-8'});
        }
        
        
        // 清除旧版css文件
        if(this.upCssContent){
            try{
                await fse.writeFile(cssFilePath,this.upCssContent, {encoding: 'utf-8'});
            }catch(err){
                // 权限不足,根据不同系统获取创建文件权限
                await this.getFilePermission(cssFilePath);
                await fse.writeFile(cssFilePath,this.upCssContent, {encoding: 'utf-8'});
            }
            this.upCssContent = '';
        }

        // 备份文件
        if(this.bakStatus){
            await this.bakFile();
        }

        return true;
    }

    private async bakFile(): Promise<void> {
        try{
            await fse.writeFile(bakFilePath,this.bakJsContent, {encoding: 'utf-8'});
        }catch(err){
            // 权限不足,根据不同系统获取创建文件权限
            if(this.systemType === SystemType.WINDOWS){
                // 使用cmd命令创建文件
                await SudoPromptHelper.exec(`echo. > "${bakFilePath}"`);
                await SudoPromptHelper.exec(`icacls "${bakFilePath}" /grant Users:F`);
            }else if(this.systemType === SystemType.MACOS){
                // 使用命令创建文件并赋予权限
                await SudoPromptHelper.exec(`touch "${bakFilePath}"`);
                await SudoPromptHelper.exec(`chmod a+rwx "${bakFilePath}"`);
            }else if(this.systemType === SystemType.LINUX){
                // 使用命令创建文件并赋予权限
                await SudoPromptHelper.exec(`touch "${bakFilePath}"`);
                await SudoPromptHelper.exec(`chmod 666 "${bakFilePath}"`);
            }
            await fse.writeFile(bakFilePath,this.bakJsContent, {encoding: 'utf-8'});
        }
    }

    private getJs(): string {
        let css = this.getCss();
        let particleJs = this.getParticleJs();
        
        return `
        /*ext-${this.extName}-start*/
        /*ext.${this.extName}.ver.${version}*/
        const style = document.createElement('style');
        style.textContent = \`${css}\`;
        document.head.appendChild(style);
        ${particleJs}
        /*ext-${this.extName}-end*/
        `;
    }

    private getParticleJs(): string {
        
        let context = getContext();
        // 如果粒子效果未启用，则返回空字符串
        if (!context.globalState.get('backgroundCoverParticleEffect', false)) {
            return '';
        }
        
        // 获取粒子效果的配置
 
        const opacity = context.globalState.get('backgroundCoverParticleOpacity', 0.6);
        const color = context.globalState.get('backgroundCoverParticleColor', '#ffffff');
        const count = context.globalState.get('backgroundCoverParticleCount', 50);
        
        // 粒子效果的 JS 代码
        return `
        // 粒子效果注入
        !function(){"use strict";function e(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}function t(e,t){return e(t={exports:{}},t.exports),t.exports}var n=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0});var n=1;t.default=function(){return""+n++},e.exports=t.default});e(n);var o=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.default=function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:30,n=null;return function(){for(var o=this,i=arguments.length,r=Array(i),a=0;a<i;a++)r[a]=arguments[a];clearTimeout(n),n=setTimeout(function(){e.apply(o,r)},t)}},e.exports=t.default});e(o);var i=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0});t.SizeSensorId="size-sensor-id",t.SensorStyle="display:block;position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;pointer-events:none;z-index:-1;opacity:0",t.SensorClassName="size-sensor-object"});e(i);i.SizeSensorId,i.SensorStyle,i.SensorClassName;var r=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.createSensor=void 0;var n,r=(n=o)&&n.__esModule?n:{default:n};t.createSensor=function(e){var t=void 0,n=[],o=(0,r.default)(function(){n.forEach(function(t){t(e)})}),a=function(){t&&t.parentNode&&(t.contentDocument.defaultView.removeEventListener("resize",o),t.parentNode.removeChild(t),t=void 0,n=[])};return{element:e,bind:function(r){t||(t=function(){"static"===getComputedStyle(e).position&&(e.style.position="relative");var t=document.createElement("object");return t.onload=function(){t.contentDocument.defaultView.addEventListener("resize",o),o()},t.setAttribute("style",i.SensorStyle),t.setAttribute("class",i.SensorClassName),t.type="text/html",e.appendChild(t),t.data="about:blank",t}()),-1===n.indexOf(r)&&n.push(r)},destroy:a,unbind:function(e){var o=n.indexOf(e);-1!==o&&n.splice(o,1),0===n.length&&t&&a()}}}});e(r);r.createSensor;var a=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.createSensor=void 0;var n,i=(n=o)&&n.__esModule?n:{default:n};t.createSensor=function(e){var t=void 0,n=[],o=(0,i.default)(function(){n.forEach(function(t){t(e)})}),r=function(){t.disconnect(),n=[],t=void 0};return{element:e,bind:function(i){t||(t=function(){var t=new ResizeObserver(o);return t.observe(e),o(),t}()),-1===n.indexOf(i)&&n.push(i)},destroy:r,unbind:function(e){var o=n.indexOf(e);-1!==o&&n.splice(o,1),0===n.length&&t&&r()}}}});e(a);a.createSensor;var s=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.createSensor=void 0;t.createSensor="undefined"!=typeof ResizeObserver?a.createSensor:r.createSensor});e(s);s.createSensor;var u=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.removeSensor=t.getSensor=void 0;var o,r=(o=n)&&o.__esModule?o:{default:o};var a={};t.getSensor=function(e){var t=e.getAttribute(i.SizeSensorId);if(t&&a[t])return a[t];var n=(0,r.default)();e.setAttribute(i.SizeSensorId,n);var o=(0,s.createSensor)(e);return a[n]=o,o},t.removeSensor=function(e){var t=e.element.getAttribute(i.SizeSensorId);e.element.removeAttribute(i.SizeSensorId),e.destroy(),t&&a[t]&&delete a[t]}});e(u);u.removeSensor,u.getSensor;var c=t(function(e,t){Object.defineProperty(t,"__esModule",{value:!0}),t.clear=t.bind=void 0;t.bind=function(e,t){var n=(0,u.getSensor)(e);return n.bind(t),function(){n.unbind(t)}},t.clear=function(e){var t=(0,u.getSensor)(e);(0,u.removeSensor)(t)}});e(c);var l=c.clear,d=c.bind,v=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.msRequestAnimationFrame||window.oRequestAnimationFrame||function(e){return window.setTimeout(e,1e3/60)},f=window.cancelAnimationFrame||window.webkitCancelAnimationFrame||window.mozCancelAnimationFrame||window.msCancelAnimationFrame||window.oCancelAnimationFrame||window.clearTimeout,m=function(e){return new Array(e).fill(0).map(function(e,t){return t})},h=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(e[o]=n[o])}return e},p=function(){function e(e,t){for(var n=0;n<t.length;n++){var o=t[n];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(e,o.key,o)}}return function(t,n,o){return n&&e(t.prototype,n),o&&e(t,o),t}}();var y=function(){function e(t,n){var o=this;!function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,e),this.randomPoints=function(){return m(o.c.count).map(function(){return{x:Math.random()*o.canvas.width,y:Math.random()*o.canvas.height,xa:2*Math.random()-1,ya:2*Math.random()-1,max:6e3}})},this.el=t,this.c=h({zIndex:-1,opacity:.5,color:"0,0,0",pointColor:"0,0,0",count:99},n),this.canvas=this.newCanvas(),this.context=this.canvas.getContext("2d"),this.points=this.randomPoints(),this.current={x:null,y:null,max:2e4},this.all=this.points.concat([this.current]),this.bindEvent(),this.requestFrame(this.drawCanvas)}return p(e,[{key:"bindEvent",value:function(){var e=this;d(this.el,function(){e.canvas.width=e.el.clientWidth,e.canvas.height=e.el.clientHeight}),this.onmousemove=window.onmousemove,window.onmousemove=function(t){e.current.x=t.clientX-e.el.offsetLeft+document.scrollingElement.scrollLeft,e.current.y=t.clientY-e.el.offsetTop+document.scrollingElement.scrollTop,e.onmousemove&&e.onmousemove(t)},this.onmouseout=window.onmouseout,window.onmouseout=function(){e.current.x=null,e.current.y=null,e.onmouseout&&e.onmouseout()}}},{key:"newCanvas",value:function(){"static"===getComputedStyle(this.el).position&&(this.el.style.position="relative");var e,t=document.createElement("canvas");return t.style.cssText="display:block;position:absolute;top:0;left:0;height:100%;width:100%;overflow:hidden;pointer-events:none;z-index:"+(e=this.c).zIndex+";opacity:"+e.opacity,t.width=this.el.clientWidth,t.height=this.el.clientHeight,this.el.appendChild(t),t}},{key:"requestFrame",value:function(e){var t=this;this.tid=v(function(){return e.call(t)})}},{key:"drawCanvas",value:function(){var e=this,t=this.context,n=this.canvas.width,o=this.canvas.height,i=this.current,r=this.points,a=this.all;t.clearRect(0,0,n,o);var s=void 0,u=void 0,c=void 0,l=void 0,d=void 0,v=void 0;r.forEach(function(r,f){for(r.x+=r.xa,r.y+=r.ya,r.xa*=r.x>n||r.x<0?-1:1,r.ya*=r.y>o||r.y<0?-1:1,t.fillStyle="rgba("+e.c.pointColor+")",t.fillRect(r.x-.5,r.y-.5,1,1),u=f+1;u<a.length;u++)null!==(s=a[u]).x&&null!==s.y&&(l=r.x-s.x,d=r.y-s.y,(v=l*l+d*d)<s.max&&(s===i&&v>=s.max/2&&(r.x-=.03*l,r.y-=.03*d),c=(s.max-v)/s.max,t.beginPath(),t.lineWidth=c/2,t.strokeStyle="rgba("+e.c.color+","+(c+.2)+")",t.moveTo(r.x,r.y),t.lineTo(s.x,s.y),t.stroke()))}),this.requestFrame(this.drawCanvas)}},{key:"destroy",value:function(){l(this.el),window.onmousemove=this.onmousemove,window.onmouseout=this.onmouseout,f(this.tid),this.canvas.parentNode.removeChild(this.canvas)}}]),e}();y.version="2.0.4";var w,b;new y(document.body,(w=document.getElementsByTagName("script"),{zIndex:99,opacity:"${opacity}",color:"${color}",pointColor:"${color}",count:${count}}))}();
        `;
    }

    private getCss(): string {
		// 透明度最大0.8
		let opacity = this.imageOpacity;
		opacity = opacity > 0.8 ? 0.8 : opacity;

		// 图片填充方式
		let sizeModelVal = this.sizeModel;
		let repeatVal    = "no-repeat";
		let positionVal  = "center";
		switch(this.sizeModel){
			case "cover":
				sizeModelVal = "cover";
				break;
			case "contain":
				sizeModelVal = "100% 100%";
				break;
            case "center":
				sizeModelVal = "contain";
				break;
			case "repeat":
				sizeModelVal = "auto";
				repeatVal = "repeat";
				break;
			case "not_center":
				sizeModelVal = "auto";
				break;
			case "not_right_bottom":
				sizeModelVal = "auto";
				positionVal = "right 96%";
				break;
			case "not_right_top":
				sizeModelVal = "auto";
				positionVal = "right 30px";
				break;
			case "not_left":
				sizeModelVal = "auto";
				positionVal = "left";
				break;
			case "not_right":
				sizeModelVal = "auto";
				positionVal = "right";
				break;
			case "not_top":
				sizeModelVal = "auto";
				positionVal = "top";
				break;
			case "not_bottom":
				sizeModelVal = "auto";
				positionVal = "bottom";
				break;
				
		}

        let finalImagePath = this.escapeTemplateLiteral(this.imagePath);
        const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
        if (this.forceHttpsUpgrade && finalImagePath.toLowerCase().startsWith('http://')) {
            if (globalWindow && globalWindow.location && globalWindow.location.protocol === 'https:') {
                finalImagePath = finalImagePath.replace(/^http:\/\//i, 'https://');
            }
        }
        return `
        body::before{
            content: "";
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            position: absolute;
            background-size: ${sizeModelVal};
            background-repeat: ${repeatVal};
            background-position: ${positionVal};
            opacity:${opacity};
            background-image:url('${finalImagePath}');
            z-index: 2;
            pointer-events: none;
            filter: blur(${this.blur}px);
            mix-blend-mode: ${this.blendModel};
        }
        `;
    }

    private escapeTemplateLiteral(value: string): string {
        if (!value) {
            return value;
        }
        return value
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
    }

    private async imageToBase64(): Promise<boolean> {
        try {
            const extname = path.extname(this.imagePath).substr(1);
            const imageBuffer = await fs.promises.readFile(path.resolve(this.imagePath));
            this.imagePath = `data:image/${extname};base64,${imageBuffer.toString('base64')}`;
            return true;
        } catch {
            return false;
        }
    }

    private localImgToVsc(): void {
        const separator = this.systemType === SystemType.LINUX ? "" : "/";
        this.imagePath = Uri.parse(`vscode-file://vscode-app${separator}${this.imagePath}`).toString();
    }

    private clearCssContent(content: string): string {
        const regex = new RegExp(`\\/\\*ext-${this.extName}-start\\*\\/[\\s\\S]*?\\/\\*ext-${this.extName}-end\\*\\/`, 'g');
        return content.replace(regex, '').trim();
    }

    // 获取文件里是否存在补丁样式代码
    public getPatchContent(content:string): boolean {
        const match = content.match(/\/\*ext-backgroundCover-start\*\/[\s\S]*?\/\*ext-backgroundCover-end\*\//g);
        if(match){
            return true;
        }
        return false;
    }
}
