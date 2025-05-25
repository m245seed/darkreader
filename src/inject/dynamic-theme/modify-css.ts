import type {Theme} from '../../definitions';
import {parseColorWithCache} from '../../utils/color';
import {parseGradient} from '../../utils/css-text/parse-gradient';
import {getAbsoluteURL} from '../../utils/url';
import {logWarn, logInfo} from '../utils/log';

import {cssURLRegex, getCSSURLValue} from './css-rules';
import {cleanImageProcessingCache} from './image';
import {modifyBackgroundColor, modifyBorderColor, modifyForegroundColor, modifyGradientColor, modifyShadowColor, clearColorModificationCache} from './modify-colors';
import type {VariablesStore} from './variables';

// Type definitions
export interface ModifiableCSSDeclaration {
    property: string;
    value: string;
    important?: boolean;
    sourceValue: string;
    modifier?: CSSValueModifier | null;
}

export interface ModifiableCSSRule extends CSSStyleRule {
    parentStyleSheet: CSSStyleSheet | null;
}

export type CSSValueModifier = (theme: Theme) => string | Promise<string | null>;

// Cache management
const modificationCache = new Map<string, any>();
const shadowCache = new Map<string, CSSValueModifier>();
const gradientCache = new Map<string, CSSValueModifier>();

export function cleanModificationCache(): void {
    modificationCache.clear();
    shadowCache.clear();
    gradientCache.clear();
    clearColorModificationCache();
    cleanImageProcessingCache();
}

// Background image property checks
const backgroundImageProperties = [
    'background-image',
    'background',
    'border-image',
    'border-image-source',
    'content',
    'cursor',
    'list-style-image',
    '-webkit-mask-image',
    'mask-image',
];

const backgroundProperties = [
    'background',
    'background-color',
    'background-image',
    'background-position',
    'background-size',
    'background-repeat',
    'background-attachment',
    'background-origin',
    'background-clip',
];

const borderProperties = [
    'border',
    'border-color',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'outline',
    'outline-color',
];

const textColorProperties = [
    'color',
    'caret-color',
    'fill',
    'stroke',
    '-webkit-text-fill-color',
    '-webkit-text-stroke-color',
];

const shadowProperties = [
    'box-shadow',
    'text-shadow',
    '-webkit-box-shadow',
];

// Property type checking functions
function isColorProperty(property: string): boolean {
    return textColorProperties.includes(property);
}

function isBackgroundProperty(property: string): boolean {
    return backgroundProperties.includes(property);
}

function isBorderProperty(property: string): boolean {
    return borderProperties.includes(property);
}

function isShadowProperty(property: string): boolean {
    return shadowProperties.includes(property);
}

function isImageProperty(property: string): boolean {
    return backgroundImageProperties.includes(property);
}

// Value parsing helpers
function hasColor(value: string): boolean {
    return parseColorWithCache(value) != null;
}

function hasURL(value: string): boolean {
    return /url\s*\(/i.test(value);
}

function hasGradient(value: string): boolean {
    return /(linear|radial|conic)-gradient\s*\(/i.test(value);
}

function hasVar(value: string): boolean {
    return /var\s*\(/i.test(value);
}

// Core modification function
export function getModifiableCSSDeclaration(
    property: string,
    value: string,
    rule?: ModifiableCSSRule,
    variablesStore?: VariablesStore | null,
    ignoreImageAnalysis: string[] = [],
    isAsyncCancelled?: () => boolean
): ModifiableCSSDeclaration | null {
    if (!value || value === 'inherit' || value === 'initial' || value === 'unset') {
        return null;
    }

    const sourceValue = value;
    let modifier: CSSValueModifier | null = null;

    // Handle CSS variables first
    if (hasVar(value) && variablesStore) {
        modifier = variablesStore.getModifierForVarDependant(property, value);
        if (modifier) {
            return {
                property,
                value,
                sourceValue,
                modifier,
            };
        }
    }

    // Handle different property types
    if (isColorProperty(property) && hasColor(value)) {
        modifier = (theme: Theme) => modifyForegroundColor(parseColorWithCache(value)!, theme);
    } else if (property === 'background-color' && hasColor(value)) {
        modifier = (theme: Theme) => modifyBackgroundColor(parseColorWithCache(value)!, theme);
    } else if (isBorderProperty(property) && hasColor(value)) {
        modifier = (theme: Theme) => modifyBorderColor(parseColorWithCache(value)!, theme);
    } else if (isShadowProperty(property)) {
        const shadowModifier = getShadowModifierWithInfo(value);
        if (shadowModifier) {
            modifier = shadowModifier;
        }
    } else if (isBackgroundProperty(property) && (hasURL(value) || hasGradient(value))) {
        const bgModifier = getBgImageModifier(value, rule, ignoreImageAnalysis, isAsyncCancelled);
        modifier = typeof bgModifier === 'function' ? bgModifier : null;
    } else if (isImageProperty(property) && hasURL(value)) {
        const bgModifier = getBgImageModifier(value, rule, ignoreImageAnalysis, isAsyncCancelled);
        modifier = typeof bgModifier === 'function' ? bgModifier : null;
    }

    if (modifier) {
        return {
            property,
            value,
            sourceValue,
            modifier,
        };
    }

    return null;
}

// Background image modification
export function getBgImageModifier(
    value: string | Promise<string | null>,
    rule?: ModifiableCSSRule,
    ignoredImageAnalysisSelectors: string[] = [],
    isCancelled?: () => boolean
): CSSValueModifier | string | null {
    if (typeof value === 'object' && value && 'then' in value) {
        // Handle Promise<string | null>
        return async (theme: Theme) => {
            const resolvedValue = await value;
            if (!resolvedValue) {
                return null;
            }
            const modifier = getBgImageModifier(resolvedValue, rule, ignoredImageAnalysisSelectors, isCancelled);
            if (typeof modifier === 'function') {
                return modifier(theme);
            }
            return modifier;
        };
    }

    const stringValue = value as string;
    const cacheKey = `bg:${stringValue}`;

    if (gradientCache.has(cacheKey)) {
        return gradientCache.get(cacheKey)!;
    }

    // Handle gradients
    if (hasGradient(stringValue)) {
        const gradientModifier = (theme: Theme) => {
            return stringValue.replace(/(linear|radial|conic)-gradient\s*\([^)]+\)/gi, (match) => {
                try {
                    const gradients = parseGradient(match);
                    if (gradients && gradients.length > 0) {
                        return modifyGradient(gradients[0], theme);
                    }
                    return match;
                } catch (err) {
                    logWarn('Failed to parse gradient:', match, err);
                    return match;
                }
            });
        };
        gradientCache.set(cacheKey, gradientModifier);
        return gradientModifier;
    }

    // Handle URLs (images)
    if (hasURL(stringValue)) {
        const urlModifier = (_theme: Theme) => {
            return stringValue.replace(cssURLRegex, (match) => {
                try {
                    const url = getCSSURLValue(match);
                    if (url.startsWith('data:')) {
                        return match; // Skip data URLs for now
                    }

                    getAbsoluteURL(rule?.parentStyleSheet?.href || location.href, url);

                    // Check if image analysis should be ignored
                    if (rule && ignoredImageAnalysisSelectors.some((selector) =>
                        rule.selectorText && rule.selectorText.includes(selector))) {
                        return match;
                    }

                    // For now, return the original match
                    // Image processing would be async and complex
                    return match;
                } catch (err) {
                    logWarn('Failed to process URL:', match, err);
                    return match;
                }
            });
        };
        return urlModifier;
    }

    // Handle solid colors in background shorthand
    const color = parseColorWithCache(stringValue);
    if (color) {
        return (theme: Theme) => modifyBackgroundColor(color, theme);
    }

    return null;
}

// Gradient modification helper
function modifyGradient(gradient: any, theme: Theme): string {
    // Simple gradient color replacement for now
    // This is a simplified implementation
    const gradientString = gradient.match || gradient.toString();

    return gradientString.replace(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g, (colorMatch: string) => {
        const color = parseColorWithCache(colorMatch);
        if (color) {
            return modifyGradientColor(color, theme);
        }
        return colorMatch;
    });
}

// Shadow modification
export function getShadowModifierWithInfo(value: string): CSSValueModifier | null {
    const cacheKey = `shadow:${value}`;

    if (shadowCache.has(cacheKey)) {
        return shadowCache.get(cacheKey)!;
    }

    if (!value || value === 'none') {
        return null;
    }

    const shadowModifier = (theme: Theme): string => {
        // Simple shadow parsing - split by comma for multiple shadows
        const shadows = value.split(',').map((shadow) => shadow.trim());

        const modifiedShadows = shadows.map((shadow) => {
            // Extract color from shadow
            const colorMatch = shadow.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]+|\b(?:red|blue|green|yellow|black|white|gray|grey|transparent)\b)/);

            if (colorMatch) {
                const color = parseColorWithCache(colorMatch[0]);
                if (color) {
                    const modifiedColor = modifyShadowColor(color, theme);
                    return shadow.replace(colorMatch[0], modifiedColor);
                }
            }

            return shadow;
        });

        return modifiedShadows.join(', ');
    };

    shadowCache.set(cacheKey, shadowModifier);
    return shadowModifier;
}

// User agent style generation
export function getModifiedUserAgentStyle(theme: Theme, isIFrame: boolean, styleSystemControls: boolean): string {
    const lines: string[] = [];

    lines.push('html {');
    lines.push(`    background: ${modifyBackgroundColor(parseColorWithCache('#ffffff')!, theme)} !important;`);
    lines.push('}');

    if (isIFrame) {
        lines.push('');
        lines.push('html, body {');
        lines.push(`    border-color: ${modifyBorderColor(parseColorWithCache('#999999')!, theme)} !important;`);
        lines.push('}');
    }

    if (styleSystemControls) {
        lines.push('');
        lines.push('input, textarea, select, button {');
        lines.push(`    background-color: ${modifyBackgroundColor(parseColorWithCache('#ffffff')!, theme)} !important;`);
        lines.push(`    border-color: ${modifyBorderColor(parseColorWithCache('#999999')!, theme)} !important;`);
        lines.push(`    color: ${modifyForegroundColor(parseColorWithCache('#000000')!, theme)} !important;`);
        lines.push('}');

        lines.push('');
        lines.push('input[type="range"] {');
        lines.push(`    background-color: ${modifyBackgroundColor(parseColorWithCache('#dddddd')!, theme)} !important;`);
        lines.push('}');
    }

    return lines.join('\n');
}

// Fallback style generation
export function getModifiedFallbackStyle(theme: Theme, options: {strict: boolean}): string {
    const lines: string[] = [];

    const bgColor = modifyBackgroundColor(parseColorWithCache('#ffffff')!, theme);
    const textColor = modifyForegroundColor(parseColorWithCache('#000000')!, theme);
    const borderColor = modifyBorderColor(parseColorWithCache('#999999')!, theme);

    if (options.strict) {
        lines.push('html, body {');
        lines.push(`    background: ${bgColor} !important;`);
        lines.push(`    color: ${textColor} !important;`);
        lines.push('}');
    } else {
        lines.push('html {');
        lines.push(`    background: ${bgColor} !important;`);
        lines.push('}');
        lines.push('');
        lines.push('body {');
        lines.push(`    color: ${textColor} !important;`);
        lines.push('}');
    }

    lines.push('');
    lines.push('input, textarea, select, button {');
    lines.push(`    background: ${bgColor} !important;`);
    lines.push(`    color: ${textColor} !important;`);
    lines.push(`    border-color: ${borderColor} !important;`);
    lines.push('}');

    return lines.join('\n');
}

// Selection color generation
export function getSelectionColor(theme: Theme): {backgroundColorSelection: string; foregroundColorSelection: string} {
    const selectionBg = theme.selectionColor || '#005a9c';
    const selectionText = '#ffffff';

    return {
        backgroundColorSelection: modifyBackgroundColor(parseColorWithCache(selectionBg)!, theme),
        foregroundColorSelection: modifyForegroundColor(parseColorWithCache(selectionText)!, theme),
    };
}

// Image selector checking
export function checkImageSelectors(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const element = node as Element;

    // Check for background images in inline styles
    if (element instanceof HTMLElement && element.style) {
        const bgImage = element.style.backgroundImage;
        if (bgImage && hasURL(bgImage)) {
            // Trigger image processing if needed
            logInfo('Found background image in inline style:', bgImage);
        }
    }

    // Check img elements
    if (element.tagName === 'IMG') {
        const img = element as HTMLImageElement;
        if (img.src) {
            logInfo('Found img element:', img.src);
        }
    }

    // Recursively check child nodes
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
        checkImageSelectors(children[i]);
    }
}

// Factory function for creating fallback handlers
export function createFallbackFactory(): () => string {
    return () => {
        return `
            html { background: #111 !important; }
            body { color: #e8e6e3 !important; }
        `;
    };
}
