/**
 * 补丁状态机（借鉴 shalldie/vscode-background 的 PatchFile 状态检测）。
 *
 * 判定依据是「实际内核文件的内容标记」，而不是 globalState 里记录的 VS Code 版本号：
 * - latest：workbench 文件含当前版本的 bootstrap 标记，补丁是最新的；
 * - legacy：含旧版标记（打过旧版补丁，或扩展升级后标记版本过旧），需要升级补丁；
 * - none  ：无任何标记（VS Code 更新替换了文件 / 用户手动还原 / 首次安装）。
 *
 * 纯逻辑模块，不依赖 vscode API，方便单元测试。
 */
import * as fse from 'fs-extra';

export type PatchState = 'latest' | 'legacy' | 'none';

/**
 * workbench 注入块的起始标记（与 FileDom.getJs() 的 /*ext-backgroundCover-start*\/
 * 保持一致）。
 */
export const PATCH_MARKER_START = '/*ext-backgroundCover-start*/';

/**
 * 当前 bootstrap 版本的标记。改 bootstrap 结构时递增该版本，旧补丁会自动判定为
 * legacy 并在下次启动时提示重新应用。
 */
export const BOOTSTRAP_VERSION = '1';

export function bootstrapMarkerOf(bootstrapVersion: string): string {
    return `/*ext.backgroundCover.bootstrap.${bootstrapVersion}*/`;
}

/**
 * 纯字符串判定：文件内容 → 补丁状态。
 */
export function detectPatchStateFromContent(content: string, bootstrapVersion: string = BOOTSTRAP_VERSION): PatchState {
    if (!content || content.indexOf(PATCH_MARKER_START) === -1) {
        return 'none';
    }
    return content.indexOf(bootstrapMarkerOf(bootstrapVersion)) !== -1 ? 'latest' : 'legacy';
}

/**
 * 读取单个 JS bundle 判定补丁状态。文件不存在/读失败一律按 none 处理
 * （保持静默：启动流程只依赖它做提示，不依赖它做错误上报）。
 */
export async function detectPatchStateFromFile(filePath: string): Promise<PatchState> {
    try {
        const content = await fse.readFile(filePath, 'utf-8');
        return detectPatchStateFromContent(content);
    } catch {
        return 'none';
    }
}
