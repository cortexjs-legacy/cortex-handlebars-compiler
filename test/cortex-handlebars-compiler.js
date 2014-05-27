'use strict';

var expect = require('chai').expect;
var compiler = require('../');
var fs = require('fs');
var jf = require('jsonfile');
var node_path = require('path');

var template = '<html><head></head><body>{{{facade "cortex-hybrid-sample"}}}</body></html>';
var fixtures = node_path.join(__dirname, 'fixtures');
var cortex_json = node_path.join(fixtures, 'cortex.json');
var shrinkwrap_json = node_path.join(fixtures, 'cortex-shrinkwrap.json');
var expected_html = node_path.join(fixtures, 'expected.html');

var pkg = jf.readFileSync(cortex_json);
var shrinkwrap = jf.readFileSync(shrinkwrap_json);
var expected = fs.readFileSync(expected_html).toString();

var c = compiler({
  pkg: pkg,
  shrinkWrap: shrinkwrap,
  root: '../../../',
  ext: '.min.js'
});


describe("compiler()", function(){
  it(".compile(template)()", function(){
    var fn = c.compile(template);
    expect(fn()).to.equal(expected);
  });
});