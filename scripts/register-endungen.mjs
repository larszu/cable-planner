// Meldet den Auflöser aus `ts-endungen.mjs` an. Siehe dort, warum es ihn gibt.
//
// `registerHooks` und nicht `register`: letzteres ist ab Node 24 abgekündigt und
// fährt die Hooks in einem eigenen Thread, was hier nichts nützt — der Auflöser
// ist synchron und schlägt nur Dateiendungen nach.
import { registerHooks } from 'node:module'
import { resolve } from './ts-endungen.mjs'
registerHooks({ resolve })
