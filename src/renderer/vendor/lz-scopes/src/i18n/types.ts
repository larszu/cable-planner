// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Message shapes shared by the dictionaries (en.ts is the source, de.ts the translation).

/** Plural forms after Intl.PluralRules (English and German only need `one` and `other`). */
export interface Plural { one: string; other: string; zero?: string }
export type Msg = string | Plural;
export type Messages = Record<string, Msg>;

/**
 * The translation of an English area file: the same keys, a string for a string and the plural
 * forms for a plural. Used as `satisfies Translation<typeof en>` so a missing, extra or
 * mistyped key fails `tsc`.
 */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Plural };
