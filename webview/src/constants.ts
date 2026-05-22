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

export const ONLINE_GALLERY_URL = 'https://vs.20988.xyz/d/24-vscodebei-jing-tu-tu-ku';
