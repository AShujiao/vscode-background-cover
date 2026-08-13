
import * as sudo from '@vscode/sudo-prompt';

export class SudoPromptHelper {
    static async exec(command: string, options: any = { name: 'backgroundCover' }): Promise<string> {
        return new Promise((resolve, reject) => {
            sudo.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                // icacls/takeown often write status text to stderr even when they
                // succeed. Treat a zero exit as success and keep stderr for logs.
                if (stderr) {
                    console.warn('[SudoPromptHelper] stderr:', stderr.toString());
                }
                resolve(stdout ? stdout.toString() : '');
            });
        });
    }
}