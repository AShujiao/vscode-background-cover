/*
 * @Description: vscode:uninstall hook — runs from the VS Code install root
 *               just before the extension files are removed from disk. Undoes
 *               everything FileDom may have written: loader blocks in every
 *               patched bundle, generated CSS/JS/asset files, the media-src
 *               CSP relaxation, the code-server cache-bust query and the
 *               first-patch .bak backups.
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

// VS Code forks this file as the entry script; skip when required by tests.
if (require.main === module) {
    main();
}

/**
 * VS Code forks this hook without a cwd, so process.cwd() is inherited from
 * the shared process (often `/` on macOS). Locate `<root>/resources/app/out`
 * by walking up from the Electron executable instead, keeping cwd as fallback.
 *
 * Newer VS Code system installs use a versioned layout:
 * `<install root>/<commit>/resources/app/out` — the workbench lives under a
 * per-commit subdirectory, not directly under the root. So each candidate root
 * is also scanned one level deep for `<sub>/resources/app/out`. The install
 * root has only a handful of entries, so the extra readdir is cheap.
 */
export function findAppOutDirs(execPath: string, cwd: string): string[] {
    const found: string[] = [];
    const push = (out: string) => {
        if (!found.some((f) => f.toLowerCase() === out.toLowerCase()) && fs.existsSync(path.join(out, 'vs'))) {
            found.push(out);
        }
    };
    const tryRoot = (root: string) => {
        for (const res of ['resources', 'Resources']) {
            push(path.join(root, res, 'app', 'out'));
        }
        // Versioned layout: <root>/<commit-dir>/resources/app/out
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(root, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }
            // Commit dirs are hex hashes; skip obviously unrelated entries
            // (bin, tools, locales, …) to keep the loop tight.
            if (!/^[0-9a-f]{6,}$/i.test(entry.name)) {
                continue;
            }
            for (const res of ['resources', 'Resources']) {
                push(path.join(root, entry.name, res, 'app', 'out'));
            }
        }
    };
    let dir = path.dirname(execPath);
    for (let i = 0; i < 8; i++) {
        tryRoot(dir);
        const parent = path.dirname(dir);
        if (parent === dir) { break; }
        dir = parent;
    }
    tryRoot(cwd);
    return found;
}

function main(): boolean {
    let allOk = true;
    for (const out of findAppOutDirs(process.execPath, process.cwd())) {
        allOk = cleanAppOut(out) && allOk;
    }
    return allOk;
}

export function cleanAppOut(out: string): boolean {
    const desktopWorkbenchDir = path.join(out, 'vs', 'workbench');
    const webWorkbenchDir = path.join(out, 'vs', 'code', 'browser', 'workbench');
    // Every JS bundle the extension may have patched. Missing files are skipped —
    // older builds don't ship the auxiliary bundles.
    const targetJsPaths = [
        path.join(desktopWorkbenchDir, 'workbench.desktop.main.js'),
        path.join(out, 'vs', 'sessions', 'sessions.desktop.main.js'),
        // Cursor Agent Window (Glass) renderer bundle
        path.join(desktopWorkbenchDir, 'workbench.glass.main.js'),
        // code-server (web mode) install layout
        path.join(webWorkbenchDir, 'workbench.js')
    ];
    const htmlEntries = [
        path.join(out, 'vs', 'code', 'electron-browser', 'workbench', 'workbench.html'),
        path.join(out, 'vs', 'sessions', 'electron-browser', 'sessions.html'),
        path.join(webWorkbenchDir, 'workbench.html')
    ];
    let allOk = true;
    for (const filePath of targetJsPaths) {
        allOk = rewrite(filePath, clearPatchBlock) && allOk;
    }
    for (const filePath of htmlEntries) {
        allOk = rewrite(filePath, (c) => clearCodeServerWorkbenchHtmlPatch(restoreMediaCsp(c))) && allOk;
    }
    for (const dir of [desktopWorkbenchDir, webWorkbenchDir]) {
        removeGeneratedFiles(dir);
    }
    // Drop the first-patch backups: the patch block is gone now, so the .bak
    // rollback duty is over. Leaving it behind would break the next install —
    // FileDom only re-captures a backup when the .bak file is absent, and a
    // stale one may predate a VS Code update.
    for (const filePath of targetJsPaths) {
        removeBackupFile(`${filePath}.bak`);
    }
    return allOk;
}

/** Best-effort removal of a single first-patch backup file. */
function removeBackupFile(bakPath: string): void {
    try {
        fs.rmSync(bakPath, { force: true });
    } catch {
        // ignore — a leftover .bak is harmless on its own
    }
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
