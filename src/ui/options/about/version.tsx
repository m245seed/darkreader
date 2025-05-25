import {m} from 'malevic';

import {getLocalMessage} from '../../../utils/locales';
import {MANIFEST} from '../../../utils/manifest';

let appVersion: string;

export function AppVersion(): Malevic.Child {
    if (!appVersion) {
        appVersion = MANIFEST.version;
    }
    return (
        <label class="darkreader-version">{getLocalMessage('version')} {appVersion}</label>
    );
}
