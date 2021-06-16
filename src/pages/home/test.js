import csstree from "css-tree";

const str = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace
}

@media screen and (min-width: 900px) {
  .test .index_title__Gxhev {
      color: css-33704586489999344;
  }
}
.index_title__1bKxv {
  color: css-33704586489999344;
  background-color: css-8990485172571281
}

.test .index_title__Gxhev {
  color: css-8990485172571281;
  background-color: css-33704586489999344
}

/*# sourceMappingURL=main.1ec53e2e.chunk.css.map */`;

const tree = csstree.parse(str, {
    parseRulePrelude: false,
    parseValue: false,
    onParseError(error) {
        console.log(error.formattedMessage);
    },
});

window.tree = tree;

const ident = "css-33704586489999344";

const pathList = [];
const removeList = [];
const extractCssMap = new Map();

function extractCssRules() {
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
csstree.walk(tree, {
    enter: function (node, item, list) {
        pathList.push(node);
        console.log(node);
        console.log(item);
        console.log(list);
        if (
            node.type === "Declaration" &&
            node.value &&
            node.value.value === ident &&
            list
        ) {
            extractCssRules();
        }
    },
    leave(node, item, list) {
        pathList.pop();
        if (
            node.type === "Declaration" &&
            node.value &&
            node.value.value === ident &&
            list
        ) {
            list.remove(item);
        }
    },
});

function extract() {
    const rules = [];
    for (const [key, value] of extractCssMap) {
        if (key.type === "Atrule" && key.name === "media") {
            rules.push(extractMediaRule(key, value));
        } else if (key.type === "Rule") {
            rules.push(extractRule(key, value));
        }
    }

    return rules.join("");
}

function extractRule(key, value) {
    const selector = key.prelude.value;
    const rules = value.map((node) => {
        return `${node.property}:${node.value.value}`;
    });
    return `${selector}{${rules.join(";")}}`;
}
function extractMediaRule(key, value) {
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
        return extractRule(item[0], [item[1]]);
    });

    return `${media}{${rules.join("")}}`;
}
console.log(extract());

console.log(csstree.generate(tree));
