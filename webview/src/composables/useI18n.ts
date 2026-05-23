import { ref, computed } from 'vue';
import en from '../locales/en';
import zh from '../locales/zh';

export type Locale = 'en' | 'zh';
export type MessageKey = keyof typeof en;

const tables: Record<Locale, typeof en> = { en, zh: zh as typeof en };
const locale = ref<Locale>('en');

export function setLocale(l: Locale) { locale.value = l; }
export function getLocale(): Locale { return locale.value; }

export function useI18n() {
    return {
        locale,
        t(key: MessageKey): string {
            const table = tables[locale.value] ?? en;
            return (table as any)[key] ?? (en as any)[key] ?? String(key);
        }
    };
}

export const i18nLocale = computed(() => locale.value);
