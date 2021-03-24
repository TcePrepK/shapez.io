/**
 * Generates a cachebuster string. This only modifies the path in the browser version
 * @param {string} path
 */
export function cachebust(path) {
    if (G_IS_BROWSER && !G_IS_STANDALONE && !G_IS_DEV) {
        return "/shapez/CCT/" + path;
    }
    return path;
}
