/*
 * @Description: vscode:uninstall hook — runs from the VS Code install root
 *               just before the extension files are removed from disk. Strips
 *               the background-cover marker block from every bundle we ever
 *               patch.
 */

import * as path from 'path';
import * as fs from 'fs';

const base = process.cwd();
const extName = "backgroundCover";

// Every JS bundle the extension may have patched. The main workbench bundle
// is required; auxiliary bundles (AgentView etc.) are best-effort — older
// VSCode builds may not ship them.
const TARGET_JS_PATHS: string[] = [
    path.join(base, 'resources', 'app', 'out', 'vs', 'workbench', 'workbench.desktop.main.js'),
    path.join(base, 'resources', 'app', 'out', 'vs', 'sessions', 'sessions.desktop.main.js'),
    // code-server (web mode) install layout
    path.join(base, 'resources', 'app', 'out', 'vs', 'code', 'browser', 'workbench', 'workbench.js')
];

main();

function main(): boolean {
    let allOk = true;
    for (const filePath of TARGET_JS_PATHS) {
        if (!fs.existsSync(filePath)) {
            continue;
        }
        try {
            const original = fs.readFileSync(filePath, 'utf-8');
            const cleaned = clearCssContent(original);
            if (cleaned !== original) {
                fs.writeFileSync(filePath, cleaned, 'utf-8');
            }
        } catch (ex) {
            allOk = false;
        }
    }
    return allOk;
}

function clearCssContent(content: string): string {
    const re = new RegExp("\\/\\*ext-" + extName + "-start\\*\\/[\\s\\S]*?\\/\\*ext-" + extName + "-end\\*" + "\\/", "g");
    content = content.replace(re, '');
    content = content.replace(/\s*$/, '');
    return content;
}
