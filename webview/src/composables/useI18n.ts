import { ref } from 'vue';
import en from '../locales/en';
import zh from '../locales/zh';

export type Locale = 'en' | 'zh';
export type MessageKey = keyof typeof en;
export type MessageParams = Record<string, string | number>;

const tables: Record<Locale, typeof en> = { en, zh: zh as typeof en };
const locale = ref<Locale>('en');

export function setLocale(l: Locale) { locale.value = l; }
export function getLocale(): Locale { return locale.value; }

export function useI18n() {
    return {
        locale,
        /** t('key', { n: 1 }) 会把文案中的 `{n}` 替换为 1；未提供的占位符原样保留。 */
        t(key: MessageKey, params?: MessageParams): string {
            const table = tables[locale.value] ?? en;
            const text: string = (table as any)[key] ?? (en as any)[key] ?? String(key);
            if (!params) { return text; }
            return text.replace(/\{(\w+)\}/g, (m, name: string) =>
                Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m
            );
        }
    };
}
