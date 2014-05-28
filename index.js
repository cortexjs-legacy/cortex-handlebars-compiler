'use strict';

module.exports = compiler;

var handlebars = require('handlebars');
var hashmaps = require('neuron-hashmaps');
var node_path = require('path');
var semver = require('semver');
var pkg = require('neuron-pkg');

function compiler (options) {
  return new Compiler(options);
}

// @param {Object} options
// - shrinkWrap {Object}
// - pkg {Object}
// - root {path} root directory of packages
function Compiler (options) {
  this.facade_counter = 0;
  this.neuron_hashmaps = hashmaps(options.shrinkWrap);
  this.pkg = options.pkg;
  this.root = options.root;
  this.ext = options.ext || '.js';

  this.register('facade', function (title, helper_options) {
    return this._facade_handler(title, helper_options);

  }.bind(this));
}


// Register a custom helper
// @param {String} helper
// @param {function(title, options)} handler
// - title
// - options
Compiler.prototype.register = function(helper, handler) {
  handlebars.registerHelper(helper, handler);
  return this;
};


// Comple the template
Compiler.prototype.compile = function(template) {
  return handlebars.compile(template);
};


Compiler.prototype._facade_handler = function(title, options) {
  var output = '';
  if (this.facade_counter ++ === 0) {
    output += this._neuron_framework();
  }

  output += [
    '<script>',
      'facade({',
        "mod:'" + this._facade_mod(title) + "'",
      '});',
    '</script>'
  ].join('');

  return output;
};


// Suppose current package:
// name: foo
// version: 0.2.0
// Then,
// 1.
// facade(foo) -> facade(foo@0.2.0)
// 2.
// facade() -> facade(foo@0.2.0)
// 3.
// facade(foo/abc) -> facade(foo@0.2.0/abc)
// 4.
// facade(foo@1.2.3) -> check if 1.2.3 exists in current shrinkwrap, otherwise -> throw
Compiler.prototype._facade_mod = function(title) {
  var name = this.pkg.name;
  var version = this.pkg.version;

  // facade() -> current package
  if (!title || Object(title) === title) {
    return pkg.format({
      name: name,
      version: version
    });
  }

  var obj = pkg(title);

  // if the facade uses the current package, force the version
  if (obj.name === name) {
    obj.version = version;
  }

  if (obj.version) {
    return pkg.format(obj);
  }

  // 'a' -> 'a@latest'
  obj.range = obj.range || 'latest';

  var is_range_valid = semver.validRange(obj.range) || range === 'latest';

  var facade_pkg = pkg.format({
    name: obj.name,
    range: obj.range
  });

  if (!is_range_valid) {
    throw new Error(
      'Facade: invalid version "' + facade_pkg + '", make sure you have install it.\n' +
      'Or you might as well specify the explicit version of "' + facade_name + '".'
    );
  }

  // parse ranges
  obj.version = this._parse_range(obj.name, obj.range);
  if (!obj.version) {
    throw new Error('Facade: invalid range "' + facade_pkg + '", make sure your have `cortex install --save` it.');
  }

  return pkg.format(obj);
};


Compiler.prototype._parse_range = function(name, range) {
  var ranges = this.neuron_hashmaps.ranges;
  return ranges[name] && ranges[name][range];
};


Compiler.prototype._neuron_framework = function() {
  return this._output_engines() + this._neuron_config();
};


Compiler.prototype._output_engines = function() {
  var self = this;
  return this.neuron_hashmaps
  .engines(this.pkg.name, this.pkg.version)
  .map(function (engine) {
    var src = self._normalize(engine.name, engine.version);
    return '<script src="' + src + '"></script>';
  })
  .join('');
};


Compiler.prototype._neuron_config = function() {
  return '' + [
    '<script>',
    'neuron.config({',
      'ranges:'  + JSON.stringify(this.neuron_hashmaps.ranges) + ',',
      'depTree:' + JSON.stringify(this.neuron_hashmaps.depTree) + ',',
      'path:"' + this.root + '"',
    '});',
    '</script>'
  ].join('');
};


Compiler.prototype._normalize = function(name, version) {
  return node_path.join(this.root, name, version, name + this.ext);
};
