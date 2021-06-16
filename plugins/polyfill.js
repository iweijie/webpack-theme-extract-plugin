if (!String.prototype.replaceAll) {
  // eslint-disable-next-line no-extend-native
  String.prototype.replaceAll = function (regexp, replacement) {
      if (typeof regexp === "string") {
          regexp = new RegExp(regexp, "gm");
      }
      if (!(regexp instanceof RegExp))
          throw new Error("参数异常, 第一个参数需传入字符串或者正则");

      if (!regexp.flags.includes("g"))
          throw new Error("参数异常, 第一个参数正则需为全局匹配模式");

      if (!regexp.flags.includes("m")) {
          regexp.compile(regexp.source, regexp.flags + "m");
      }
      return this.replace(regexp, replacement);
  };
}
