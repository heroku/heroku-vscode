# Deploy to Heroku Button Test Plan

## Overview

This test plan covers the functionality of the "Deploy to Heroku" button feature in the VS Code extension. The feature
allows users to deploy their workspace directly to Heroku through an interactive webview interface.

### Scope

- Initial button rendering and interaction
- Webview deployment interface
- App.json configuration parsing and validation
- Deployment form functionality
- Progress indication and status feedback
- Error handling and edge cases

### Prerequisites

- VS Code with Heroku extension installed
- Valid workspace with app.json
- Active Heroku account/authentication
- Test environment with mock API endpoints

### Test Categories

1. Deployment Options Display - Tests the initial button and webview interface
2. App.json Configuration - Validates config file parsing and display
3. Deployment Flow - Tests the end-to-end deployment process

### Success Criteria

- Button renders correctly and responds to user interaction
- Configuration options display accurately from app.json
- Deployment process completes successfully with proper feedback
- Error states are handled gracefully
- All required validations are enforced

---

### 2.3 Deploy to Heroku Button

#### 1. Deployment Options Display

##### Initial Button State

- Verify "Deploy to Heroku" button is visible
- Confirm button has correct icon `$(hk-icon-deploy-16)`
- Check button is enabled for valid workspaces

##### Webview Initialization

- Test webview loads correctly
- Verify header displays "Deploy workspace to Heroku"
- Confirm loading indicator shows while initializing
- Check repository list container is present

#### 2. App.json Configuration

##### Config File Detection

- Verify app.json is read from workspace
- Test handling when app.json is missing
- Validate parsing of configuration options

##### Config Options Display

- Test rendering of required config vars
- Verify optional config vars display correctly
- Confirm config descriptions are shown
- Check default values are populated

#### 3. Deployment Flow

##### Repository Card

- Test repository information display
- Verify language detection
- Check repository metadata shows correctly
- Confirm deployment form expands properly

##### Form Validation

- Test app name validation
- Verify required fields are marked
- Check error message display
- Confirm form submission blocking for invalid data

##### Deployment Process

- Test deploy button activation
- Verify progress indication during deployment
- Check success/error state handling
- Confirm deployment completion feedback

#### Test Cases

```typescript
describe('Deploy to Heroku Button', () => {
  it('should display deployment options', async () => {
    // Test initial render
    const deployButton = document.querySelector('.deploy-button');
    assert.exists(deployButton);
    assert.equal(deployButton.textContent, 'Deploy to Heroku');
  });

  it('should process app.json configuration', async () => {
    // Test config parsing
    const configVars = document.querySelectorAll('.config-var');
    assert.isTrue(configVars.length > 0);
  });

  it('should handle deployment flow', async () => {
    // Test deployment process
    const form = document.querySelector('.deploy-options');
    await form.submit();
    const progress = document.querySelector('vscode-progress-ring');
    assert.isTrue(progress.classList.contains('active'));
  });
});
```
