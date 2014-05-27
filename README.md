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

- options `Object`
  - pkg `Object` object of cortex.json
  - root `path` the root directories of packages
  - shrinkWrap `Object` object of cortex-shrinkwrap.json
  - ext `String='.js'` the extension of module files, default to `'.js'`

### .compile(template)

- template `String` template string

Parses the template string and returns the parsed function.

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