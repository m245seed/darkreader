import {parseArray} from '../../utils/text';
import {isFullyQualifiedDomain, isFullyQualifiedDomainWildcard, fullyQualifiedDomainMatchesWildcard, isURLInList, isURLMatched} from '../../utils/url';

declare const __TEST__: boolean;

const INDEX_CACHE_CLEANUP_INTERVAL_IN_MS = 60000;


declare function clearTimeout(id: ReturnType<typeof setTimeout> | null | undefined): void;

interface SitePropsMut {
    url: readonly string[];
}

type SiteProps = Readonly<SitePropsMut>;

export interface SitePropsIndex<SiteFix extends SiteProps> {
    offsets: Readonly<string>;
    domains: Readonly<{[domain: string]: readonly number[]}>;
    domainLabels: Readonly<{[domainLabel: string]: readonly number[]}>;
    nonstandard: readonly number[];
    cacheSiteFix: {[offsetId: number]: Readonly<SiteFix>};
    cacheDomainIndex: {[domain: string]: readonly number[]};
    cacheCleanupTimer: ReturnType<typeof setTimeout> | null;
}

interface ConfigIndex {
    domains: Readonly<{[domain: string]: readonly number[]}>;
    domainLabels: Readonly<{[domainLabel: string]: readonly number[]}>;
    nonstandard: Readonly<number[] | null>;
}

export interface SiteListIndex {
    urls: readonly string[];
    domains: Readonly<{[domain: string]: number[]}>;
    domainLabels: Readonly<{[domainLabel: string]: readonly number[]}>;
    nonstandard: readonly number[];
}

export interface SitesFixesParserOptions<T> {
    commands: readonly string[];
    getCommandPropName: (command: string) => keyof T;
    parseCommandValue: (command: string, value: string) => any;
}

export function parseSitesFixesConfig<T extends SiteProps>(text: string, options: SitesFixesParserOptions<T>): T[] {
    const sites: T[] = [];

    const blocks = text.replace(/\r/g, '').split(/^\s*={2,}\s*$/gm);
    blocks.forEach((block) => {
        const lines = block.split('\n');
        const commandIndices: number[] = [];
        lines.forEach((ln, i) => {
            if (ln.match(/^[A-Z]+(\s[A-Z]+){0,2}$/)) {
                commandIndices.push(i);
            }
        });

        if (commandIndices.length === 0) {
            return;
        }

        const siteFix = {
            url: parseArray(lines.slice(0, commandIndices[0]).join('\n')) as readonly string[],
        } as T;

        commandIndices.forEach((commandIndex, i) => {
            const command = lines[commandIndex].trim();
            const valueText = lines.slice(commandIndex + 1, i === commandIndices.length - 1 ? lines.length : commandIndices[i + 1]).join('\n');
            const prop = options.getCommandPropName(command);
            if (!prop) {
                return;
            }
            const value = options.parseCommandValue(command, valueText);
            siteFix[prop] = value;
        });

        sites.push(siteFix);
    });

    return sites;
}


export function getDomain(url: string): string {
    try {
        return (new URL(url)).hostname.toLowerCase();
    } catch (error) {
        return url.split('/')[0].toLowerCase();
    }
}


function encodeOffsets(offsets: Array<[number, number]>): string {
    return offsets.map(([offset, length]) => {
        const stringOffset = offset.toString(36);
        const stringLength = length.toString(36);
        return '0'.repeat(4 - stringOffset.length) + stringOffset + '0'.repeat(3 - stringLength.length) + stringLength;
    }).join('');
}

function decodeOffset(offsets: string, index: number): [number, number] {
    const base = (4 + 3) * index;
    const offset = parseInt(offsets.substring(base + 0, base + 4), 36);
    const length = parseInt(offsets.substring(base + 4, base + 4 + 3), 36);
    return [
        offset,
        offset + length,
    ];
}

function addLabel(set: { [label: string]: number[] }, label: string, index: number) {
    if (!set[label]) {
        set[label] = [index];
    } else if (!(set[label].includes(index))) {
        set[label].push(index);
    }
}

function extractDomainLabelsFromFullyQualifiedDomainWildcard(fullyQualifiedDomainWildcard: string): string[] {
    const postfixStart = fullyQualifiedDomainWildcard.lastIndexOf('*');
    const postfix = fullyQualifiedDomainWildcard.substring(postfixStart + 2);
    if (postfixStart < 0 || postfix.length === 0) {
        return fullyQualifiedDomainWildcard.split('.');
    }
    const labels = [postfix];
    const prefix = fullyQualifiedDomainWildcard.substring(0, postfixStart);
    prefix.split('.').filter(Boolean).forEach((l) => labels.concat(l));
    return labels;
}

function indexConfigURLs(urls: string[][]): {domains: { [domain: string]: number[] }; domainLabels: { [domainLabel: string]: number[] }; nonstandard: number[]} {
    const domains: { [domain: string]: number[] } = {};
    const domainLabels: { [domainLabel: string]: number[] } = {};
    const nonstandard: number[] = [];

    const domainLabelFrequencies: { [domainLabel: string]: number } = {};
    const domainLabelMembers: Array<{ labels: string[]; index: number }> = [];

    for (let index = 0; index < urls.length; index++) {
        const block = urls[index];
        const blockDomainLabels = new Set<string>();
        for (const url of block) {
            const domain = getDomain(url);
            if (isFullyQualifiedDomain(domain)) {
                addLabel(domains, domain, index);
            } else if (isFullyQualifiedDomainWildcard(domain)) {
                const labels = extractDomainLabelsFromFullyQualifiedDomainWildcard(domain);
                domainLabelMembers.push({labels, index});
                labels.forEach((l) => blockDomainLabels.add(l));
            } else {
                
                nonstandard.push(index);
                break;
            }
        }

        
        for (const label of blockDomainLabels) {
            if (domainLabelFrequencies[label]) {
                domainLabelFrequencies[label]++;
            } else {
                domainLabelFrequencies[label] = 1;
            }
        }
    }

    
    for (const {labels, index} of domainLabelMembers) {
        let label = labels[0];
        for (const currLabel of labels) {
            if (domainLabelFrequencies[currLabel] < domainLabelFrequencies[label]) {
                label = currLabel;
            }
        }
        addLabel(domainLabels, label, index);
    }

    return {domains, domainLabels, nonstandard};
}

function processSiteFixesConfigBlock(text: string, offsets: Array<[number, number]>, recordStart: number, recordEnd: number, urls: Array<readonly string[]>) {
    
    const block = text.substring(recordStart, recordEnd);
    const lines = block.split('\n');
    const commandIndices: number[] = [];
    lines.forEach((ln, i) => {
        if (ln.match(/^[A-Z]+(\s[A-Z]+){0,2}$/)) {
            commandIndices.push(i);
        }
    });

    if (commandIndices.length === 0) {
        return;
    }

    offsets.push([recordStart, recordEnd - recordStart]);

    const urls_ = parseArray(lines.slice(0, commandIndices[0]).join('\n'));
    urls.push(urls_);
}

function extractURLsFromSiteFixesConfig(text: string): {urls: string[][]; offsets: Array<[number, number]>} {
    const urls: string[][] = [];
    
    const offsets: Array<[number, number]> = [];

    let recordStart = 0;
    
    const delimiterRegex = /^\s*={2,}\s*$/gm;
    let delimiter: RegExpMatchArray | null;
    while ((delimiter = delimiterRegex.exec(text))) {
        const nextDelimiterStart = delimiter.index!;
        const nextDelimiterEnd = delimiter.index! + delimiter[0].length;
        processSiteFixesConfigBlock(text, offsets, recordStart, nextDelimiterStart, urls);
        recordStart = nextDelimiterEnd;
    }
    processSiteFixesConfigBlock(text, offsets, recordStart, text.length, urls);

    return {urls, offsets};
}

export function indexSitesFixesConfig<T extends SiteProps>(text: string): SitePropsIndex<T> {
    const {urls, offsets} = extractURLsFromSiteFixesConfig(text);
    const {domains, domainLabels, nonstandard} = indexConfigURLs(urls);
    return {offsets: encodeOffsets(offsets), domains, domainLabels, nonstandard, cacheDomainIndex: {}, cacheSiteFix: {}, cacheCleanupTimer: null};
}

function lookupConfigURLsInDomainLabels(domain: string, recordIds: number[], currRecordIds: readonly number[], getAllRecordURLs: (id: number) => readonly string[]) {
    for (const recordId of currRecordIds) {
        const recordURLs = getAllRecordURLs(recordId);
        for (const ruleUrl of recordURLs) {
            const wildcard = getDomain(ruleUrl);
            if (isFullyQualifiedDomainWildcard(wildcard) && fullyQualifiedDomainMatchesWildcard(wildcard, domain)) {
                recordIds.push(recordId);
            } else {
                
            }
        }
    }
}

function lookupConfigURLs(domain: string, index: ConfigIndex, getAllRecordURLs: (id: number) => readonly string[]): number[] {
    const labels = domain.split('.');
    let recordIds: number[] = [];

    
    if (index.domainLabels.hasOwnProperty('*')) {
        recordIds = recordIds.concat(index.domainLabels['*']);
    }

    
    for (const label of labels) {
        
        if (index.domainLabels.hasOwnProperty(label)) {
            const currRecordIds = index.domainLabels[label];
            lookupConfigURLsInDomainLabels(domain, recordIds, currRecordIds, getAllRecordURLs);
        }
    }

    for (let i = 0; i < labels.length; i++) {
        const substring = labels.slice(i).join('.');
        if (index.domains.hasOwnProperty(substring)) {
            recordIds = recordIds.concat(index.domains[substring]);
        }
        if (index.domainLabels.hasOwnProperty(substring)) {
            const currRecordIds = index.domainLabels[substring];
            lookupConfigURLsInDomainLabels(domain, recordIds, currRecordIds, getAllRecordURLs);
        }
    }

    
    
    if (index.nonstandard) {
        for (const currRecordId of index.nonstandard) {
            const urls = getAllRecordURLs(currRecordId);
            if (urls.some((url) => isURLMatched(domain, getDomain(url)))) {
                recordIds.push(currRecordId);
                continue;
            }
        }
    }

    
    recordIds = Array.from(new Set(recordIds));

    return recordIds;
}


function getSiteFix<T extends SiteProps>(text: string, index: SitePropsIndex<T>, options: SitesFixesParserOptions<T>, id: number): Readonly<T> {
    if (index.cacheSiteFix.hasOwnProperty(id)) {
        return index.cacheSiteFix[id];
    }

    const [blockStart, blockEnd] = decodeOffset(index.offsets, id);
    const block = text.substring(blockStart, blockEnd);
    const fix = parseSitesFixesConfig<T>(block, options)[0];
    index.cacheSiteFix[id] = fix;
    return fix;
}


function scheduleCacheCleanup<T extends SiteProps>(index: SitePropsIndex<T>) {
    if (__TEST__) {
        return;
    }
    clearTimeout(index.cacheCleanupTimer);
    index.cacheCleanupTimer = setTimeout(() => {
        index.cacheCleanupTimer = null;
        index.cacheDomainIndex = {};
        index.cacheSiteFix = {};
    }, INDEX_CACHE_CLEANUP_INTERVAL_IN_MS);
}


export function getSitesFixesFor<T extends SiteProps>(url: string, text: string, index: SitePropsIndex<T>, options: SitesFixesParserOptions<T>): Array<Readonly<T>> {
    const records: T[] = [];
    const domain = getDomain(url);

    if (!index.cacheDomainIndex[domain]) {
        index.cacheDomainIndex[domain] = lookupConfigURLs(domain, index, (recordId) => getSiteFix<T>(text, index, options, recordId).url);
    }

    const recordIds = index.cacheDomainIndex[domain];
    for (const recordId of recordIds) {
        const fix = getSiteFix<T>(text, index, options, recordId);
        records.push(fix);
    }

    scheduleCacheCleanup(index);
    return records;
}

export function indexSiteListConfig(text: string): SiteListIndex {
    const urls = parseArray(text);
    const urls2D = urls.map((u) => [u]);
    const {domains, domainLabels, nonstandard} = indexConfigURLs(urls2D);
    return {domains, domainLabels, nonstandard, urls};
}

function getSiteListFor(url: string, index: SiteListIndex): string[] {
    const domain = getDomain(url);
    const recordIds = lookupConfigURLs(domain, index, (recordId) => [index.urls[recordId]]);
    const result: string[] = [];
    for (const recordId of recordIds) {
        result.push(index.urls[recordId]);
    }
    return result;
}

export function isURLInSiteList(url: string, index: SiteListIndex | null): boolean {
    if (index === null) {
        return false;
    }
    const urls = getSiteListFor(url, index);
    return isURLInList(url, urls);
}
