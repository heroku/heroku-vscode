# Test Plan: Heroku Shell Script Command Integration

## Overview

This test plan covers the shell script integration features including:

- Shell script command detection and decoration
- Command hover functionality
- Environment variable handling
- Command execution integration

## Test Prerequisites

- VSCode extension installed
- Valid Heroku CLI authentication
- Shell script (.sh) file with Heroku commands
- Valid environment variables configured supporting commands to test

## 1. Shell Script Command Detection

### 1.1 Command Recognition

**Steps:**

1. Open shell script containing Heroku commands
2. Add various Heroku CLI commands:
   - Simple commands (heroku apps)
   - Complex commands (heroku config:set)
   - Commands with environment variables

**Expected Results:**

- All valid Heroku commands should be detected
- Decorations should appear for each valid command
- Command parsing should handle various command formats

### 1.2 Document Change Handling

**Steps:**

1. Modify shell script content
2. Add/remove Heroku commands
3. Edit existing commands
4. Save and reload document

**Expected Results:**

- Decorations should update on document changes
- Lexer should properly reparse modified content
- Command detection should remain accurate after changes

## 2. Visual Decoration Tests

### 2.1 Decoration Display

**Steps:**

1. Verify gutter icon presence
2. Check icon appearance in dark/light themes
3. Validate hover text presentation

**Expected Results:**

- Gutter icons should appear for each Heroku command
- Icons should be theme-appropriate
- Icon size should be '.5rem'
- Proper margin spacing ('0 .25rem 0 0')

### 2.2 Hover Functionality

**Steps:**

1. Hover over decorated commands
2. Verify hover message content
3. Check command execution link

**Expected Results:**

- Hover should show play icon with "Run command"
- Command link should be properly encoded
- Hover message should be trusted
- Command parameters should be correctly passed

## 3. Environment Variable Integration

### 3.1 Variable Detection

**Steps:**

1. Add environment variable assignments
2. Reference variables in Heroku commands
3. Mix local and exported variables

**Expected Results:**

- All assignment operations should be detected
- Variables should be properly collected
- Assignment string should be correctly formatted

### 3.2 Variable Handling

**Steps:**

1. Test various assignment formats
2. Use variables in different command positions
3. Test multi-line assignments

**Expected Results:**

- All valid assignments should be captured
- Assignment order should be preserved
- Proper handling of complex variable structures

## 4. Command Execution Integration

### 4.1 Command Parameter Passing

**Steps:**

1. Execute commands with different parameter types
2. Test commands with environment variables
3. Verify parameter encoding

**Expected Results:**

- Parameters should be correctly passed to executor
- Environment variables should be properly included
- Command string should be properly formatted

### 4.2 Execution Flow

**Steps:**

1. Click command execution link
2. Monitor command execution
3. Verify result handling

**Expected Results:**

- Command should execute with correct parameters
- Environment variables should be applied
- Execution results should be properly displayed

## 5. Error Handling

### 5.1 Invalid Command Detection

**Steps:**

1. Test malformed Heroku commands
2. Use invalid command syntax
3. Test incomplete commands

**Expected Results:**

- Invalid commands should not be decorated
- Proper error handling in lexer
- No decoration for non-Heroku commands

### 5.2 Execution Errors

**Steps:** 2. Use invalid environment variables

**Expected Results:**

- Clear error messages for execution failures
- Proper handling of environment variable errors
- Graceful failure handling

## Edge Cases

- Multiple commands on single line
- Comments within commands
- Unicode characters in commands
- Very long command lines
- Nested variable assignments

## Performance Criteria

- Decoration update within 500ms of change
- Hover response within 200ms
- Command execution initiation within 1 second
- Efficient handling of large shell scripts

## Resource Management

- Proper disposal of decorations
- Memory management for large files
- Clean up on editor close
- Handling of multiple open shell scripts

## Success Criteria

- Accurate command detection and decoration
- Reliable environment variable integration
- Consistent visual presentation
- Successful command execution
- Proper error handling and user feedback
