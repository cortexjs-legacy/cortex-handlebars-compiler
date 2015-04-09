'use strict';

module.exports = compiler;

var handlebars = require('handlebars');
var node_path = require('path');
var semver = require('semver');
var pkg = require('neuron-pkg');
var node_url = require('url');

function compiler (options) {
  return new Compiler(options || {});
}

// @param {Object} options basic information of the template, not userdata.
// Including:
// - information of the template
// - global configurations of the environment
// Properties:
// - pkg `Object` object of cortex.json
// - shrinkWrap `Object` object of cortex-shrinkwrap.json
// - cwd `path` the root directories of current project.
// - path `path` path of the current template file
// X - built_root `path` the root directories of packages to be built into
// X - js_ext `String='.js'` the extension of module files, default to `'.js'`
// X - css_ext
function Compiler (options) {
  this.facade_counter = 0;

  this._check_option(options, 'pkg');
  this._check_option(options, 'cwd');
  this._check_option(options, 'path');
  this._check_option(options, 'graph');
  this._check_option(options, 'shrinkwrap');

  this.ext = {
    js: '.js',
    css: '.css'
  };

  this.href_root = options.href_root;
  this.hosts = options.hosts;
  this.mod_root = options.mod_root;
  this.template_dir = options.template_dir;
  this.html_root = options.html_root;
  this.hash_host = options.hash_host === false ? false : true;

  // for compatibility of old pattern
  this.mod_root = this.mod_root.replace('/' + this.pkg.name + "/" + this.pkg.version, "");

  if (this.href_root) {
    this.href_root = this.href_root.replace(/\/+$/, '');
  }

  this.cwd = node_path.resolve(this.cwd);
  this.path = node_path.resolve(this.cwd, this.path);

  // built_root/
  //          |-- <name>
  //                  |-- <version>
  //                              |-- dir/to/template
  //                                                |-- <path.basename>
  // ------------------------------------------------------------------
  //                              |      to_cwd     |
  this.dir = node_path.dirname(this.path);
  var to_cwd = node_path.relative(this.dir, this.cwd);
  this.relative_cwd = node_path.join('..', '..', to_cwd);
  this.helpers = {};
  this.register('facade', this._facade_handler, this);
  this.register('href', this._href_handler, this);
  this.register('static', this._static_handler, this);
  this.register('modfile', this._modfile_handler, this);
}


Compiler.prototype._check_option = function(options, key, message) {
  if (!message) {
    message = '`options.' + key + '` must be specified';
  }
  if (!options[key]) {
    throw new Error(message);
  }
  this[key] = options[key];
};


// Register a custom helper
// @param {String} helper
// @param {function(title, options)} handler
// - title
// - options
Compiler.prototype.register = function(helper, handler, context) {
  if (context) {
    handler = handler.bind(context);
  }
  this.helpers[helper] = handler;
  return this;
};


// Comple the template
Compiler.prototype.compile = function(template) {
  // `handlebars` is a singleton,
  // we need to override helpers whenever we execute `handlebars.compile`
  Object.keys(this.helpers).forEach(function (helper) {
    var handler = this.helpers[helper];
    handlebars.registerHelper(helper, handler);
  }, this);

  return handlebars.compile(template);
};

Compiler.prototype._retrieve_all_versions = function(){
  var versions_cache = {};
  function digdeps(k, node){
    if(!versions_cache[k]){
      versions_cache[k] = [node.version];
    }else{
      if(versions_cache[k].indexOf(node.version) == -1){
        versions_cache[k].push(node.version);
      }
    }

    var deps = node.dependencies;
    if(deps){
      for(var name in deps){
        digdeps(name, deps[name]);
      }
    }
  }


  if(this._versions_cache){
    return this._versions_cache;
  }else{
    digdeps(this.shrinkwrap.name, this.shrinkwrap);
    this._versions_cache = versions_cache;
    return versions_cache;
  }
}

Compiler.prototype._modfile_handler = function(title, options) {
  var versions = this._retrieve_all_versions();
  var obj = pkg(title);
  var name = obj.name;
  var range = obj.range || '*';
  var path = obj.path;
  var version = semver.maxSatisfying(versions[name], range);

  if(path == ''){
    path = name + '.js';
  }
  if(path.indexOf('/') == 0){
    path = path.slice(1);
  }
  var base = this.hosts ? this.mod_root : this._resolve_path(this.relative_cwd, this.hash_host);

  path = node_path.join(base , name, version, path).replace(/\\/g,'/');
  return this._resolve_path(path);
};

Compiler.prototype._facade_handler = function(title, options) {
  var output = '';
  if (this.facade_counter ++ === 0) {
    output += this._neuron_framework();
  }

  output += [
    '<script>',
      'facade({',
        'entry:"' + this._facade_mod(title) + '"',
      '});',
    '</script>'
  ].join('');

  return output;
};


// a.html
// {{href ./b.html}}
// {{href b/b.html}}
Compiler.prototype._href_handler = function(title, options) {
  var link = title;
  if (!link) {
    throw new Error('invalid argument for helper `href`.');
  }

  // './b.html'
  // normal -> './b.html'
  // hybrid -> 'protocol://efte/<name>/<relative>/b.html'
  if (this.href_root) {
    link = this._hybrid_href(title);
  }

  return link;
};

Compiler.prototype._resolve_path = function(path, hash){
  var root, hosts, host, absolute_path;
  var html_filepath, origin_html_path;

  hosts = this.hosts;
  if(this.template_dir){
    // new logic with template_dir
    root = node_path.join(this.mod_root, this.pkg.name, this.pkg.version).replace(/\\/g,'/');
    html_filepath = node_path.relative(this.template_dir, this.path);
    root = node_path.join(root, html_filepath);
  }else{
    // old dirty logic for compatibility
    root = this.mod_root + '/' + this.pkg.name + '/' + this.pkg.version + this.html_root;
  }



  if(this._is_absolute(path)){
    absolute_path = path;
  }else{
    absolute_path = node_path.join(root, path);
  }

  if(root && hosts){
    if(this.hash_host){
      host = hosts[absolute_path.length % hosts.length];
    }else{
      host = hosts[0];
    }
    if (hash) {
      var frag = host.split(".");
      frag[0] = frag[0].replace(/\d/, "{n}");
      host = frag.join(".");
    }
    path = "//" + host + absolute_path;
  }else{
    path = path;
  }

  return this._to_url_path(path);
}

Compiler.prototype._is_absolute = function(title){
  return title.indexOf("/") == 0;
};

Compiler.prototype._static_handler = function(title, options) {
  var ext = node_path.extname(title);
  var dir = node_path.dirname(title);
  var base = node_path.basename(title, ext);

  var ext_name = ext.replace(/^\./, '');
  var changed_ext = this.ext[ext_name] || ext;
  var url_path;
  if(this._is_absolute(title)){
    url_path = title;
  }else{
    url_path = dir + '/' + base + changed_ext;
  }
  return this._resolve_path(url_path);
};


Compiler.prototype._is_relative = function(path) {
  return path === '.'
    || path.indexOf('./') === 0
    || this._is_parent_path(path);
};


Compiler.prototype._is_parent_path = function(path) {
  return path === '..'
    || path.indexOf('../') === 0;
};


// TODO: -> config
Compiler.prototype._hybrid_href = function(title) {
  // 'b/b.html' -> 'efte://efte/b/b.html'
  if (!this._is_relative(title)) {
    return this.href_root + '/' + title;
  }

  var link_to = node_path.join(this.dir, title);
  var link_relative = node_path.relative(this.cwd, link_to);
  // dir: 'template/'
  // title: '../../b.html'
  // -> allow to use a resource outside current repo? NO!
  // Then:
  // title: '../template/../../b.html' ? NO!
  if (this._is_parent_path(link_relative)) {
    throw new Error('You should never link to a resource outside current project.');
  }

  var name = this.pkg.name;
  return [this.href_root, name, link_relative].join('/');
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
  var ext = obj.path
    ? '.js'
    : '';

  // if the facade uses the current package, force the version
  if (obj.name === name) {
    obj.version = version;
  }

  if (obj.version) {
    return pkg.format(obj) + ext;
  }

  // 'a' -> 'a@*'
  obj.range = obj.range || '*';

  var is_range_valid = semver.validRange(obj.range) || obj.range === '*';

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

  return pkg.format(obj) + ext;
};


Compiler.prototype._neuron_framework = function() {
  return this._output_engines() + this._neuron_config();
};


Compiler.prototype._get_engines = function() {
  var engines = [];
  var es = this.shrinkwrap.engines || {};
  Object.keys(es).forEach(function (name) {
    engines.push({
      name: name,
      version: es[name].version
    });
  });

  return engines;
};


Compiler.prototype._output_engines = function() {
  var self = this;

  return this._get_engines().map(function (engine) {
    var src = self._normalize(engine.name, engine.version);
    return '<script src="' + src + '"></script>';
  })
  .join('');
};

Compiler.prototype._to_url_path = function(path){
  return path.replace(/\\/g,'\/');
}

Compiler.prototype._neuron_config = function() {
  return '' + [
    '<script>',
    'neuron.config({',
      'graph:' + JSON.stringify(this.graph) + ',',
      'path:"' + this._resolve_path(this.relative_cwd, this.hash_host) + '"',
    '});',
    '</script>'
  ].join('');
};


Compiler.prototype._normalize = function(name, version) {
  var path = node_path.join(this.relative_cwd, name, version, name + this.ext.js)
  return this._resolve_path(path);
};
