# Test Plan: Heroku Deployment Context Menu and Configuration File Deployments

## Overview

This test plan covers the deployment initialization paths through:

1. Context menu on app.json/Procfile files (requiring app selection)
2. Context menu on Resource Explorer apps (using pre-selected app)
3. File decorator deployment option

## Test Prerequisites

- VSCode extension installed and authenticated
- Git repository initialized
- Sample application with app.json and/or Procfile
- At least one existing Heroku app in account
- At least 1 app attached to the workspace and visible in the Heroku Resource Explorer (for the Heroku Resource Explorer
  context menu flow)

## 1. Resource Explorer App Context Menu Tests

### 1.1 Direct App Deployment

**Steps:**

1. Locate existing app in the Heroku Resource Explorer
2. Right-click to open context menu
3. Select "Deploy" option

**Expected Results:**

- Deployment should initiate immediately
- No app selection dialog should appear
- Selected app should be used as deployment target
- Local source code should be packaged and sent for deployment
- Deployment status should be visible in progress dialog

### 1.2 App State Validation

**Steps:**

1. Test deployment with running app
2. Test with stopped app

**Expected Results:**

- Proper handling of different app states
- Deployment should complete and real-time status indicators active

## 2. Configuration File Context Menu Tests

### 2.1 app.json Context Menu

**Steps:**

1. Right-click app.json in workspace
2. Select "Deploy to Heroku" option
3. Observe app selection dialog

**Expected Results:**

- App selection dialog should appear
- List of existing apps should be available
- Option to create new app should be present when typing in a new name
- Dialog should show proper validation for new app names

### 2.2 Procfile Context Menu

**Steps:**

1. Right-click Procfile in workspace
2. Select "Deploy to Heroku" option
3. Observe app selection dialog

**Expected Results:**

- Same behavior as app.json deployment

## 3. App Selection Dialog Integration

### 3.1 Existing App Selection

**Steps:**

1. Initiate deployment via configuration file (app.json or Procfile)
2. Select existing app from dropdown
3. Confirm selection

**Expected Results:**

- List should show all available apps
- Apps should be properly categorized

### 3.2 New App Creation

**Steps:**

1. Choose "Create new app" option
2. Enter new app name

**Expected Results:**

- Successful creation and deployment to new app based on name chosen
- App should be added to the Heroku Resource Explorer after deployment completes

## 4. Context Menu Availability

### 4.1 File Location Validation

**Steps:**

1. Test context menu on root level files
2. Test on files in subdirectories
3. Test with multiple workspace folders

**Expected Results:**

- Context menu should only appear for root-level files
- Clear indication if file location is invalid
- Proper handling of multi-root workspaces

### 4.2 File Content Validation

**Steps:**

1. Test with valid app.json/Procfile
2. Test with invalid file content
3. Test with empty files

**Expected Results:**

- Validation of file content before showing menu
- Appropriate error messages for invalid content
- Prevention of deployment with invalid configurations

## 5. Integration Tests

### 5.1 Multiple Deployment Methods

**Steps:**

1. Test switching between deployment methods
2. Attempt concurrent deployments
3. Cancel deployment and switch methods

**Expected Results:**

- Consistent behavior across methods
- Proper handling of concurrent requests
- Clean state after cancellation

### 5.2 Resource Explorer Integration

**Steps:**

1. Deploy to existing app
2. Verify app updates in Resource Explorer
3. Test app refresh after deployment

**Expected Results:**

- Real-time updates in Resource Explorer
- Accurate app state reflection
- Proper refresh of app information

## Edge Cases

- Multiple workspace folders with configuration files
- Concurrent deployments to same app
- Invalid app states in Resource Explorer

## Performance Criteria

- Context menu should appear within 200ms (depending on network connectivity)
- App selection dialog should load within 1 second
- App list should populate within 2 seconds
- Deployment should initialize within 3 seconds

## Error Handling

- Invalid configuration files
- Resource Explorer sync issues

## Success Criteria

- All deployment paths function correctly
- App selection is intuitive and error-free
- Context menus appear in appropriate locations
- Resource Explorer integration is seamless
- Error handling is robust and user-friendly
