/**
 * Mirror of src/PickList.ts ActionType enum.
 * Keep in sync when adding new actions extension-side.
 */
export const ActionType = {
    SelectPictures:      1,
    AddDirectory:        2,
    UpdateBackground:    4,
    BackgroundOpacity:   5,
    InputPath:           6,
    CloseBackground:     7,
    ReloadWindow:        8,
    OpenFilePath:        14,
    BackgroundBlur:      18,
    RefreshOnlineFolder: 19,
    AutoRandomSettings:  20,
    OpenCacheFolder:     21,
    SelectPet:           26,
    TogglePet:           27,
    ToggleParticle:      31,
    ParticleOpacity:     32,
    ParticleColor:       33,
    ParticleCount:       34
} as const;

export const SIZE_MODES = [
    'cover', 'repeat', 'contain', 'center',
    'not_center', 'not_right_bottom', 'not_right_top',
    'not_left', 'not_right', 'not_top', 'not_bottom'
];

export const BLEND_MODES = ['auto', 'multiply', 'lighten'];

/**
 * Mirror of DEFAULT_ONLINE_CACHE_LIMIT in src/onlineCache.ts（前端无法 import 扩展侧代码）。
 * 必须与 package.json 的 backgroundCover.cacheLimit 默认值一致，
 * scripts/test-prune-cache.js 会校验三处是否漂移。
 */
export const DEFAULT_CACHE_LIMIT = 200;

export const ONLINE_GALLERY_URL = 'https://vs.20988.xyz';

/** 关于区入口，与 src/PickList.ts getMoreMenuItems() 保持一致。 */
export const GITHUB_REPO_URL = 'https://github.com/AShujiao/vscode-background-cover';
export const GITHUB_ISSUES_URL = 'https://github.com/AShujiao/vscode-background-cover/issues';
