# cortex-handlebars-compiler [![NPM version](https://badge.fury.io/js/cortex-handlebars-compiler.svg)](http://badge.fury.io/js/cortex-handlebars-compiler) [![Build Status](https://travis-ci.org/cortexjs/cortex-handlebars-compiler.svg?branch=master)](https://travis-ci.org/cortexjs/cortex-handlebars-compiler) [![Dependency Status](https://gemnasium.com/cortexjs/cortex-handlebars-compiler.svg)](https://gemnasium.com/cortexjs/cortex-handlebars-compiler)

Handlebar helpers for cortex template.

## Install

```bash
$ npm install cortex-handlebars-compiler --save
```

## Usage

```js
var compiler = require('cortex-handlebars-compiler');
```

## compiler(options)

Returns the `compiler.Compiler` instance.

## Class: compiler.Compiler(options)

A single compiler instance only cares about one template file.

- options `Object`
  - pkg `Object` object of cortex.json
  - shrinkWrap `Object` object of cortex-shrinkwrap.json
  - cwd `path` the root directories of current project.
  - path `path` path of the current template file
  <!-- - built_root `path` the root directories of packages to be built into -->
  - ext `String='.js'` the extension of module files, default to `'.js'`

### .compile(template)

- template `String` template string

Parses the template string and returns `function(data)` the parsed function.

template:
```
<body>
{{{facade 'a@1.0.0'}}}
</body>
```

```js
instance.compile(template)();
```

Then you will get: (which is beautified)

```html
<html>
<head></head>
<body>

<script src="../../../neuron/5.1.0/neuron.min.js"></script>
<script>
neuron.config({
  ranges: {
    "jquery": {
      "~1.9.2": "1.9.2"
    },
    "neuron": {
      "latest": "5.1.0"
    }
  },
  depTree: {
    "cortex-hybrid-sample": {
      "0.1.0": [{
        "jquery": "~1.9.2"
      }, {}]
    }
  },
  path: "../../../"
});
</script>
<script>
facade({
  mod:"cortex-hybrid-sample@0.1.0"
});
</script>
</body>
</html>
```

### .register(helper, handler)

- helper `String` the name of the helper
- handler `function(title, helper_options)` see [handlebars](http://npmjs.org/package/handlebars) for details

Registers a new helper handler.

Returns `this`.

## Built-in helpers

### `{{{facade '<package-name>'}}}`

The first 'facade' will also output the engines and configurations.

## License

MIT
<!-- do not want to make nodeinit to complicated, you can edit this whenever you want. -->