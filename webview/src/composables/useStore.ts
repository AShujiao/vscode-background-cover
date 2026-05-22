import { reactive } from 'vue';

/**
 * Reactive snapshot of extension-side configuration mirrored into the webview.
 * The extension pushes a 'state' message; the bridge listener writes here.
 */
export interface StudioConfig {
    opacity: number;
    blur: number;
    imagePath: string;
    imagePathDisplay: string;     // webview URI for <img src>
    autoStatus: boolean;
    autoInterval: number;
    sizeModel: string;
    blendModel: string;
    randomImageFolder: string;
}

export interface StudioState {
    petEnabled: boolean;
    petType: string;
    particleEffect: boolean;
    particleColor: string;
    particleCount: number;
    particleOpacity: number;
    recentImages: Array<{ path: string; display: string; name: string }>;
    folderImages: Array<{ path: string; display: string; name: string }>;
    folderImagesTotal: number;
    pets: Array<{ value: string; label: string; desc: string; thumb: string }>;
    colorPalette: Array<{ name: string; rgb: string; hex: string }>;
}

export const config = reactive<StudioConfig>({
    opacity: 0.2,
    blur: 0,
    imagePath: '',
    imagePathDisplay: '',
    autoStatus: false,
    autoInterval: 10,
    sizeModel: 'cover',
    blendModel: 'auto',
    randomImageFolder: ''
});

export const state = reactive<StudioState>({
    petEnabled: false,
    petType: '',
    particleEffect: false,
    particleColor: '#ffffff',
    particleCount: 60,
    particleOpacity: 0.5,
    recentImages: [],
    folderImages: [],
    folderImagesTotal: 0,
    pets: [],
    colorPalette: []
});

export interface StudioBrand {
    logo: string;
    name: string;
}

export const brand = reactive<StudioBrand>({
    logo: '',
    name: ''
});

export function applyState(data: any) {
    if (!data) { return; }
    if (data.config) { Object.assign(config, data.config); }
    if (data.state)  { Object.assign(state,  data.state); }
    if (typeof data.brandLogo === 'string') { brand.logo = data.brandLogo; }
    if (typeof data.brandName === 'string') { brand.name = data.brandName; }
}
