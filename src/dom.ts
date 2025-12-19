function getRequiredElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error('Missing element: ' + id);
    }
    return element;
}

export { getRequiredElement };
