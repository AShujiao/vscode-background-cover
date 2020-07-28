<h1 align="center">
  <br>
    <img src="https://user-images.githubusercontent.com/14969576/61449520-b55d9900-a987-11e9-9dc9-e81fa416688c.png" alt="logo" width="200">
  <br>
  VS Code - Background Cover
  <br>
  <br>
</h1>



<p align="center">
Add a picture you like to cover the entire vscode..
<br/>
添加一张你喜欢的图片铺满整个vscode..
<br/>
<a href="https://github.com/vscode-extension/vscode-background-cover">
<img src="https://img.shields.io/github/stars/vscode-extension/vscode-background-cover.svg?style=social" alt="stars">
</a>
<img src="https://vsmarketplacebadge.apphb.com/downloads-short/manasxx.background-cover.svg?label=background-cover" alt="downloads">
<img src="https://vsmarketplacebadge.apphb.com/rating-star/manasxx.background-cover.svg?label=background-cover" alt="star">
<a href="https://marketplace.visualstudio.com/items?itemName=manasxx.background-cover"><img src="https://vsmarketplacebadge.apphb.com/version/manasxx.background-cover.svg?label=background-cover" alt="Version"></a>  
</p>

---


>使用此扩展请以管理员身份运行vscode

>请通过插件配置命令或底部按钮进行配置（不要手动修改配置参数）

>Use this extension to run vscode as an administrator

>Please configure it through the plug-in configuration command or the bottom button (do not modify the configuration parameters manually)



## It looks like:

![](https://user-images.githubusercontent.com/14969576/59507703-68952700-8ede-11e9-9633-5b9351c5bbb8.gif)
![](https://user-images.githubusercontent.com/14969576/59507145-b90b8500-8edc-11e9-9bf4-a7b9d1d8ae00.png)

## Warns 警告：

> **本插件是通过修改 vscode 的 css 文件的方式运行**  
> 所以会在初次安装，或者 vscode 升级的时候，出现以下提示，请选择 【不再提示】:
>
> **This extension works by editting the vscode's css file.**  
> So, a information appears while the first time to install or vscode update.U can click the [never show again] to avoid it.

![](https://user-images.githubusercontent.com/14969576/47090529-b1b0b080-d255-11e8-8812-d541cb1c3852.png)


## Config 配置项

> 2.0 版本开始你只需要通过插件自带的配置项进行使用即可

> Starting with version 2.0, you only need to use the configuration items that come with the plug-in.

## Notice 提示
---

>1.点击底部切换背景图按钮 / Click the bottom toggle background button

>2.ctrl + shift + P  >  "backgroundCover - start" 

>3.ctrl + shift + F7 >  "Random update background and restart"

>4.VSCode更新版本时会导致背景图消失，需要手动重新设置



![](https://user-images.githubusercontent.com/14969576/58956744-b076c880-87d1-11e9-8552-7a9f93eaf3b4.jpg)


## Uninstall 卸载
---

    如果卸载扩展后图片背景还在？这个不是bug,请手动关闭再打开一次vscode会自动执行最后的清理操作，然后重启即可。
    Is the picture still there after uninstalling the extension? Please turn off manually and open vscode again, which will automatically perform the final cleaning operation and restart.
    

### Q&A 常见问题:

---

    Q:It seems that nothing happens after installing the extension?
    Q:安装完插件后，似乎没有反应？

    A:Make sure to have the administrator authority！！
    A:如果不能使用，请确保你有管理员权限！！

---

    Q:How to get the administrator authority?
    Q:怎么获取管理员权限呢？ =。=

    A:In windows,click right button on the vscode's icon,then check the [run with the administrator authority].
    A:在windows环境中，可以右键单击vscode的图标，选择【以管理员身份运行】。

---
## 更新日志
[日志](https://github.com/vscode-extension/vscode-background-cover/blob/master/CHANGELOG.md)

#### ver 2.0.0 (2019/06/05)
	1.重写功能，添加独立配置，使用更方便
    2.不再通过监听设置进行更新背景
    3.去除默认背景图

#### ver 2.0.1 (2019/06/10)
	1.下拉列表添加图标、文字对齐

#### ver 2.1.0 (2019/06/14)
	1.添加每次启动时随机自动更换背景图功能（请先添加目录后开启）

#### ver 2.2.0 (2019/06/20)
	1.添加快捷键ctrl + shift + F7 随机更新背景并重启

#### ver 2.2.1 (2019/07/18)
	1.支持更多的图片格式

#### ver 2.2.2 (2019/08/15)
	1.适配1.38版本CSS路径
    2.优化代码

#### ver 2.2.3 (2019/10/30)
	1.菜单列表文字对齐
    2.定义扩展类型为"ui"

#### ver 2.2.4 (2020/07/28)
	1.修复卸载钩子失效的问题
    2.最低支持版本改为1.38.0
---
### Thanks 感谢

* [vscode-background](https://github.com/shalldie/vscode-background)
* [feature_restart_random_image](https://github.com/AShujiao/vscode-background-cover/pull/2)

    底层部分代码来自 [shalldie](https://github.com/shalldie) ：[vscode-background](https://marketplace.visualstudio.com/items?itemName=shalldie.background)

## Contributors 贡献者
[<img alt="AShujiao" src="https://avatars2.githubusercontent.com/u/14969576?s=460&v=4" width="117">](https://github.com/AShujiao)
[<img alt="yjhmelody" src="https://avatars0.githubusercontent.com/u/16250688?s=460&v=4" width="117">](https://github.com/yjhmelody)
[<img alt="shalldie" src="https://avatars3.githubusercontent.com/u/9987486?s=460&v=4" width="117">](https://github.com/shalldie)
[<img alt="HOT3" src="https://avatars0.githubusercontent.com/u/43977240?s=400&v=4" width="117">](https://github.com/hot3)
[<img alt="rogeraabbccdd" src="https://avatars0.githubusercontent.com/u/15815422?s=460&v=4" width="117">](https://github.com/rogeraabbccdd)

### Information 相关信息

* [GitHub](https://github.com/AShujiao/vscode-background-cover)
* [Visual Studio|Marketplace](https://marketplace.visualstudio.com/items?itemName=manasxx.background-cover)


**Enjoy!**
