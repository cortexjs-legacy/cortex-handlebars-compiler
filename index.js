'use strict';

module.exports = compiler;

var handlebars = require('handlebars');
var hashmaps = require('neuron-hashmaps');
var node_path = require('path');

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
        "mod:'" + title + "'",
      '});',
    '</script>'
  ].join('');

  return output;
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
    '});',
    '</script>'
  ].join('');
};


Compiler.prototype._normalize = function(name, version) {
  return node_path.join(this.root, name, version, name + this.ext);
};
