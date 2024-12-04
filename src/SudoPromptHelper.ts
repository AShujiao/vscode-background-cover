
import * as sudo from 'sudo-prompt';

export class SudoPromptHelper {
    static async exec(command: string, options: any = { name: 'backgroundCover' }): Promise<string> {
        return new Promise((resolve, reject) => {
            sudo.exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else if (stderr) {
                    reject(new Error(stderr ? stderr.toString() : ''));
                } else {
                    resolve(stdout ? stdout.toString() : '');
                }
            });
        });
    }
}