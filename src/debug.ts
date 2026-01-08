const STORAGE_KEY = 'match3-debug-mode';
const DEBUG_VALUES = ['1', 'true'];
const LOCAL_DEBUG_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isLocalDebugHost(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return LOCAL_DEBUG_HOSTS.has(window.location.hostname);
}

const DEBUG_ENABLED = (() => {
    if (!isLocalDebugHost()) {
        return false;
    }
    if (typeof window === 'undefined') {
        return false;
    }
    const queryValue = new URL(window.location.href).searchParams.get('debug');
    if (queryValue !== null) {
        const normalized = queryValue.toLowerCase();
        const enabled = DEBUG_VALUES.includes(normalized);
        if (enabled) {
            window.localStorage.setItem(STORAGE_KEY, 'true');
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        return enabled;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored !== null && DEBUG_VALUES.includes(stored.toLowerCase());
})();

function isDebugMode(): boolean {
    return DEBUG_ENABLED;
}

export { isDebugMode, isLocalDebugHost };
