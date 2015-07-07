'use strict';

module.exports = compiler;

var handlebars = require('handlebars');
var node_path = require('path');
var semver = require('semver');
var pkg = require('neuron-pkg');
var node_url = require('url');
var fs = require('fs');
var moment = require('moment');

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
// - built_root `path` the root directories of packages to be built into
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

  this.built_root = node_path.join(this.cwd, process.env.CORTEX_DEST || 'neurons');
  this.facades = options.facades;
  this.href_root = options.href_root;
  this.hosts = options.hosts;
  this.mod_root = options.mod_root;
  this.template_dir = options.template_dir;
  this.html_root = options.html_root;
  this.hash_host = options.hash_host === false ? false : true;
  this.versions = this._retrieve_all_versions();
  this.enable_md5 = !!process.env.CORTEX_HANDLEBAR_COMPILER_ENABLE_MD5 || false;

  if(!this.facades || !this.facades.length){
    this.facades = [this.pkg.name];
  }
  /**
   * {
   *   "a@0.1.0":{
   *     "a.js": "a9e2d1b6",
   *     "b.js": "d1b6a9e2"
   *   }
   * }
   */
  this.neuron_hash = this._retrieve_hashes();
  /**
   * {
   *   "mod/a/0.1.0/a.js": "a9e2d1b6"
   *   "mod/a/0.1.0/b.js": "d1b6a9e2"
   * }
   */
  this.file_hash = this._parse_file_hash(this.neuron_hash);

  // for compatibility of old pattern
  this.mod_root = this.mod_root.replace('/' + this.pkg.name + "/" + this.pkg.version, "");
  this.root = this._resolve_root();
  this.is_new_logic = !!this.template_dir || false;

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
  this.register('timestamp', this._timestamp_handler, this);
  this.register('combo', this._combo_handler, this);
  this.register('timestr', this._timestr_handler, this);
  this.register('version', this._version_handler, this);
}

Compiler.prototype._combo_handler = function(title, options){
  if(!title){return '';}
  var self = this;
  var mods = title.split(",");
  var base = "/concat/";

  var paths = [];
  mods.filter(function(mod){
    return mod;
  }).forEach(function(mod){
    var path;
    if(mod.indexOf('.') == 0){
      path = self._static_path(mod);
      path = self._to_absolute_path(path);
    }else{
      path = self._mod_file_path(mod);
    }
    paths.push(path);
  });

  var final_path = base + paths.map(function(path){
    return path.replace(/\//g,"~");
  }).join(",");
  return self._resolve_path(final_path);
};


Compiler.prototype._version_handler = function(title, options){
    return (this.pkg&&this.pkg.version) || "";
};

Compiler.prototype._timestamp_handler = function(){
  return +new Date;
};

Compiler.prototype._timestr_handler = function(){
  var now = new Date();
  return moment().format('YYYY-MM-DD HH:mm:ss');
};

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

/**
 * neuron_hash format -> file_hash format
 */
Compiler.prototype._parse_file_hash = function(neuron_hash){
  if(!neuron_hash){
    return null;
  }

  var file_hash = {};
  for(var facade in neuron_hash){
    var facade_hash_list = neuron_hash[facade];
    for(var file in facade_hash_list){
      var file_path = node_path.join(this.mod_root, facade.replace("@","/"), file);
      file_hash[file_path] = facade_hash_list[file];
    }
  }
  return file_hash;
}

/**
 * retrieve all versions from this.shrinkwrap
 */
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

/**
 * {{{modfile '<modname>[@<modversion>]/<filepath>'}}}
 */
Compiler.prototype._mod_file_path = function(title) {
  var versions = this.versions;
  var obj = pkg(title);
  var name = obj.name;
  var range = obj.range || '*';
  var path = obj.path;
  if(!versions[name]){
    throw new Error("Module \"" + name + "\" not found, please install first.");
  }

  var version = semver.maxSatisfying(versions[name], range);
  if(!version){
    throw new Error("Valid version not found for module " + name + "@" + range);
  }

  if(path == ''){
    path = name + '.js';
  }
  if(path.indexOf('/') == 0){
    path = path.slice(1);
  }
  var base = this.hosts ? this.mod_root : this._resolve_path(this.relative_cwd);

  return node_path.join(base , name, version, path).replace(/\\/g,'/');
};

Compiler.prototype._modfile_handler = function(title, options){

  var path = this._mod_file_path(title);
  return this._resolve_path(path);
}

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

/**
 * mod/<name>/<version>/<file>.<ext>
 * ->
 * mod/<name>/<version>/<file>_<md5>.<ext>
 */
Compiler.prototype._append_md5_to_absolute_path = function(absolute_path){
  var file_hash = this.file_hash;
  var hash = file_hash && file_hash[absolute_path];

  if(!hash || !this.enable_md5){
    return absolute_path;
  }else{
    var ext = node_path.extname(absolute_path);
    var base = absolute_path.split(ext)[0];
    return base + "_" + hash + ext;
  }
};

Compiler.prototype._resolve_root = function(){
  var html_filepath;
  if(this.template_dir){
    root = node_path.join(this.mod_root, this.pkg.name, this.pkg.version).replace(/\\/g,'/');
    html_filepath = node_path.relative(this.template_dir, this.path);
    root = node_path.join(root, html_filepath);
  }else{
    // old dirty logic for compatibility
    root = this.mod_root + '/' + this.pkg.name + '/' + this.pkg.version + this.html_root;
  }

  return root;
}

Compiler.prototype._to_absolute_path = function(path){
  var absolute_path;
  if(this._is_absolute(path)){
    absolute_path = path;
  }else{
    absolute_path = node_path.join(root, path);
  }

  if(this.is_new_logic){
    absolute_path = this._append_md5_to_absolute_path(absolute_path);
  }

  return absolute_path;
};

Compiler.prototype._get_host = function(path, hash){
  var host;
  var hosts = this.hosts;
  if(hash){
    host = hosts[path.length % hosts.length];
  }else{
    host = hosts[0];
  }
  if (hash) {
    var frag = host.split(".");
    frag[0] = frag[0].replace(/\d/, "{n}");
    host = frag.join(".");
  }
  return host;
}

Compiler.prototype._resolve_path = function(path, hash_host){
  var absolute_path = this._to_absolute_path(path);
  if(this.root && this.hosts){
    path = "//" + this._get_host(absolute_path, hash_host) + absolute_path;
  }
  return this._to_url_path(path);
}

Compiler.prototype._is_absolute = function(title){
  return title.indexOf("/") == 0;
};

Compiler.prototype._static_handler = function(title, options) {
  var url_path = this._static_path(title);
  return this._resolve_path(url_path);
};

Compiler.prototype._static_path = function(title){
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
  return url_path;
}


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

Compiler.prototype._retrieve_hashes = function(){
  var facades = this.facades;
  var built_root = this.built_root;
  var hash = {};
  var versions = this.versions;

  if(!facades){
    return null;
  }

  facades.forEach(function(facade){
    var mod = facade.split("/")[0];
    var name = mod.split("@")[0];
    var range = mod.split("@")[1] || "*";
    var version = semver.maxSatisfying(versions[name], range);
    var id = mod+"@"+version;
    if(!version){
      throw new Error("No verify version found for " + name + "@" + range);
    }
    if(!hash[id]){
      var path = node_path.join(built_root,name,version,'md5.json');
      var exists = fs.existsSync(path);
      if(exists){
        var content = fs.readFileSync(path);
        var json;
        try{
          json = JSON.parse(content);
        }catch(e){}
        if(json){
          hash[id] = json;
        }
      }
    }
  });

  if(Object.keys(hash).length){
    return hash;
  }else{
    return null;
  }
}

Compiler.prototype._neuron_config = function() {
  var config = {};
  config.graph = this.graph;
  config.path = this._resolve_path(this.relative_cwd, true);

  var hash = this.neuron_hash;

  if(hash && this.enable_md5){
    config.hash = hash;
  }
  return '' + [
    '<script>',
    'neuron.config(' + JSON.stringify(config) + ');',
    '</script>'
  ].join('');
};


Compiler.prototype._normalize = function(name, version) {
  var path = node_path.join(this.relative_cwd, name, version, name + this.ext.js)
  return this._resolve_path(path);
};
