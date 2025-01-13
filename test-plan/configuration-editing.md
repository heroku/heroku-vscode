# Test Plan: app.json Schema Validation Features

## Overview

This test plan covers VSCode's JSON schema validation features when editing app.json files, including IntelliSense,
validation, and auto-completion functionality. The schema is provided by this extension and associated with `app.json`
files at installation.

## Test Prerequisites

- VSCode extension installed
- Empty and sample app.json files for testing

## 1. Basic Schema Validation

### 1.1 Required Structure

**Steps:**

- Create new app.json file
- Add/remove top-level properties
- Test property name suggestions

**Expected Results:**

- IntelliSense shows available top-level properties
- Invalid properties marked with error indicators
- Property suggestions match schema definition

### 1.2 Property Type Validation

**Steps:**

- Test each property with correct and incorrect types:

```json
{
  "name": "my-app", // Test pattern ^[a-zA-Z-_\\.]+
  "description": "App desc", // Test string type
  "keywords": ["web", "app"], // Test array of strings
  "website": "https://example.com", // Test URI format
  "repository": "https://github.com/user/repo", // Test URI
  "logo": "https://example.com/logo.png", // Test URI
  "success_url": "/dashboard" // Test string
}
```

**Expected Results:**

- Type mismatches highlighted
- Pattern validation for name property
- URI format validation for website/repository/logo
- Array validation for keywords

## 2. Complex Property Validation

### 2.1 Environment Variables

**Steps:**

- Add env section with test cases:

```json
{
  "env": {
    "VALID_KEY": {
      "description": "Valid key test",
      "value": "test-value",
      "required": true
    },
    "invalid_key": {
      "description": "Should show error"
    }
  }
}
```

**Expected Results:**

- Environment variable names validated against pattern ^A-Z\*$
- Property suggestions shown for env variable objects
- Required field validation working

### 2.2 Formation Configuration

**Steps:**

- Test formation configurations:

```json
{
  "formation": {
    "web": {
      "quantity": 1,
      "size": "standard-1x"
    },
    "worker": {
      "quantity": 0,
      "size": "invalid-size"
    }
  }
}
```

**Expected Results:**

- Size enum validation working
- Quantity minimum value (0) enforced
- Invalid values properly marked

## 3. Array Validation

### 3.1 Buildpacks Array

**Steps:**

- Test buildpack configurations:

```json
{
  "buildpacks": [{ "url": "heroku/nodejs" }, { "url": "heroku/ruby" }, { "invalid": "should-error" }]
}
```

**Expected Results:**

- Array items properly validated
- URL property requirement enforced
- Invalid properties marked

### 3.2 Addons Array

**Steps:**

- Test addon configurations:

```json
{
  "addons": [
    "heroku-postgresql",
    {
      "plan": "heroku-redis:premium-0",
      "options": {
        "region": "us"
      }
    }
  ]
}
```

**Expected Results:**

- Both string and object formats accepted
- Plan property validated in object format
- Options object properly validated

## 4. IntelliSense Features

### 4.1 Property Completion

**Steps:**

- Test completion in scenarios:

```json
{
  "env": {
    // Test ctrl+space here
  },
  "formation": {
    "web": {
      // Test ctrl+space here
    }
  }
}
```

**Expected Results:**

- Context-aware suggestions shown
- Proper nesting level respected
- Type hints displayed

### 4.2 Enum Value Completion

**Steps:**

- Test enum completions:

```json
{
  "stack": "", // Test ctrl+space
  "formation": {
    "web": {
      "size": "" // Test ctrl+space
    }
  }
}
```

**Expected Results:**

- Valid enum values listed
- Documentation shown for values
- Invalid values marked

## 5. Error Detection

### 5.1 Syntax Errors

**Steps:**

- Test invalid syntax:

```json
{
  "name": "test-app"
  "env": {  // Missing comma
  }
}
```

**Expected Results:**

- Syntax errors highlighted
- Clear error messages shown
- Quick fixes offered where applicable

### 5.2 Schema Violations

**Steps:**

- Test schema violations:

```json
{
  "name": "INVALID_NAME!",
  "env": {
    "invalid-key": {
      "required": "not-boolean"
    }
  }
}
```

**Expected Results:**

- Pattern violations marked
- Type violations highlighted
- Required property warnings shown

## Edge Cases

- Empty objects/arrays
- Maximum string lengths
- Pattern edge cases
- Nested object depth
- Multiple validation errors

## Success Criteria

- All schema validations function correctly
- IntelliSense provides accurate suggestions
- Error messages are clear and helpful
- Pattern validation works as specified
- Enum values are properly validated
