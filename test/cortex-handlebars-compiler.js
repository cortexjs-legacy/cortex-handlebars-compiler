'use strict';

var expect = require('chai').expect;
var compiler = require('../');
var fs = require('fs');
var jf = require('jsonfile');
var node_path = require('path');

var fixtures = node_path.join(__dirname, 'fixtures');
var cortex_json = node_path.join(fixtures, 'cortex.json');
var shrinkwrap_json = node_path.join(fixtures, 'cortex-shrinkwrap.json');

var pkg = jf.readFileSync(cortex_json);
var shrinkwrap = jf.readFileSync(shrinkwrap_json);

describe("compiler()", function(){
  [
    {
      name: 'single'
    },
    {
      name: 'folder/normal'
    },
    {
      name: 'more'
    },
    {
      name: 'range-not-found',
      throw: true
    },
    {
      name: 'href'
    },
    {
      name: 'href-root',
      href_root: 'efte://efte'
    }
  ].forEach(function (c) {
    var template_file = node_path.join(fixtures, c.name + '.template');
    var template = fs.readFileSync(template_file).toString();

    it(template, function(){
      var cp = compiler({
        pkg: pkg,
        shrinkWrap: shrinkwrap,
        cwd: fixtures,
        path: template_file,
        href_root: c.href_root,
        ext: '.min.js'
      });

      var compiled;
      var error;
      try {
        compiled = cp.compile(template)();
      } catch(e) {
        error = e;
      }

      if (c.throw) {
        expect(error).not.to.equal();
        return;

      } else if (error) {
        throw error;
      }

      var expected_file = node_path.join(fixtures, c.name + '.expected.html');
      var expected = fs.readFileSync(expected_file).toString();
      expect(compiled).to.equal(expected);
      fs.writeFileSync(expected_file, compiled);
    });
  });
});