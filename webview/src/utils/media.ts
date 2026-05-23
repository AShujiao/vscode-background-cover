/**
 * Detect whether a path points at a video file based on its extension.
 * Used to decide between <img> and <video> in previews.
 */
const VIDEO_EXTS = new Set([
    'mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mkv'
]);

export function isVideoPath(p: string | undefined | null): boolean {
    if (!p) { return false; }
    // strip query / hash and lower-case
    const clean = p.split(/[?#]/)[0].toLowerCase();
    const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1) : '';
    return VIDEO_EXTS.has(ext);
}
