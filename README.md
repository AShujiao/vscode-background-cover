# vscode-background-cover

## Add a picture you like to cover the entire vscode..
## 添加一张你喜欢的图片铺满整个vscode..

    You can also configure a folder path to randomly display the images inside.
    你也可以配置一个文件夹路径来随机展示里面的图片

>使用此扩展请以管理员身份运行vscode

>Use this extension to run vscode as an administrator

## It looks like:

![](https://user-images.githubusercontent.com/14969576/47087812-92168980-d24f-11e8-9a69-cee757ace627.png)
![](https://user-images.githubusercontent.com/14969576/55158915-f7758b80-519a-11e9-9699-9db0ed771c91.gif)

## Warns 警告：

> **本插件是通过修改 vscode 的 css 文件的方式运行**  
> 所以会在初次安装，或者 vscode 升级的时候，出现以下提示，请选择 【不再提示】:
>
> **This extension works by editting the vscode's css file.**  
> So, a information appears while the first time to install or vscode update.U can click the [never show again] to avoid it.

![](https://user-images.githubusercontent.com/14969576/47090529-b1b0b080-d255-11e8-8812-d541cb1c3852.png)


## Config 配置项

| Name                        |      Type       | Description                                                                                 |
| :------------------------   | :-------------: | :------------------------------------------------------------------------------------------ |
| `backgroundCover.enabled`   |    `Boolean`    | 插件是否启用 <br> If background enabled.                                                     |
| `backgroundCover.opacity`   |    `Number`     | 背景图片透明度 <br> background opacity.                                                      |
| `backgroundCover.imagePath` |    `String`     | 背景图片路径<br> Images path                                                                 |
| `backgroundCover.randomImageFolder` |    `String`     | 随机背景图片文件夹路径<br> Background image's folder path for random                   |

## Notice 提示
---
    (A picture) config: {"backgroundCover.imagePath": "file:///E:/OneDrive/Pictures/overwatch/ow.jpg"}  or "E:/OneDrive/Pictures/overwatch/ow.jpg"
    (Random display) config：{"backgroundCover.randomImageFolder": "E:\\image"}

You should use protocol **https** instead of **http** to the image,which is not support by vscode now.

>Random background needs to execute the command to restart vscode and randomly change a background image：

>1. Open the Command Palette (Ctrl+Shift+P (Cmd+Shift+P on macOS)).

>2. Select the backgroundCover - refresh command and press Enter.(key:ctrl+shift+f7)

----
    (单   张  图) 配置 ： {"backgroundCover.imagePath": "file:///E:/OneDrive/Pictures/overwatch/ow.jpg"} 或者 "E:/OneDrive/Pictures/overwatch/ow.jpg"
    (多图随机显示) 配置 ：{"backgroundCover.randomImageFolder": "E:\\image"}



**http** 协议的外链图片在当前版本不能使用(vscode 限制)，需要用 **https** 协议开头的外链地址。

>随机背景图并不会像幻灯片那样几分钟换一次，而时执行相应的命令重启vscode去随机更换一张背景图:

>1. 打开命令面板 (Ctrl+Shift+P (Cmd+Shift+P on macOS)).

>2. 输入 "backgroundCover - refresh" 命令，然后按下回车.(快捷键:ctrl+shift+f7)


    当你配置了 'randomImageFolder' 文件夹路径时，可以点击底部状态栏右下角的切换背景图来选择你要使用的背景图片。

    When you configure the 'randomImageFolder' folder path, you can select the background image you want to use by clicking the switch background image in the lower right corner of the bottom status bar.


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

#### ver 1.5.1 (2019/03/28)
	1.更新卸载钩子的实现方式
    2.状态栏底部增加切换图片功能（配置随机背景图文件夹时可用）
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
