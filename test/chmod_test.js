'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var grunt = require('./helpers/grunt');

var skipPosix = { skip: process.platform === 'win32' && 'POSIX permissions' };

function perms(file) {
  return (fs.statSync(file).mode & parseInt('7777', 8)).toString(8).padStart(3, '0');
}

function file(base, name, mode) {
  var full = path.join(base, 'tmp', name);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '');
  if (mode) {
    fs.chmodSync(full, parseInt(mode, 8));
  }
  return full;
}

// Run one chmod target with its events recorded, the way upstream's suite
// did, and return the result and the recorded events.
function runTarget(base, target, extra) {
  var result = grunt.run(base, ['listeners-on', 'chmod:' + target, 'listeners-off'].concat(extra || []));
  var events = path.join(base, 'tmp', target + '.json');
  result.events = fs.existsSync(events) ? JSON.parse(fs.readFileSync(events, 'utf8')) : null;
  return result;
}

function expected(target) {
  return JSON.parse(fs.readFileSync(path.join(grunt.expected, target + '.json'), 'utf8'));
}

// Upstream's failure cases: the task fails (so --force to reach
// listeners-off) and emits error + fail.
['default_options', 'custom_options_without_string_mode', 'custom_options_with_empty_mode'].forEach(function(target) {
  test(target + ' fails the task', function(t) {
    var base = grunt.tempDir(t);
    file(base, target + '.txt');
    var result = runTarget(base, target, ['--force']);
    assert.deepEqual(result.events, expected(target));
    assert.match(result.output, /Task failed!/);
    assert.notEqual(grunt.run(base, ['chmod:' + target]).status, 0);
  });
});

test('custom_options_nonexistent_file succeeds without touching anything', function(t) {
  var base = grunt.tempDir(t);
  var result = runTarget(base, 'custom_options_nonexistent_file');
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(result.events, expected('custom_options_nonexistent_file'));
  assert.match(result.output, /0 files had their `chmod` mode set to "600"/);
});

test('custom_options_with_invalid_mode: a+rwx is a valid symbolic mode', skipPosix, function(t) {
  var base = grunt.tempDir(t);
  var f = file(base, 'custom_options_with_invalid_mode.txt', '000');
  var result = runTarget(base, 'custom_options_with_invalid_mode');
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(result.events, expected('custom_options_with_invalid_mode'));
  assert.equal(perms(f), '777');
});

[
  ['custom_options_file', '644', '444'],
  ['custom_options_file_symbolic_1', '000', '400'],
  ['custom_options_file_symbolic_2', '000', '600'],
  ['custom_options_file_symbolic_3', '000', '700'],
  ['custom_options_file_symbolic_4', '000', '404'],
  ['symbolic_list', '000', '654'],
  ['symbolic_minus', '666', '644']
].forEach(function(row) {
  var target = row[0];
  test(target + ' sets ' + row[2], skipPosix, function(t) {
    var base = grunt.tempDir(t);
    var f = file(base, target + '.js', row[1]);
    var result = runTarget(base, target);
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(result.events, [{ name: 'chmod.success', args: [] }]);
    if (fs.existsSync(path.join(grunt.expected, target + '.json'))) {
      assert.deepEqual(result.events, expected(target));
    }
    assert.equal(perms(f), row[2]);
  });
});

test('custom_options_dir sets a directory mode', skipPosix, function(t) {
  var base = grunt.tempDir(t);
  var dir = path.join(base, 'tmp/custom_options_dir');
  fs.mkdirSync(dir, { recursive: true });
  var result = runTarget(base, 'custom_options_dir');
  assert.equal(result.status, 0, result.output);
  assert.deepEqual(result.events, expected('custom_options_dir'));
  assert.equal(perms(dir), '444');
  fs.chmodSync(dir, parseInt('755', 8));
});

test('a numeric mode keeps setgid on a directory', skipPosix, function(t) {
  var base = grunt.tempDir(t);
  var dir = path.join(base, 'build');
  fs.mkdirSync(dir);
  fs.chmodSync(dir, parseInt('2775', 8));
  if (perms(dir) !== '2775') {
    t.skip('filesystem does not support setgid');
    return;
  }
  assert.equal(grunt.run(base, ['chmod:build']).status, 0);
  assert.equal(perms(dir), '2755');
});

test('an unparseable mode fails the task', function(t) {
  var base = grunt.tempDir(t);
  var f = file(base, 'garbage_mode.js', '644');
  var result = runTarget(base, 'garbage_mode', ['--force']);
  assert.match(result.output, /Invalid symbolic mode change: zz/);
  assert.deepEqual(result.events.map(function(e) { return e.name; }), ['chmod.error', 'chmod.fail']);
  assert.notEqual(grunt.run(base, ['chmod:garbage_mode']).status, 0);
  if (process.platform !== 'win32') {
    assert.equal(perms(f), '644');
  }
});

test('a missing nonull source fails the task', function(t) {
  var base = grunt.tempDir(t);
  var result = grunt.run(base, ['chmod:nonull_missing']);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Source dir\/file "tmp\/nonull_missing.js" not found/);
});

test('CyberChef chmod:build sets 755 on build/ and everything under it', skipPosix, function(t) {
  var base = grunt.tempDir(t);
  fs.mkdirSync(path.join(base, 'build/prod/assets'), { recursive: true });
  fs.writeFileSync(path.join(base, 'build/prod/index.html'), '');
  fs.writeFileSync(path.join(base, 'build/prod/assets/main.js'), '');
  fs.chmodSync(path.join(base, 'build/prod/index.html'), parseInt('600', 8));
  fs.chmodSync(path.join(base, 'build/prod/assets'), parseInt('700', 8));
  var result = grunt.run(base, ['chmod:build']);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /5 files had their `chmod` mode set to "755"/);
  ['build', 'build/prod', 'build/prod/assets', 'build/prod/index.html', 'build/prod/assets/main.js'].forEach(function(p) {
    assert.equal(perms(path.join(base, p)), '755', p);
  });
});
