function getRequiredElement<T extends Element>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error('Missing element: ' + id);
    }
    return element as unknown as T;
}

export { getRequiredElement };
