require("./polyfill");

const hashjs = require("xxhashjs");
const csstree = require("css-tree");
const fs = require("fs");
const { join, resolve } = require("path");

const isCss = (url) => /^.+\.css$/.test(url);
const isLess = (url) => /^.+\.less$/.test(url);
const isHtml = (url) => /^.+\.html$/.test(url);

const getIdent = (prefix = "") => {
    return prefix + Math.random().toString().slice(2);
};

const parseVariable = (str) => {
    // @themeBg: hsl(0, 0%, 100%);
    const iterator = str.matchAll(/@(.+?):(.+);/g);
    const obj = new Map();
    for (let v of iterator) {
        if (v) {
            let [, name, value] = v;
            name = name.trim();
            value = value.trim();
            obj.set(name, value);
        }
    }
    return obj;
};

const transformTemp = (str) => {
    return str.replaceAll(/@(.+?):(.+);/g, (source, name, value) => {
        return `@${name}:${getIdent("css-")};`;
    });
};

const getPublicPath = (compiler) => {
    const publicPath = compiler.options.output.publicPath || "/";
    if (/^.+\/$/.test(publicPath)) return publicPath;
    return `${publicPath}/`;
};

// 解析使用

let pathList = [];
let extractCssMap = new Map();

class ThemeExtractPlugin {
    constructor({ path, current }) {
        this.path = path;
        this.current = current;
        this.currentTheme = {};
        this.themes = [];
    }

    getCurrent() {
        const files = fs.readdirSync(this.path);
        for (var i = 0; i < files.length; i++) {
            const name = this.getThemeName(files[i]);
            if (name === this.current) {
                const data = fs.readFileSync(join(this.path, name), {
                    encoding: "utf-8",
                });
                return parseVariable(data);
            }
        }
        return new Map();
    }

    getThemes() {
        const files = fs.readdirSync(this.path);
        for (var i = 0; i < files.length; i++) {
            const name = files[i];
            if ("__temp.less" === name) continue;
            const data = fs.readFileSync(join(this.path, name), {
                encoding: "utf-8",
            });

            this.themes.push({
                name: this.getThemeName(name),
                value: parseVariable(data),
            });
        }
    }
    getThemeName(name) {
        if (isLess(name)) {
            const [, title] = name.match(/(.+?)\.less/);
            return title;
        }
    }

    handleExtract() {
        const rules = [];
        for (const [key, value] of extractCssMap) {
            if (key.type === "Atrule" && key.name === "media") {
                rules.push(this.extractMediaRule(key, value));
            } else if (key.type === "Rule") {
                rules.push(this.extractRule(key, value));
            }
        }

        return rules.join("");
    }

    extractRule(key, value) {
        const selector = key.prelude.value;
        const rules = value.map((node) => {
            return `${node.property}:${node.value.value}`;
        });
        return `${selector}{${rules.join(";")}}`;
    }

    extractMediaRule(key, value) {
        let media = "@media ";
        csstree.walk(key, function (node) {
            if (node.type === "Identifier") {
                media += node.name;
            } else if (node.type === "WhiteSpace") {
                media += node.value;
            } else if (node.type === "MediaFeature") {
                const value = node.value;
                media += `(${node.name}:${value.value}${value.unit})`;
            } else if (node.type === "Dimension") {
                return this.break;
            }
        });
        const rules = value.map((item) => {
            return this.extractRule(item[0], [item[1]]);
        });

        return `${media}{${rules.join("")}}`;
    }

    extractCssRules() {
        let key,
            value = pathList[pathList.length - 1];
        for (let i = pathList.length - 2; i >= 0; i--) {
            const node = pathList[i];
            if (node.type === "Rule") {
                key = node;
            } else if (node.type === "Atrule" && node.name === "media") {
                value = [key, value];
                key = node;
            }
        }

        if (extractCssMap.has(key)) {
            extractCssMap.get(key).push(value);
        } else {
            extractCssMap.set(key, [value]);
        }
    }

    extract(content, idents) {
        // const str = `
        // /*# sourceMappingURL=main.1ec53e2e.chunk.css.map */`;
        pathList = [];
        extractCssMap = new Map();

        const tree = csstree.parse(content, {
            parseRulePrelude: false,
            parseValue: false,
            onParseError(error) {
                console.log(error.formattedMessage);
            },
        });

        csstree.walk(tree, {
            enter: (node, item, list) => {
                pathList.push(node);
                if (
                    node.type === "Declaration" &&
                    node.value &&
                    idents.has(node.value.value) &&
                    list
                ) {
                    this.extractCssRules();
                }
            },
            leave(node, item, list) {
                pathList.pop();
                if (
                    node.type === "Declaration" &&
                    node.value &&
                    idents.has(node.value.value) &&
                    list
                ) {
                    list.remove(item);
                }
            },
        });

        return {
            extractCss: this.handleExtract(),
            css: csstree.generate(tree),
        };
    }

    parseTemp(data) {
        const obj = new Map();
        const idents = parseVariable(data);
        for (let v of idents.values()) {
            obj.set(v, true);
        }
        return obj;
    }

    apply(compiler) {
        compiler.hooks.beforeRun.tap("ThemeExtract", (compilation) => {
            const data = fs.readFileSync(`${this.path}\\${this.current}.less`, {
                encoding: "utf-8",
            });

            if (!data) return;

            const tData = transformTemp(data);
            const tempPath = resolve(this.path, "./__temp.less");

            fs.writeFileSync(tempPath, tData);
        });

        compiler.hooks.emit.tapAsync(
            "ThemeExtract",
            (compilation, callback) => {
                const publicPath = getPublicPath(compiler);
                this.getThemes();
                const tempPath = resolve(this.path, "./__temp.less");
                const current = this.themes.find(
                    (item) => item.name === this.current
                );
                if (!current) return callback();
                const data = fs.readFileSync(tempPath, {
                    encoding: "utf-8",
                });
                if (!data) return callback();

                const identsMap = parseVariable(data);
                const identValues = this.parseTemp(data);
                const themes = [];
                const themesInfo = [];
                Object.keys(compilation.assets).forEach((key) => {
                    if (isCss(key)) {
                        // TODO source Map 不造咋弄，待定
                        const content = compilation.assets[key].source();
                        const { extractCss, css } = this.extract(
                            content,
                            identValues
                        );
                        themes.push(extractCss);
                        compilation.assets[key] = {
                            source: () => css,
                            size: () => css.length,
                        };
                    }
                });

                const themeStr = themes.join("");

                this.themes.forEach((item) => {
                    const { name, value } = item;
                    let theme = themeStr;
                    for (let [key, val] of value) {
                        const ident = identsMap.get(key);
                        if (!ident) continue;
                        theme = theme.replaceAll(ident, val);
                    }
                    const hash = hashjs
                        .h64(0xabcd)
                        .update(theme)
                        .digest()
                        .toString(16);

                    const hashName = `${name}_${hash}.css`;

                    themesInfo.push({
                        type: name,
                        hash,
                        hashName,
                        path: `${publicPath}themes/${hashName}`,
                    });
                    compilation.assets[`themes/${hashName}`] = {
                        source: () => theme,
                        size: () => theme.length,
                    };
                });

                const htmlEntry = Object.keys(compilation.assets).find(
                    (key) => {
                        return isHtml(key);
                    }
                );

                if (htmlEntry) {
                    let htmlContent = compilation.assets[htmlEntry].source();
                    console.log(htmlContent);

                    let index = htmlContent.indexOf("</head>");

                    if (index === -1) {
                        index = htmlContent.indexOf("<body>");
                    }
                    if (index === -1) throw new Error("难");

                    const data = themesInfo.find(
                        (data) => data.type === current.name
                    );
                    htmlContent =
                        htmlContent.slice(0, index) +
                        `<link id="_theme" data-theme="${data.type}" href="${data.path}" rel="stylesheet" />` +
                        `<script>window._THEMES = ${JSON.stringify(
                            themesInfo
                        )}</script>` +
                        htmlContent.slice(index);

                    compilation.assets[htmlEntry] = {
                        source: () => htmlContent,
                        size: () => htmlContent.length,
                    };
                }

                fs.rm(tempPath, { force: true }, () => {
                    callback();
                });
            }
        );
    }
}

ThemeExtractPlugin.loader = require.resolve("./themeExtractLoader");
module.exports = ThemeExtractPlugin;
