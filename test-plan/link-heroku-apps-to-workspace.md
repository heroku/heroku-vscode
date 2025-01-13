# 2.1 Heroku App Association

## Overview

Tests the "Link workspace to Heroku app(s)" button that adds Heroku apps to the workspace.

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- At least one Heroku app in account
- Test app repository containing an `app.json` cloned locally and open in VSCode
- No apps in the git remote. `git remote -v` should not contain any heroku apps

## Test Cases

### 1. App Selection Interface

#### Steps

1. Open the Heroku extension in the Activity Bar
2. Click "Link workspace to Heroku app(s)"
3. Observe Quick Pick dropdown

#### Expected Results

- Apps grouped by team name
- Personal apps under "Personal" section
- Each app shows:
  - App name as label
  - Team name as description
  - Correct icon (shielded for private spaces)
- Empty state shows "Create and deploy a new app" option (requires account with no apps)

### 2. Single App Linking

#### Steps

1. Click "Link workspace to Heroku app(s)"
2. Select single app from list
3. Observe the app is displayed in the Heroku extension

#### Expected Results

- Git remote added as `heroku-{app-name}`
- Command completes without errors
- Remote URL points to correct app
- Heroku CLI is executed and results are displayed in the VSCode drawer

### 3. Multiple App Linking

#### Steps

1. Click "Link workspace to Heroku app(s)"
2. Select multiple apps using multi-select
3. Check Git remotes

#### Expected Results

- Git remote added for each selected app
- Remotes named as `heroku-{app-name}`
- All remotes point to correct apps
- Extension is updated to show newly linked apps

### 4. New App Creation Flow

#### Steps

1. Log in using a Heroku account with no apps
2. Click "Link workspace to Heroku app(s)"
3. Select "Create and deploy a new app"
4. Complete new app creation flow

#### Expected Results

- Redirects to `DeployToHeroku` flow
- New app created successfully
- Workspace linked to new app

### 5. Error Cases

#### Test Invalid App Selection

1. Select app
2. Delete app in another window
3. Complete linking process

#### Expected Results

- Clear error messages in log output (provided by Heroku CLI)
- Graceful failure handling

## Validation Points

- App list correctly grouped by team
- Proper icon display for apps
- Multi-select functionality works
- Git remote creation successful
- Remote naming convention followed
- Error states handled properly

## Command Reference

```typescript
vscode.commands.executeCommand(LinkApp.COMMAND_ID);
```

## Git Remote Format

```bash
git remote -v
# Should show: heroku-{app-name} https://git.heroku.com/{app-name}.git
```

## Cleanup Steps

1. Remove added Git remotes:

```bash
git remote remove heroku-{app-name}
```

2. Verify remote removal:

```bash
git remote -v
```

## Important Notes

- Command requires authenticated Heroku session
- Workspace must be Git initialized
- Multiple apps can be linked simultaneously
- Remote names follow `heroku-{app-name}` pattern
- Private space apps show shield icon in the quick pick list
