/*
 * @Description: vscode:uninstall hook — runs from the VS Code install root
 *               just before the extension files are removed from disk. Undoes
 *               everything FileDom may have written: loader blocks in every
 *               patched bundle, generated CSS/JS/asset files, the media-src
 *               CSP relaxation and the code-server cache-bust query.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
    CUSTOM_ASSET_DIR_NAME,
    CUSTOM_CSS_FILE_PREFIX,
    CUSTOM_JS_FILE_NAME,
    clearCodeServerWorkbenchHtmlPatch,
    clearPatchBlock,
    restoreMediaCsp
} from './patchCleanup';

const OUT = path.join(process.cwd(), 'resources', 'app', 'out');
const DESKTOP_WORKBENCH_DIR = path.join(OUT, 'vs', 'workbench');
const WEB_WORKBENCH_DIR = path.join(OUT, 'vs', 'code', 'browser', 'workbench');

// Every JS bundle the extension may have patched. Missing files are skipped —
// older builds don't ship the auxiliary bundles.
const TARGET_JS_PATHS: string[] = [
    path.join(DESKTOP_WORKBENCH_DIR, 'workbench.desktop.main.js'),
    path.join(OUT, 'vs', 'sessions', 'sessions.desktop.main.js'),
    // Cursor Agent Window (Glass) renderer bundle
    path.join(DESKTOP_WORKBENCH_DIR, 'workbench.glass.main.js'),
    // code-server (web mode) install layout
    path.join(WEB_WORKBENCH_DIR, 'workbench.js')
];

const HTML_ENTRIES: string[] = [
    path.join(OUT, 'vs', 'code', 'electron-browser', 'workbench', 'workbench.html'),
    path.join(OUT, 'vs', 'sessions', 'electron-browser', 'sessions.html'),
    path.join(WEB_WORKBENCH_DIR, 'workbench.html')
];

main();

function main(): boolean {
    let allOk = true;
    for (const filePath of TARGET_JS_PATHS) {
        allOk = rewrite(filePath, clearPatchBlock) && allOk;
    }
    for (const filePath of HTML_ENTRIES) {
        allOk = rewrite(filePath, (c) => clearCodeServerWorkbenchHtmlPatch(restoreMediaCsp(c))) && allOk;
    }
    for (const dir of [DESKTOP_WORKBENCH_DIR, WEB_WORKBENCH_DIR]) {
        removeGeneratedFiles(dir);
    }
    return allOk;
}

/** Best-effort rewrite: uninstall runs without vscode APIs or sudo prompts. */
function rewrite(filePath: string, transform: (content: string) => string): boolean {
    if (!fs.existsSync(filePath)) {
        return true;
    }
    try {
        const original = fs.readFileSync(filePath, 'utf-8');
        const cleaned = transform(original);
        if (cleaned !== original) {
            fs.writeFileSync(filePath, cleaned, 'utf-8');
        }
        return true;
    } catch {
        return false;
    }
}

function removeGeneratedFiles(dir: string): void {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return;
    }
    for (const name of names) {
        const isCss = name.startsWith(CUSTOM_CSS_FILE_PREFIX) && name.endsWith('.css');
        if (!isCss && name !== CUSTOM_JS_FILE_NAME && name !== CUSTOM_ASSET_DIR_NAME) {
            continue;
        }
        try {
            fs.rmSync(path.join(dir, name), { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
}
