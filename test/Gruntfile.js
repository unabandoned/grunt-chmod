'use strict';

var path = require('node:path');

// Run by test/helpers/grunt.js with --base set to a temporary directory, so
// every path below is relative to it.
module.exports = function(grunt) {
  grunt.initConfig({
    chmod: {
      // Emit events, JUST for testing purposes!
      options: {
        emit: true
      },
      default_options: {
        src: ['tmp/default_options.txt']
      },
      custom_options_without_string_mode: {
        options: { mode: {} },
        src: ['tmp/custom_options_without_string_mode.txt']
      },
      custom_options_with_empty_mode: {
        options: { mode: '' },
        src: ['tmp/custom_options_with_empty_mode.txt']
      },
      custom_options_with_invalid_mode: {
        options: { mode: 'a+rwx' },
        src: ['tmp/custom_options_with_invalid_mode.txt']
      },
      custom_options_nonexistent_file: {
        options: { mode: '600' },
        src: ['tmp/custom_options_nonexistent_file.txt']
      },
      custom_options_file: {
        options: { mode: '444' },
        src: ['tmp/custom_options_file.js']
      },
      custom_options_dir: {
        options: { mode: '444' },
        src: ['tmp/custom_options_dir/']
      },
      custom_options_file_symbolic_1: {
        options: { mode: 'u+r' },
        src: ['tmp/custom_options_file_symbolic_1.js']
      },
      custom_options_file_symbolic_2: {
        options: { mode: 'u+rw' },
        src: ['tmp/custom_options_file_symbolic_2.js']
      },
      custom_options_file_symbolic_3: {
        options: { mode: 'u+rwx' },
        src: ['tmp/custom_options_file_symbolic_3.js']
      },
      custom_options_file_symbolic_4: {
        options: { mode: 'uo+r' },
        src: ['tmp/custom_options_file_symbolic_4.js']
      },
      symbolic_list: {
        options: { mode: 'a=r,u+w,g+x' },
        src: ['tmp/symbolic_list.js']
      },
      symbolic_minus: {
        options: { mode: 'go-w' },
        src: ['tmp/symbolic_minus.js']
      },
      garbage_mode: {
        options: { mode: 'zz' },
        src: ['tmp/garbage_mode.js']
      },
      nonull_missing: {
        options: { mode: '644' },
        nonull: true,
        src: ['tmp/nonull_missing.js']
      },
      // CyberChef's chmod:build target.
      build: {
        options: { mode: '755' },
        src: ['build/**/*', 'build/']
      }
    }
  });

  grunt.loadTasks(path.join(__dirname, '..', 'tasks'));

  // Record every chmod.* event of one task run into tmp/<target>.json.
  var emissions = [];
  var taskTargetName;
  grunt.registerTask('listeners-on', function() {
    grunt.event.on('chmod.*', function(msg) {
      if (this.event === 'chmod.taskTargetName') {
        taskTargetName = msg;
        return;
      }
      emissions.push({ name: this.event, args: Array.prototype.slice.call(arguments) });
    });
  });
  grunt.registerTask('listeners-off', function() {
    grunt.file.write('tmp/' + taskTargetName + '.json', JSON.stringify(emissions, null, 2));
    emissions.length = 0;
    grunt.event.removeAllListeners('chmod.*');
  });
};
