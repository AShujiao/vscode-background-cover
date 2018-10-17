# vscode-background-cover

## Add a picture you like to cover the entire vscode..
## 添加一张你喜欢的图片铺满整个vscode..

### 此插件根据[background](https://marketplace.visualstudio.com/items?itemName=shalldie.background)插件修改而来，两个插件不冲突，已征得作者同意发布到市场

## It looks like:

![](https://user-images.githubusercontent.com/14969576/47087812-92168980-d24f-11e8-9a69-cee757ace627.png)
![](https://user-images.githubusercontent.com/14969576/47087915-d0ac4400-d24f-11e8-92c0-0754f7d5b127.png)

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

## Notice 提示

Local path  ： {"backgroundCover.imagePath": "file:///E:/OneDrive/Pictures/overwatch/ow.jpg"}

本地图片请使用此格式 ： {"backgroundCover.imagePath": "file:///E:/OneDrive/Pictures/overwatch/ow.jpg"}
如果不填写路径则使用插件的默认图片

**http** 协议的外链图片在当前版本不能使用(vscode 限制)，需要用 **https** 协议开头的外链地址。

You should use protocol **https** instead of **http** to the image,which is not support by vscode now.

## Uninstall 卸载

    Set the config  {"backgroundCover.enabled": false}  in settings.json,then uninstall the plugin.
    在 settings.json 中设置 {"backgroundCover.enabled": false} ，然后再删除插件。如果直接删除插件会有遗留，就需要重装插件解决了。

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
## 发行说明

#### ver 0.1.0 (2018/10/17)
	第一版发布

-----------------------------------------------------------------------------------------------------------
### Thanks 感谢

* [vscode-background](https://github.com/shalldie/vscode-background)

### Information 相关信息

* [GitHub](https://github.com/AShujiao/vscode-background-cover)


**Enjoy!**
