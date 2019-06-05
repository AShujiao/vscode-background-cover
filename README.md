# vscode-background-cover

## Add a picture you like to cover the entire vscode..
## 添加一张你喜欢的图片铺满整个vscode..


>使用此扩展请以管理员身份运行vscode

>请通过插件配置命令或底部按钮进行配置（不要手动修改配置参数）

>Use this extension to run vscode as an administrator

>Please configure it through the plug-in configuration command or the bottom button (do not modify the configuration parameters manually)



## It looks like:

![](https://user-images.githubusercontent.com/14969576/58956213-65a88100-87d0-11e9-98ed-a0ee0992b61f.gif)
![](https://user-images.githubusercontent.com/14969576/58956227-6c36f880-87d0-11e9-94f6-e039f43a0305.jpg)
![](https://user-images.githubusercontent.com/14969576/58956233-6d682580-87d0-11e9-80a3-729ecc421e0c.jpg)

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



![](https://user-images.githubusercontent.com/14969576/58956744-b076c880-87d1-11e9-8552-7a9f93eaf3b4.jpg)


## Uninstall 卸载
---

    如果卸载扩展后图片背景还在？这个不是bug,请手动关闭再打开一次vscode会自动执行最后的清理操作，然后重启即可。
    Is the picture still there after uninstalling the extension? Please turn off manually and open vscode again, which will automatically perform the final cleaning operation and restart.
    OR:
    Set the config  {"backgroundCover.enabled": false}  in settings.json,then uninstall the plugin.
    在 settings.json 中设置 {"backgroundCover.enabled": false} ，然后再卸载插件。
    

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
---
### Thanks 感谢

* [vscode-background](https://github.com/shalldie/vscode-background)
* [feature_restart_random_image](https://github.com/AShujiao/vscode-background-cover/pull/2)

    底层部分代码来自 [shalldie](https://github.com/shalldie) ：[vscode-background](https://marketplace.visualstudio.com/items?itemName=shalldie.background)

## Contributors 贡献者
[<img alt="AShujiao" src="https://avatars2.githubusercontent.com/u/14969576?s=460&v=4" width="117">](https://github.com/AShujiao)
[<img alt="shalldie" src="https://avatars3.githubusercontent.com/u/9987486?s=460&v=4" width="117">](https://github.com/shalldie)
[<img alt="HOT3" src="https://avatars0.githubusercontent.com/u/43977240?s=400&v=4" width="117">](https://github.com/hot3)

### Information 相关信息

* [GitHub](https://github.com/AShujiao/vscode-background-cover)
* [Visual Studio|Marketplace](https://marketplace.visualstudio.com/items?itemName=manasxx.background-cover)


**Enjoy!**
