import type {Theme} from '../../definitions';
import {parseColorWithCache} from '../../utils/color';
import {logWarn} from '../utils/log';

import {modifyBackgroundColor} from './modify-colors';

const metaThemeColorName = 'theme-color';
const metaThemeColorSelector = `meta[name="${metaThemeColorName}"]`;
let srcMetaThemeColor: string | null = null;
let observer: MutationObserver | null = null;

function changeMetaThemeColor(meta: HTMLMetaElement, theme: Theme) {
    srcMetaThemeColor = srcMetaThemeColor ?? meta.content;
    const color = parseColorWithCache(srcMetaThemeColor);
    if (!color) {
        logWarn('Invalid meta color', color);
        return;
    }
    meta.content = modifyBackgroundColor(color, theme, false);
}

export function changeMetaThemeColorWhenAvailable(theme: Theme): void {
    const meta: HTMLMetaElement = document.querySelector(metaThemeColorSelector)!;
    if (meta) {
        changeMetaThemeColor(meta, theme);
    } else {
        if (observer) {
            observer.disconnect();
        }
        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                const {addedNodes} = mutation;
                for (const node of addedNodes) {
                    if (node instanceof HTMLMetaElement && node.name === metaThemeColorName) {
                        observer!.disconnect();
                        observer = null;
                        changeMetaThemeColor(node, theme);
                        return;
                    }
                }
            }
        });
        observer.observe(document.head, {childList: true});
    }
}

export function restoreMetaThemeColor(): void {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    const meta = document.querySelector(metaThemeColorSelector) as HTMLMetaElement;
    if (meta && srcMetaThemeColor) {
        meta.content = srcMetaThemeColor;
    }
}
