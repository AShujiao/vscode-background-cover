<h1 align="center">
  <br>
    <img src="https://user-images.githubusercontent.com/14969576/61449520-b55d9900-a987-11e9-9dc9-e81fa416688c.png" alt="logo" width="200">
  <br>
  VS Code - Background Cover
  <br>

  <br>
</h1>



<p align="center">
Add a picture you like to cover the entire vscode, as well as the particle effect animation that follows the mouse<br/>
<br/>
添加一张你喜欢的图片铺满整个vscode, 以及鼠标跟随的粒子效果动画
<br/>
<a href="https://github.com/vscode-extension/vscode-background-cover">
<img src="https://img.shields.io/github/stars/vscode-extension/vscode-background-cover.svg?style=social" alt="stars">
</a>

</p>

## Warns 警告：

> **升级到2.6.2及以上时，如果出现背景重叠的情况，请关闭vsc重新打开即可。因为旧版本的重载不生效导致的**

> **If the background overlaps after the upgrade to 2.6.2, close the vsc and turn it on again. This is because the older version of the overloading did not take effect**

> **本插件是通过修改 vscode 的 css 文件的方式运行**  
> 所以会在初次安装，或者 vscode 升级的时候，出现以下提示，请选择 【不再提示】:

> **如果出现无法打开并且尝试多次都不能正常运行，请手动还原文件**   

* 目录 : Microsoft VS Code\resources\app\out\vs\workbench\
* workbench.desktop.main.js.bak => workbench.desktop.main.js

>
> **This extension works by editting the vscode's css file.**  
> So, a information appears while the first time to install or vscode update.U can click the [never show again] to avoid it.

> **If it does not open and does not work after multiple attempts, restore the file manually**
* path : Microsoft VS Code\resources\app\out\vs\workbench\
* workbench.desktop.main.js.bak => workbench.desktop.main.js

![](https://user-images.githubusercontent.com/14969576/47090529-b1b0b080-d255-11e8-8812-d541cb1c3852.png)



---
  [集成在线图库](https://vs.20988.xyz/d/24-vscodebei-jing-tu-tu-ku)


>请通过插件配置命令或底部按钮进行配置（不要手动修改配置参数）


>Please configure it through the plug-in configuration command or the bottom button (do not modify the configuration parameters manually)



## It looks like:
![05](https://github.com/user-attachments/assets/373c373e-e672-4ed4-9b4b-d09eaa457c9d)
![微信截图_20241119082747](https://github.com/user-attachments/assets/eb94402d-7193-488a-a148-353879a7e71a)

![](https://github.com/AShujiao/vscode-maxPlus/assets/14969576/20172d72-5384-4bfe-bceb-ec582cfb1698)
![](https://github.com/AShujiao/vscode-maxPlus/assets/14969576/dcbb7870-8342-4069-9dd8-026d3b903420)
![Image](https://github.com/user-attachments/assets/078e6d26-412b-4bb8-8113-3ac3972153b1)
![Image](https://github.com/user-attachments/assets/a8668f9c-6ff1-46f1-b5c2-b606ed327910)
![Image](https://github.com/user-attachments/assets/0ad0f6e2-a777-45a9-ad02-1fd2caaac1df)


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

    卸载扩展后图片背景还在？这个不是bug,请手动关闭再打开一次vscode会自动执行最后的清理操作，然后重启即可。
    Is the picture still there after uninstalling the extension? Please turn off manually and open vscode again, which will automatically perform the final cleaning operation and restart.
    

### Q&A 常见问题:

---

    Q:It seems that nothing happens after installing the extension?
    Q:安装完插件后，似乎没有反应？

    A:Make sure to have the administrator authority！！
    A:如果不能使用，请确保你有管理员权限！！

---

    Q:How to open vscode with administrator permission??
    Q:怎么使用管理员权限打开VSCode呢？ =。=

    A:In windows,click right button on the vscode's icon,then check the [run with the administrator authority].
    A:在windows环境中，可以右键单击vscode的图标，选择【以管理员身份运行】。

---

    Q:How do I start administrator privileges in MacOS?
    Q:在MacOS中怎么启动管理员权限呢？ >_<

    A:You can open the application installation package on your computer and find the CSS file in the program for permission modification. Or after selecting the picture in the plug-in, if you do not have write permission, you will be asked to enter the administrator password to obtain the corresponding permission.
    A:你可以打开电脑上的应用安装包，找到程序内的CSS文件进行权限修改。或者在该插件中选择图片之后，如果没有写入权限的话则会要求你输入管理员密码来获取对应的权限。

---

## 最近更新日志
[完整日志](https://github.com/vscode-extension/vscode-background-cover/blob/master/CHANGELOG.md)

#### ver 2.7.0 (2025/05/05)

  1.🎉新功能：~鼠标跟随粒子效果🎉 （原[vscode-nest](https://github.com/AShujiao/vscode-nest)插件已弃用，集成到本扩展中）  
  2.部分配置输入框显示当前配置值
  
---
### Thanks 感谢

* [vscode-background](https://github.com/shalldie/vscode-background)
* [feature_restart_random_image](https://github.com/AShujiao/vscode-background-cover/pull/2)

## Contributors 
* 对于扩展的贡献者默认都会展示在此列表中，如果不愿意展示此处也可以进行提交pr移除   
[<img alt="AShujiao" src="https://avatars2.githubusercontent.com/u/14969576?s=460&v=4" width="117">](https://github.com/AShujiao)
[<img alt="yjhmelody" src="https://avatars0.githubusercontent.com/u/16250688?s=460&v=4" width="117">](https://github.com/yjhmelody)
[<img alt="shalldie" src="https://avatars3.githubusercontent.com/u/9987486?s=460&v=4" width="117">](https://github.com/shalldie)
[<img alt="HOT3" src="https://avatars0.githubusercontent.com/u/43977240?s=400&v=4" width="117">](https://github.com/hot3)
[<img alt="rogeraabbccdd" src="https://avatars0.githubusercontent.com/u/15815422?s=460&v=4" width="117">](https://github.com/rogeraabbccdd)
[<img alt="kuresaru" src="https://avatars.githubusercontent.com/u/31172177?s=460&u=f44be019cc56fdf6d2ae9bbc7e12addb064c0b1b&v=4" width="117">](https://github.com/kuresaru)
[<img alt="lauset" src="https://avatars.githubusercontent.com/u/47267800?v=4" width="117">](https://github.com/lauset)
[<img alt="wuqirui" src="https://avatars.githubusercontent.com/u/53338059?v=4" width="117">](https://github.com/hhdqirui)

### Information 相关信息

* [GitHub](https://github.com/AShujiao/vscode-background-cover)
* [Visual Studio|Marketplace](https://marketplace.visualstudio.com/items?itemName=manasxx.background-cover)


**赞助**
> 如果这个插件能够帮助到您，不介意的话，请作者喝一杯咖啡吧:) 
 
[<img alt="lauset" src="https://zuhaowan-video.oss-cn-beijing.aliyuncs.com/1587571200/177327269-5cd91cdc-ffeb-4e1d-9193-abe5d2bb6b95.jpg" width="300">](https://github.com/lauset)

**Enjoy!**

The world is worth fighting for.