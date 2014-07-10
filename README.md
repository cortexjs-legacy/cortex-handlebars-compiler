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
  - href_root `url` the url base of the hyper reference, `'efte://efte'` for example.

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
  ranges: tree
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

### `{{{href '<link>'}}}`

Creates a special link to navigate through business units

#### link

Relative links: `./page.html`

External link to other units: `<unit-name>/path/to.html`

```html
<!-- 
  If the current unit is 'foo', 
  and the current template is 'template/a.html'
-->
<a href="{{{href './b.html'}}}" >link</a>
<a href="{{{href 'bar/folder/index.html'}}}">external link</a>
```

You will get:

```html
<a href="efte://efte/foo/template/a.html">link</a>
<a href="efte://efte/bar/folder/index.html">external link</a>
```

## License

MIT