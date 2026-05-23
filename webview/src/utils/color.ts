/**
 * Bridge helpers between the extension's "R,G,B" string storage format
 * and CSS hex strings used by Element Plus color picker.
 */

function clamp(n: number): number {
    if (!Number.isFinite(n)) { return 0; }
    return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbStringToHex(rgb: string | undefined | null): string {
    if (!rgb) { return '#ffffff'; }
    const trimmed = rgb.trim();
    if (trimmed.startsWith('#')) { return trimmed.toLowerCase(); }
    const parts = trimmed.split(',').map((s) => Number(s.trim()));
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) { return '#ffffff'; }
    const [r, g, b] = parts.map(clamp);
    return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export function hexToRgbString(hex: string | undefined | null): string {
    if (!hex) { return '255,255,255'; }
    let v = hex.trim();
    if (v.startsWith('#')) { v = v.slice(1); }
    if (v.length === 3) {
        v = v.split('').map((c) => c + c).join('');
    }
    if (v.length !== 6 || /[^0-9a-fA-F]/.test(v)) { return '255,255,255'; }
    const r = parseInt(v.slice(0, 2), 16);
    const g = parseInt(v.slice(2, 4), 16);
    const b = parseInt(v.slice(4, 6), 16);
    return `${r},${g},${b}`;
}
