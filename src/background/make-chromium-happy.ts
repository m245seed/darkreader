import type {MessageCStoBG, MessageUItoBG} from '../definitions';
import {MessageTypeCStoBG, MessageTypeUItoBG} from '../utils/message';

import {isPanel} from './utils/tab';

// MV3 no longer needs the workaround used for MV2.
export function makeChromiumHappy(): void {
    /* noop */
}
