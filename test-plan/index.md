# Heroku VSCode Extension Test Plan

## 1. Installation and Authentication

### 1.1 [Extension Installation](./installation.md)

- Install extension from VSIX file
- Verify extension appears in VSCode extensions list
- Confirm extension activation

### 1.2 [Authentication Flow](./authenticaton.md)

- Test initial authentication prompt
- Validate OAuth flow completion
- Verify token storage and persistence
- Test token refresh mechanism
- Validate logout functionality

## 2. Workspace Configuration

### 2.1 [Heroku App Association](./link-heroku-apps-to-workspace.md)

- Link existing workspace to single Heroku app
- Link workspace to multiple Heroku apps
- Validate app linkage persistence
- Test unlinking functionality

### 2.2 [Starter Repository Interface](./starter-repository-interface.md)

- Browse available starter repositories
- Test repository search functionality
- Clone selected repository
- Validate initial deployment process
- Test deployment configuration options

### 2.3 [Deploy to Heroku Button](./deploy-to-heroku-button.md)

- Verify deployment options displayed
- Verify config options in `app.json` are present
- Test deployment flow

## 3. [Add-on Marketplace](./add-on-marketplace.md)

### 3.1 Heroku Add-on Marketplace WebView

- List available add-ons
- Install new add-on
- Configure add-on settings
- Validate add-on attachment

## 4. [Log Streaming](./log-streaming.md)

### 4.1 Log Session Management

- Initialize log session
- Validate real-time log streaming
- Test log filtering options
- Verify timestamp accuracy
- Test log session termination

### 4.2 [Real-time Status Updates](./real-time-updates.md)

- Verify real-time status indicators
- Test status notification delivery
- Validate status message formatting
- Check historical status retrieval

## 5. [Formation/Dyno Management](./formation-and-dyno-management.md)

### 5.1 Context Menu Operations

- Scale formation up/down
- Restart dynos
- View dyno status
- Modify dyno configuration

## 6. [Contextual Command Execution and Command Input Handling](./context-menu.md)

### 6.1 Context Menu Integration

- Test right-click command access
- Validate command context awareness
- Test required flag prompts
- Verify command execution

### 8.2 [Context Menu & Configuration-based Deployment](./context-menu-and-configuration-deployments.md)

- Test app.json and Procfile deployment
- Test context menu deployment
- Validate Procfile deployment
- Test environment variable handling
- Verify build process

## 9. [Shell Script Integration](./command-execution-from-sh-file.md)

### 9.1 Script Execution

- Test .sh file recognition
- Validate command parsing
- Test script execution flow
- Verify error handling

## 10. [Configuration Editing](./configuration-editing.md)

### 10.1 app.json Editing

- Test syntax highlighting
- Validate auto-completion
- Test schema validation
- Verify error detection
- Test suggestion prompts

---

**Notes:**

- Each test case should be executed systematically
- Document all test results and findings
- Report and track any defects discovered
- Verify fixes for reported issues
- Conduct regression testing after major changes
