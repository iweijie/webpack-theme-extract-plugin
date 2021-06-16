require("./polyfill");

const { resolve } = require("path");
const { getOptions } = require("loader-utils");

const isEnvProduction = process.env.NODE_ENV === "production";
const transform = (source, url) => {
    return `@import url(${url});\n ${source}`;
};

const loader = function (source) {
    const options = getOptions(this) || {};
    const { path, current } = options;
    if (!path) return this.callback(null, source);

    try {
        let tempPath;
        if (isEnvProduction) {
            tempPath = resolve(path, "./__temp.less");
        } else {
            tempPath = resolve(path, `./${current}.less`);
        }
        return this.callback(null, transform(source, tempPath));
    } catch (err) {
        return this.callback(null, source);
    }
};

module.exports = loader;
