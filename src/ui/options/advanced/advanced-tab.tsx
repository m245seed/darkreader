import {m} from 'malevic';
import {getContext} from 'malevic/dom';

import type {ViewProps} from '../../../definitions';

import {ContextMenus} from './context-menus';
import type {DevTools as DevToolsType} from './devtools';
import {EnableForProtectedPages} from './enable-for-protected-pages';
import {ExportSettings} from './export-settings';
import {ImportSettings} from './import-settings';
import {ResetSettings} from './reset-settings';
import {SyncConfig} from './sync-config';
import {SyncSettings} from './sync-settings';

export function AdvancedTab(props: ViewProps): Malevic.Child {
    const context = getContext();
    const store = context.getStore<{DevTools?: typeof DevToolsType}>({});

    if (!store.DevTools) {
        import('./devtools').then((mod) => {
            store.DevTools = mod.DevTools;
            context.refresh();
        });
    }

    const DevTools = store.DevTools;

    return <div class="settings-tab">
        <SyncSettings {...props} />
        <SyncConfig {...props} />
        <EnableForProtectedPages {...props} />
        <ContextMenus {...props} />
        <ImportSettings {...props} />
        <ExportSettings {...props} />
        <ResetSettings {...props} />
        {DevTools ? <DevTools /> : null}
    </div>;
}
