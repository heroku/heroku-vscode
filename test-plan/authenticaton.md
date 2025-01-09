# 1.2 Authentication Flow

## Prerequisites

- Heroku CLI installed and updated
- VS Code 1.60.0 or higher
- Extension installed successfully

## Test Cases

### 1. Initial Authentication Prompt

#### Steps

1. Open VS Code
2. Click on Heroku extension icon in Activity Bar
3. Locate "Sign in" button in extension panel
4. Authorize VS Code extension access
5. Click "Sign in" button
6. Verify Heroku CLI handles authentication request

#### Expected Results

- Sign in button clearly visible
- Clicking initiates Heroku CLI auth flow
- Browser opens to Heroku login page

### 2. OAuth Flow Completion

#### Steps

1. Complete Heroku login in browser
2. Return to VS Code
3. Observe extension panel update

#### Expected Results

- Browser authentication completes successfully
- VS Code receives auth token
- Extension panel updates to show logged-in state
- User profile information displayed

### 3. Token Storage and Persistence

#### Steps

1. Check extension appears in "Manage Trusted Extensions"
   - Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Type "Manage Trusted Extensions"
   - Verify Heroku extension listed
2. Close VS Code completely
3. Reopen VS Code
4. Check extension panel

#### Expected Results

- Extension listed in trusted extensions
- Authentication persists between sessions
- No re-authentication required
- User profile information exists
- User icon in the bottom right shows authentication status

### 4. Logout Functionality

#### Steps

1. Locate logout option by clicking on the user icon in the lower left
2. Trigger logout
3. Verify CLI token removal
4. Observe extension updated to show "Sign in" button

#### Expected Results

- Logout completes successfully
- Extension returns to signed-out state
- CLI tokens cleared
- Re-authentication required

### 5. External Authentication State Sync

#### Terminal Authentication Changes

1. Start with logged-out state in VS Code with the Heroku Extension open - You should see the "Sign in" button
2. Open external terminal (Command Prompt/PowerShell/Terminal)
3. Execute `heroku login` in external terminal
4. Observe VS Code extension state
5. Verify without VS Code restart:
   - Authentication status icon updates
   - App list refreshes
   - Heroku Resource Explorer is visible if linked apps exist in the workspace

#### Expected Results

- Extension detects external login
- UI updates within 5 seconds
- No VS Code restart required
- All authenticated features become available

#### External Logout Testing

1. Start with authenticated state in VS Code
2. Open external terminal
3. Execute `heroku logout` in external terminal
4. Observe VS Code extension state
5. Verify:
   - Authentication icon shows logged out
   - App list clears
   - Commands requiring auth disabled
   - Active log sessions terminated
   - Resource Explorer is no longer visible
   - "Sign in" button is visible

#### Expected Results

- Extension detects external logout
- UI updates within 5 seconds
- Active sessions cleanly terminated
- "Sign in" button visible

#### Multiple Terminal Testing (optional)

1. Open multiple terminal windows
2. Perform login/logout in different terminals
3. Verify VS Code extension state sync
4. Test rapid state changes

#### Expected Results

- Extension maintains consistent state
- Last action takes precedence
- No state conflicts occur
- Clean state transitions

#### Error Cases

1. Test with:
   - Corrupted token file
   - Manual token file deletion
   - Network disconnection during state check
   - Multiple simultaneous auth changes
2. Verify:
   - Appropriate error messages
   - Graceful degradation
   - Recovery procedures
   - User notification

#### Validation Points

- [ ] External login detected
- [ ] External logout detected
- [ ] UI updates automatically
- [ ] Active sessions handled
- [ ] Command availability updates
- [ ] Error states managed
- [ ] Multiple terminal support
- [ ] Extension state consistency aligned with auth status

#### Test Environment Setup

```bash
# Terminal 1
heroku logout
# Verify VS Code state

# Terminal 2
heroku login
# Verify VS Code state

# Terminal 3
heroku token
rm ~/.netrc  # or equivalent for OS
# Verify VS Code state
```

#### Cross-Platform Verification

If available, test on:

- Windows Command Prompt
- Windows PowerShell
- macOS Terminal
- Linux Terminal
- Git Bash
- WSL Terminal

## Error Cases

### 1. Network Issues

#### Steps

1. Attempt authentication with a bad username or password
2. Observe an error notification dialog in VSCode with an option to retry
3. Retry authentication
4. Authenticate normally

#### Expected Results

- Clear error message displayed with an option to retry
- Retry option re-enters the auth flow when selected
- Successful auth after retry

### 2. CLI Missing/Outdated (NOT IMPLEMENTED)

#### Steps

1. Uninstall/modify Heroku CLI
2. Attempt authentication
3. Reinstall/update CLI
4. Retry authentication

#### Expected Results

- Clear message about CLI requirement
- Instructions for CLI installation
- Successful auth after CLI fix

### 3. Token Invalidation

#### Steps

1. Invalidate token (via Heroku dashboard)
2. Attempt extension operation
3. Monitor re-authentication prompt

#### Expected Results

- Extension detects invalid token
- Prompts for re-authentication
- Clear user feedback
- Smooth re-authentication flow

## Validation Checklist

- Initial auth prompt functions
- OAuth flow completes
- Tokens stored securely
- Session persistence works
- Token refresh operates
- Logout functions properly
- Error handling works
- CLI integration solid

## Important Notes

- **Security**: Auth handled by Heroku CLI
- **Token Storage**: Managed by CLI, not extension
- **Permissions**: Extension uses CLI credentials
- **Updates**: Test after CLI updates
- **Platform**: Verify on all supported OS
