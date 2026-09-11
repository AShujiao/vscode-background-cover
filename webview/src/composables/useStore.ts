import { reactive } from 'vue';
import { DEFAULT_CACHE_LIMIT, DEFAULT_PARTICLE_FPS } from '../constants';

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
    /** false = 所有窗口共用一张背景图（旧版行为） */
    perWindowBackground: boolean;
    /** 在线图片缓存上限（文件个数），超出后按时间自动清理最旧的文件 */
    cacheLimit: number;
}

export interface StudioState {
    petEnabled: boolean;
    petType: string;
    petMessages: string;
    particleEffect: boolean;
    particleColor: string;
    particleCount: number;
    particleOpacity: number;
    /** 粒子特效帧率上限（#230）：高刷屏下限制重绘次数，降低 GPU 占用 */
    particleFps: number;
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
    randomImageFolder: '',
    perWindowBackground: true,
    cacheLimit: DEFAULT_CACHE_LIMIT,
});

export const state = reactive<StudioState>({
    petEnabled: false,
    petType: '',
    petMessages: '',
    particleEffect: false,
    particleColor: '#ffffff',
    particleCount: 60,
    particleOpacity: 0.5,
    particleFps: DEFAULT_PARTICLE_FPS,
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
