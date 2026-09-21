/**
 * dsh-client-ui-miku-theme — node half.
 *
 * The browser half ships through this package's "./client" export; the node
 * half exists only so the DSH Loader has a host-side row to mount. It provides
 * no host service, accepts no configuration, and reads no files.
 *
 * @see README.md for installation and customisation.
 */

/** Host plugin body: this package contributes browser presentation only. */
export function apply() {}
