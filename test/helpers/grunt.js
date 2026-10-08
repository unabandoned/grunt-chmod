'use strict';

// Runs the real grunt CLI against test/Gruntfile.js with a throwaway base
// directory, so every test gets a fresh grunt process and a fresh cwd.

var childProcess = require('node:child_process');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');

var gruntBin = require.resolve('grunt/bin/grunt');
var gruntfile = path.join(__dirname, '..', 'Gruntfile.js');

exports.fixtures = path.join(__dirname, '..', 'fixtures');
exports.expected = path.join(__dirname, '..', 'expected');

exports.tempDir = function(t) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grunt-test-'));
  t.after(function() {
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

exports.run = function(base, args) {
  var result = childProcess.spawnSync(process.execPath, [gruntBin, '--gruntfile', gruntfile, '--base', base, '--no-color'].concat(args), {
    encoding: 'utf8'
  });
  result.output = result.stdout + result.stderr;
  return result;
};

// Sorted relative paths of every file and directory beneath dir, with file
// contents, so two trees can be compared with a single deepStrictEqual.
exports.tree = function(dir) {
  return fs.readdirSync(dir, { recursive: true }).map(function(rel) {
    rel = rel.split(path.sep).join('/');
    var full = path.join(dir, rel);
    return fs.statSync(full).isDirectory() ? rel + '/' : rel + ': ' + fs.readFileSync(full, 'utf8');
  }).sort();
};
