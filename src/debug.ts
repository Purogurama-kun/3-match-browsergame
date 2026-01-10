const DEBUG_VALUES = ['1', 'true'];
const LOCAL_DEBUG_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '192.168.178.30']);

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
    return queryValue !== null && DEBUG_VALUES.includes(queryValue.toLowerCase());
})();

function isDebugMode(): boolean {
    return DEBUG_ENABLED;
}

export { isDebugMode, isLocalDebugHost };
