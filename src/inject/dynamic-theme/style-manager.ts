import { createCORSCopy } from '../../utils/cors';
import { injectStyleAway } from '../../utils/dom';

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
