import type {Plugin} from 'prettier';

declare const plugin: Plugin;
export const parsers: Plugin['parsers'];
export const printers: Plugin['printers'];
export const options: Plugin['options'];
export default plugin;

declare module 'prettier' {
  interface Options {
    strictTailwindStylesheet?: string;
    strictTailwindMaxClassLineLength?: number;
    strictTailwindAttributes?: string[];
    strictTailwindFunctions?: string[];
    strictTailwindBreakpoints?: string[];
    strictTailwindStates?: string[];
    strictTailwindAutoDetectStylesheet?: boolean;
    strictTailwindDetectCustomClasses?: boolean;
    strictTailwindFollowImports?: boolean;
    strictTailwindMaxImportDepth?: number;
  }
}
