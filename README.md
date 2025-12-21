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
<b>(v3.0 Hot Reload Supported / 支持热更新)</b><br/>
<br/>
添加一张你喜欢的图片铺满整个vscode, 以及鼠标跟随的粒子效果动画
<br/>
<a href="https://github.com/vscode-extension/vscode-background-cover">
<img src="https://img.shields.io/github/stars/vscode-extension/vscode-background-cover.svg?style=social" alt="stars">
</a>

</p>

## Features 功能特性

### 🚀 Hot Reload / 热更新 (v3.0)
*   **Instant Switch**: Change background images instantly without restarting VS Code.
*   **即刻生效**: 切换背景图片无需重启 VS Code，即点即用，丝滑体验。

### ⚙️ Visual Configuration / 可视化配置 (v3.0)
*   **Sidebar Panel**: New sidebar UI for easy configuration.
*   **侧边栏面板**: 全新左侧侧边栏可视化配置，操作更便捷。
*   **Multi-language**: Support multiple languages.
*   **多语言支持**: 支持多语言切换。

### 🔄 Auto Carousel / 自动轮播 (v3.0)
*   **Timed Rotation**: Automatically rotate multiple images at set intervals.
*   **定时轮播**: 支持多张图片定时自动轮播。

### 🎨 Custom Background / 自定义背景
*   **Flexible Sources**: Support local image paths (File) and online URLs (HTTP/HTTPS).
*   **灵活来源**: 支持设置本地图片路径或在线图片链接。
*   **Advanced Parsing**: Support JSON API (multi-image), static HTML (img tags), and Gallery Posts.
*   **高级解析**: 支持解析 JSON API（多图）、静态 HTML 页面及图库帖子中的图片。

### ✨ Visual Effects / 视觉特效
*   **Opacity & Blur**: Adjustable transparency (0.1 - 1.0) and blur effects for the background.
*   **透明度与模糊**: 可自由调节背景图片的透明度和模糊程度，打造最佳code体验。
*   **Mouse Particles**: Cool mouse-following particle animations (integrated from vscode-nest).
*   **鼠标粒子**: 集成炫酷的鼠标跟随粒子动画效果。

### 🖼️ Layout & Display / 布局与显示
*   **Fill Modes**: Support various CSS background-size modes (cover, contain, etc.) and positioning.
*   **填充模式**: 支持多种图片填充方式（铺满、适应等）及自定义位置设置。

### ☁️ Online Gallery / 在线图库
*   **Integrated Community**: Browse, upload, and apply wallpapers directly within VS Code.
*   **集成社区**: 在 VS Code 侧边栏直接浏览、上传并一键应用精美壁纸。

### 🛠️ Platform Support / 平台支持
*   **Cross-Platform**: Support Windows, MacOS, Linux, and **Code-Server**.
*   **全平台**: 支持 Windows, MacOS, Linux 以及 **Code-Server** 环境。
*   **No Admin Required**: Auto-permission handling on Windows.
*   **无需管理员**: Windows 下自动获取文件写入权限，无需以管理员身份运行。

## ⚠️ Warnings / 警告

> **Note**: This extension works by modifying VS Code's internal files.  
> **注意**: 本插件通过修改 VS Code 内部文件运行。

1.  **v3.0 Upgrade**: First time use requires re-hooking. Please restart VS Code once after permission grant.
    *   **v3.0 升级**: 首次使用需要重新获取权限，授权后请重启一次 VS Code。
2.  **First Install / Update**: You might see a "Corrupted" warning. Please click **[Don't show again]**.
    *   **初次安装/更新**: 可能会出现“安装损坏”的提示，请点击 **【不再提示】**。
2.  **Overlap Issue**: If background overlaps after upgrade, please restart VS Code.
    *   **重叠问题**: 升级后如果背景重叠，请重启 VS Code。
3.  **Restore**: If VS Code fails to open, restore the file manually:
    *   **手动还原**: 如果无法打开 VS Code，请手动还原以下文件：
    *   Path: `Microsoft VS Code\resources\app\out\vs\workbench\`
    *   Rename `workbench.desktop.main.js.bak` -> `workbench.desktop.main.js`

![](https://user-images.githubusercontent.com/14969576/47090529-b1b0b080-d255-11e8-8812-d541cb1c3852.png)



## 🖼️ Gallery / 效果展示

[**Integrated Online Gallery / 集成在线图库**](https://vs.20988.xyz/d/24-vscodebei-jing-tu-tu-ku)

> Please configure via the extension commands or status bar button.  
> 请通过插件配置命令或底部按钮进行配置。

![05](https://github.com/user-attachments/assets/373c373e-e672-4ed4-9b4b-d09eaa457c9d)
![微信截图_20241119082747](https://github.com/user-attachments/assets/eb94402d-7193-488a-a148-353879a7e71a)
![](https://github.com/user-attachments/assets/b17f3358-124a-48b0-822b-a1443a2c1e2c)
![](https://github.com/AShujiao/vscode-maxPlus/assets/14969576/20172d72-5384-4bfe-bceb-ec582cfb1698)
![](https://github.com/AShujiao/vscode-maxPlus/assets/14969576/dcbb7870-8342-4069-9dd8-026d3b903420)
![Image](https://github.com/user-attachments/assets/078e6d26-412b-4bb8-8113-3ac3972153b1)
![Image](https://github.com/user-attachments/assets/a8668f9c-6ff1-46f1-b5c2-b606ed327910)
![Image](https://github.com/user-attachments/assets/0ad0f6e2-a777-45a9-ad02-1fd2caaac1df)


## Config 配置项

> **New in v3.0**: Please use the **Sidebar Panel** (Activity Bar) to configure the extension.  
> **v3.0 新特性**: 请使用左侧 **活动栏图标** 打开配置面板进行设置。

### ⚙️ Sidebar Settings / 侧边栏设置

Click the `Background Cover` icon in the left activity bar to open the settings panel:
点击左侧活动栏的 `Background Cover` 图标打开设置面板：

*   **Image Source**: Select local files, folders, or enter URLs. / 选择本地文件、文件夹或输入链接。
*   **Appearance**: Adjust Opacity, Blur, and Fill Mode. / 调整透明度、模糊度和填充模式。
*   **Animation**: Configure Mouse Particles and Auto Carousel. / 配置鼠标粒子和自动轮播。

*(The Command Palette `Ctrl + Shift + P` -> `backgroundCover - start` is still available as an alternative)*

## Shortcuts & Usage / 快捷键与使用

*   **Toggle Background**: Click the button in the status bar.
    *   **切换背景**: 点击状态栏底部的切换按钮。
*   **Start/Config**: `Ctrl + Shift + P` -> `backgroundCover - start`
    *   **开始/配置**: 打开命令面板运行 `backgroundCover - start`。
*   **Random Update**: `Ctrl + Shift + F7` -> Randomly update background.
    *   **随机更新**: 按下 `Ctrl + Shift + F7` 随机更换背景。
*   **Re-apply**: If VS Code updates, the background might disappear. Please re-apply.
    *   **重新应用**: VS Code 更新后背景可能会消失，请手动重新设置。

> **Note**: For v3.0+, changing background is instant (Hot Reload). However, for the **first time** after upgrade, you must allow the permission hook and restart VS Code once.
> **注意**: v3.0+ 版本支持热更新（无需重启）。但在升级后 **首次使用** 时，必须允许权限 Hook 并重启一次 VS Code 才能生效。



## 🗑️ Uninstall / 卸载

If the background remains after uninstalling:
卸载后如果背景还在：

1.  Disable/Uninstall the extension.
2.  Restart VS Code.
3.  The extension will clean up automatically on the last run.
    *   插件会在最后一次运行时自动清理，重启即可。

## ❓ Q&A / 常见问题

**Q: Nothing happens after installing? / 安装后无反应？**
A: Make sure you have administrator rights (Run as Administrator).
A: 请确保你有管理员权限（以管理员身份运行）。

**Q: How to run as Administrator? / 如何以管理员身份运行？**
A: Right-click VS Code icon -> "Run as administrator".
A: 右键点击 VS Code 图标 -> “以管理员身份运行”。

**Q: Mac Administrator? / Mac 管理员权限？**
A: The extension will ask for password if needed. Or you can manually `sudo chown` the files.
A: 插件会在需要时请求密码。或者你可以手动修改文件权限。

---

## 最近更新日志
[完整日志](https://github.com/vscode-extension/vscode-background-cover/blob/master/CHANGELOG.md)

#### ver 3.0.0 (2025/12/21)

    1.🎉 重大更新：支持背景图热更新，切换图片无需重启 VSCode 即刻生效！
    2.✨ 新增左侧侧边栏可视化配置面板，操作更便捷
    3.🌐 新增多语言支持（国际化）
    4.🔄 新增多图定时自动轮播功能
    5.🛠 底层架构重构与性能优化
    ⚠️ 注意：本次更新涉及底层变动，首次使用需重新获取权限（Hook）并重启一次 VSCode 后生效。 
  
---
### Thanks 感谢

* [vscode-background](https://github.com/shalldie/vscode-background)
* [feature_restart_random_image](https://github.com/AShujiao/vscode-background-cover/pull/2)
* [Canvas-nest.js](https://github.com/hustcc/canvas-nest.js) 一个非常好看的网页粒子背景插件

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
[<img alt="WaaSakura" src="https://avatars.githubusercontent.com/u/54162467?v=4" width="117">](https://github.com/WaaSakura)

### Information 相关信息

* [GitHub](https://github.com/AShujiao/vscode-background-cover)
* [Visual Studio|Marketplace](https://marketplace.visualstudio.com/items?itemName=manasxx.background-cover)


**赞助**
> 如果这个插件能够帮助到您，不介意的话，请作者喝一杯咖啡吧:) 
 
[<img alt="lauset" src="https://zuhaowan-video.oss-cn-beijing.aliyuncs.com/1587571200/177327269-5cd91cdc-ffeb-4e1d-9193-abe5d2bb6b95.jpg" width="300">](https://github.com/lauset)

**Enjoy!**

The world is worth fighting for.