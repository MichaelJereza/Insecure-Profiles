module.exports = (expressHandlebars, config) => {
  return expressHandlebars.create({
    defaultLayout: 'main',
    helpers: {
      'if_eq': function(a, b, opts) {
        if (JSON.stringify(a) == JSON.stringify(b)) {
          return opts.fn(this);
        } else if (a == b) {
          return opts.fn(this);
        } else {
          return opts.inverse(this);
        }
      },
      concat: (...args) => args.slice(0, -1).join(''),
      math: (lvalue, operator, rvalue, options) => {
        lvalue = parseFloat(lvalue);
        rvalue = parseFloat(rvalue);
        return {
          "+": lvalue + rvalue,
          "-": lvalue - rvalue,
          "*": lvalue * rvalue,
          "/": lvalue / rvalue,
          "%": lvalue % rvalue
        }[operator];
      }
    },
    ...config
  });
}
