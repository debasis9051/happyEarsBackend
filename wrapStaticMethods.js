/**
 * wrapStaticMethods — Model error-boundary decorator.
 *
 * Wraps every static method on a Model class so that:
 *   1. Errors are always logged with the class and method name for easier debugging.
 *   2. The error is re-thrown so calling code (controllers) can catch it and return
 *      a proper HTTP 500 response rather than silently receiving `undefined`.
 *
 * Usage:
 *   class MyModel { static async doThing() { ... } }
 *   module.exports = wrapStaticMethods(MyModel);
 */
function wrapStaticMethods(ModelClass) {
    // Collect all static methods (skip the built-in non-callable descriptors)
    const methodNames = Object.getOwnPropertyNames(ModelClass)
        .filter(
            name =>
                typeof ModelClass[name] === 'function' &&
                name !== 'length' &&
                name !== 'name' &&
                name !== 'prototype' &&
                !name.startsWith('_')
        );

    for (const name of methodNames) {
        const original = ModelClass[name];

        // Replace each method with a wrapper that logs + re-throws on error
        ModelClass[name] = async function (...args) {
            try {
                return await original.apply(this, args);
            } catch (err) {
                console.error(`❌ Error in ${ModelClass.name}.${name}()`, err);
                throw err;
            }
        };
    }

    return ModelClass;
}

module.exports = wrapStaticMethods;