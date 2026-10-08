/*
 * grunt-chmod
 * https://github.com/JamesMGreene/grunt-chmod
 *
 * Copyright (c) 2013 James M. Greene
 * Licensed under the MIT license.
 */

'use strict';

var fs = require('fs');

// Permission bits, as in POSIX <sys/stat.h>.
var PERMS = {
  OTHER_EXEC: parseInt('0001', 8),
  OTHER_WRITE: parseInt('0002', 8),
  OTHER_READ: parseInt('0004', 8),
  GROUP_EXEC: parseInt('0010', 8),
  GROUP_WRITE: parseInt('0020', 8),
  GROUP_READ: parseInt('0040', 8),
  OWNER_EXEC: parseInt('0100', 8),
  OWNER_WRITE: parseInt('0200', 8),
  OWNER_READ: parseInt('0400', 8),
  STICKY: parseInt('01000', 8),
  SETGID: parseInt('02000', 8),
  SETUID: parseInt('04000', 8),
  TYPE_MASK: parseInt('0770000', 8)
};

// Change the mode of one file or directory, following symlinks. `mode` is an
// octal string ('755') or a comma-separated list of symbolic changes
// ('u+x,go-w'). This keeps the semantics of shelljs's chmod, which this
// task used to call: symbolic changes ignore the umask, and setuid/setgid on
// a directory are never cleared by a numeric mode or by '='.
// Adapted from shelljs (BSD-3-Clause, Copyright (c) 2012 Artur Adib).
function chmod(mode, file) {
  var stat = fs.statSync(file);
  var perms = stat.mode;
  var type = perms & PERMS.TYPE_MASK;
  var newPerms = perms;

  if (!isNaN(parseInt(mode, 8))) {
    newPerms = type + parseInt(mode, 8);
    if (stat.isDirectory()) {
      newPerms |= (PERMS.SETUID + PERMS.SETGID) & perms;
    }
    fs.chmodSync(file, newPerms);
    return;
  }

  mode.split(',').forEach(function(symbolicMode) {
    var matches = /^([ugoa]*)([=+-])([rwxXst]*)$/i.exec(symbolicMode);
    if (!matches) {
      throw new Error('Invalid symbolic mode change: ' + symbolicMode);
    }
    var applyTo = matches[1];
    var operator = matches[2];
    var change = matches[3];

    var changeOwner = applyTo.indexOf('u') !== -1 || applyTo === 'a' || applyTo === '';
    var changeGroup = applyTo.indexOf('g') !== -1 || applyTo === 'a' || applyTo === '';
    var changeOther = applyTo.indexOf('o') !== -1 || applyTo === 'a' || applyTo === '';

    var changeRead = change.indexOf('r') !== -1;
    var changeWrite = change.indexOf('w') !== -1;
    var changeExec = change.indexOf('x') !== -1;
    var changeSticky = change.indexOf('t') !== -1;
    var changeSetuid = change.indexOf('s') !== -1;

    var mask = 0;
    if (changeOwner) {
      mask |= (changeRead ? PERMS.OWNER_READ : 0) + (changeWrite ? PERMS.OWNER_WRITE : 0) + (changeExec ? PERMS.OWNER_EXEC : 0) + (changeSetuid ? PERMS.SETUID : 0);
    }
    if (changeGroup) {
      mask |= (changeRead ? PERMS.GROUP_READ : 0) + (changeWrite ? PERMS.GROUP_WRITE : 0) + (changeExec ? PERMS.GROUP_EXEC : 0) + (changeSetuid ? PERMS.SETGID : 0);
    }
    if (changeOther) {
      mask |= (changeRead ? PERMS.OTHER_READ : 0) + (changeWrite ? PERMS.OTHER_WRITE : 0) + (changeExec ? PERMS.OTHER_EXEC : 0);
    }
    // The sticky bit is not tied to user, group or other.
    if (changeSticky) {
      mask |= PERMS.STICKY;
    }

    switch (operator) {
      case '+':
        newPerms |= mask;
        break;
      case '-':
        newPerms &= ~mask;
        break;
      case '=':
        newPerms = type + mask;
        if (stat.isDirectory()) {
          newPerms |= (PERMS.SETUID + PERMS.SETGID) & perms;
        }
        break;
    }
  });

  if (newPerms !== perms) {
    fs.chmodSync(file, newPerms);
  }
}

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('chmod', 'Modify file permissions, a la `chmod`.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      mode: '',
      emit: false
    });

    var shouldEmit = options.emit === true;
    if (shouldEmit) {
      grunt.event.emit('chmod.taskTargetName', this.target);
    }

    var logError = createLogErrorFunc(shouldEmit);
    var taskFailure = createTaskFailureFunc(shouldEmit);
    var taskSuccess = createTaskSuccessFunc(shouldEmit);

    var mode = options.mode;

    // If there isn't any mode to set, then bail out
    if (!mode) {
      logError('No `mode` was specified in the task `options`. Task failed!');
      return taskFailure();
    }
    // If the mode set wasn't a string, then bail out
    if (typeof mode !== 'string') {
      logError('The `mode` specified in the task `options` was not a string. Task failed!');
      return taskFailure();
    }

    var files = this.filesSrc;

    // Iterate over all specified file groups.
    files.forEach(function(path) {
      // Warn on and remove invalid source files (if nonull was set).
      if (!grunt.file.exists(path)) {
        logError('Source dir/file "' + path + '" not found.');
        return;
      }

      try {
        chmod(mode, path);
      }
      catch (e) {
        logError('Failed to set `chmod` mode "' + mode + '" on dir/file: ' + path + '\n' + e);
      }
    });

    // Fail task if errors were logged.
    if (this.errorCount) {
      return taskFailure();
    }

    // Otherwise, print a success message.
    grunt.log.ok(files.length + ' file' + (files.length === 1 ? '' : 's') + ' had their `chmod` mode set to "' + mode + '".');
    return taskSuccess();
  });

  var createLogErrorFunc = function(shouldEmit) {
    if (shouldEmit) {
      return function(errorMsg) {
        grunt.event.emit('chmod.error', errorMsg);
        grunt.log.error(errorMsg);
      };
    }
    return function(errorMsg) {
      grunt.log.error(errorMsg);
    };
  };

  var createTaskFailureFunc = function(shouldEmit) {
    if (shouldEmit) {
      return function() {
        grunt.event.emit('chmod.fail');
        return false;
      };
    }
    return function() {
      return false;
    };
  };

  var createTaskSuccessFunc = function(shouldEmit) {
    if (shouldEmit) {
      return function() {
        grunt.event.emit('chmod.success');
        return true;
      };
    }
    return function() {
      return true;
    };
  };

};
