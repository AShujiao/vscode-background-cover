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

## Features 功能特性

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
*   **Random Switching**: Randomly switch backgrounds from a specified folder or list on startup or via shortcut.
*   **随机切换**: 支持从指定文件夹或列表中随机切换背景图（支持启动时自动切换）。

### ☁️ Online Gallery / 在线图库
*   **Integrated Community**: Browse, upload, and apply wallpapers directly within VS Code.
*   **集成社区**: 在 VS Code 侧边栏直接浏览、上传并一键应用精美壁纸。

### 🛠️ Platform Support / 平台支持
*   **Cross-Platform**: Support Windows, MacOS, Linux, and **Code-Server**.
*   **全平台**: 支持 Windows, MacOS, Linux 以及 **Code-Server** 环境。
*   **No Admin Required**: Auto-permission handling on Windows (v2.6.2+).
*   **无需管理员**: Windows 下自动获取文件写入权限，无需以管理员身份运行。

## ⚠️ Warnings / 警告

> **Note**: This extension works by modifying VS Code's internal files.  
> **注意**: 本插件通过修改 VS Code 内部文件运行。

1.  **First Install / Update**: You might see a "Corrupted" warning. Please click **[Don't show again]**.
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

> **Important**: Please use the extension's command or status bar button to configure. **Manual modification of settings is NOT supported.**  
> **重要提示**: 请务必使用插件自带的命令或状态栏按钮进行配置。**不支持手动修改配置项。**

### Menu Options / 菜单选项

Press `Ctrl + Shift + P` -> `backgroundCover - start` to open the configuration menu.   
按下 `Ctrl + Shift + P` -> `backgroundCover - start` 打开配置菜单。

| Option (选项) | Description (描述) |
| :--- | :--- |
| **Select Pictures** | Select a local image file as background. / 选择一张本地图片作为背景。 |
| **Add Directory** | Add a folder for random background switching. / 添加图片文件夹用于随机切换。 |
| **Input : Path/Https** | Input local path or URL (HTTP/HTTPS/JSON API/HTML). / 输入本地路径或在线图片链接、api地址或html链接。 |
| **Background Opacity** | Adjust background opacity. / 调整背景透明度。 |
| **Background Blur** | Adjust background blur effect. / 调整背景模糊度。 |
| **Size Mode** | Set image fill mode (Cover, Contain, Center, etc.). / 设置图片填充模式。 |
| **Particle Effects** | Configure mouse particle effects (Enable/Disable, Opacity, Color, Count). / 配置鼠标粒子特效。 |
| **Start/Off Replacement** | Enable/Disable auto background switch on startup. / 开启/关闭启动时自动更换背景。 |
| **Closing Background** | Remove background and restore default. / 清除背景并恢复默认。 |

## Shortcuts & Usage / 快捷键与使用

*   **Toggle Background**: Click the button in the status bar.
    *   **切换背景**: 点击状态栏底部的切换按钮。
*   **Start/Config**: `Ctrl + Shift + P` -> `backgroundCover - start`
    *   **开始/配置**: 打开命令面板运行 `backgroundCover - start`。
*   **Random Update**: `Ctrl + Shift + F7` -> Randomly update background and restart.
    *   **随机更新**: 按下 `Ctrl + Shift + F7` 随机更换背景并重启。
*   **Re-apply**: If VS Code updates, the background might disappear. Please re-apply or restart.
    *   **重新应用**: VS Code 更新后背景可能会消失，请手动重新设置或重启插件。



![](https://user-images.githubusercontent.com/14969576/58956744-b076c880-87d1-11e9-8552-7a9f93eaf3b4.jpg)


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

#### ver 2.8.0 (2025/12/14)

感谢 [@WaaSakura](https://github.com/WaaSakura) 提交的[PR](https://github.com/AShujiao/vscode-background-cover/pull/173)

    1.新增支持code-server平台     
    2.输入图片地址功能扩展    
        * 支持返回多图JSON格式API地址
        * 支持静态html（解析a标签图片）   
        * 支持在线图库网站（vs.20988.xyz 解析帖子内的图片） 
    3. 支持在线图库帖子设置为背景图库（通过帖子列表、详情三个点按钮触发）

#### ver 2.8.1 (2025/12/19)

    1.修复vs更新后“重新应用背景”与“自动更换背景”事件冲突 
  
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