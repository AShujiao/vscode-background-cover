const RETRYABLE_DOWNLOAD_CODES = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
    'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'ECONNABORTED',
    'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'
]);

export class BackgroundDownloadError extends Error {
    readonly statusCode?: number;
    readonly retrySame: boolean;
    readonly tryNextImage: boolean = true;
    readonly code?: string;

    constructor(message: string, options: { statusCode?: number; code?: string } = {}) {
        super(message);
        this.name = 'BackgroundDownloadError';
        this.statusCode = options.statusCode;
        this.code = options.code;
        this.retrySame = isRetryableDownload(options.statusCode, message, options.code);
    }
}

export class BackgroundPatchError extends Error {
    readonly tryNextImage: boolean = false;

    constructor(message: string) {
        super(message);
        this.name = 'BackgroundPatchError';
    }
}

export class BackgroundApplyCancelledError extends Error {
    readonly tryNextImage: boolean = false;

    constructor() {
        super('Background apply cancelled');
        this.name = 'BackgroundApplyCancelledError';
    }
}

export function shouldTryNextAutoImage(error: unknown): boolean {
    return error instanceof BackgroundDownloadError;
}

export function pickUnusedCandidate(candidates: string[], tried: Set<string>): string | undefined {
    const pool = candidates.filter(item => !tried.has(item));
    if (pool.length === 0) {
        return undefined;
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function isRetryableDownload(statusCode: number | undefined, message: string, code?: string): boolean {
    if (statusCode === 429 || (statusCode !== undefined && statusCode >= 500 && statusCode <= 599)) {
        return true;
    }
    if (code && RETRYABLE_DOWNLOAD_CODES.has(code)) {
        return true;
    }
    const lower = message.toLowerCase();
    return lower.includes('timeout') || lower.includes('socket hang up');
}

export function wrapDownloadError(error: unknown, statusCode?: number): BackgroundDownloadError {
    if (error instanceof BackgroundDownloadError) {
        return error;
    }
    const err = error as NodeJS.ErrnoException;
    const message = (err && err.message) ? err.message : String(error);
    const code = typeof err?.code === 'string' ? err.code : undefined;
    const matchedStatus = statusCode ?? parseDownloadStatusCode(message);
    return new BackgroundDownloadError(message, { statusCode: matchedStatus, code });
}

function parseDownloadStatusCode(message: string): number | undefined {
    const match = /Failed to download: (\d+)/.exec(message);
    return match ? Number(match[1]) : undefined;
}
