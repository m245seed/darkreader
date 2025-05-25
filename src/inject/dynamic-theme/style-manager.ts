import type { Theme } from '../../definitions';
import { createCORSCopy } from '../../utils/cors';
import { injectStyleAway } from '../../utils/dom';

export type StyleElement = HTMLStyleElement | HTMLLinkElement;

export interface StyleManager {
    details(options: { secondRound: boolean }): { rules: CSSRuleList } | null;
    render(theme: Theme, ignoreImageAnalysis: string[]): void;
    watch(): void;
    restore(): void;
    pause(): void;
    destroy(): void;
}

interface StyleManagerOptions {
    update: () => void;
    loadingStart: () => void;
    loadingEnd: () => void;
}

export function manageStyle(element: StyleElement, options: StyleManagerOptions): StyleManager {
    // Implementation would go here
    // For now, just providing a stub that satisfies the interface
    return {
        details: (options) => {
            return { rules: document.styleSheets[0].cssRules }; // Stub implementation
        },
        render: (theme, ignoreImageAnalysis) => {
            // Render implementation
        },
        watch: () => {
            // Watch implementation
        },
        restore: () => {
            // Restore implementation
        },
        pause: () => {
            // Pause implementation
        },
        destroy: () => {
            // Destroy implementation
        },
    };
}

export function getManageableStyles(node: Node): StyleElement[] {
    // Implementation would go here
    return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')) as StyleElement[];
}

export function cleanLoadingLinks(): void {
    // Implementation would go here
}

let corsCopy: HTMLStyleElement | null = null;
const fullCSSText: string = '/* Your CSS content here */';
const inMode: string = 'next'; // or 'default'
const element: HTMLElement = document.createElement('div');

// Add the element to the DOM
document.body.appendChild(element);

if (!corsCopy) {
    corsCopy = createCORSCopy(
        fullCSSText,
        inMode === 'next' ? (cc: HTMLStyleElement) => element.parentNode!.insertBefore(cc, element.nextSibling) : injectStyleAway,
    );
    if (corsCopy) {
        element.parentNode!.insertBefore(corsCopy, element.nextSibling);
    }
}
