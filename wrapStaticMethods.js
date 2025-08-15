function wrapStaticMethods(ModelClass) {
    const methodNames = Object.getOwnPropertyNames(ModelClass)
        .filter(
            name =>
                typeof ModelClass[name] === 'function' &&
                name !== 'length' &&
                name !== 'name' &&
                name !== 'prototype'
        );

    for (const name of methodNames) {
        const original = ModelClass[name];

        ModelClass[name] = async function (...args) {
            try {
                return await original.apply(this, args);
            } catch (err) {
                console.error(`❌ Error in ${ModelClass.name}.${name}()`, err);
            }
        };
    }

    return ModelClass;
}

module.exports = wrapStaticMethods;