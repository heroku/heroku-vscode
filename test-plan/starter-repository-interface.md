# 2.2 Starter Repository Browser

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- GitHub authenticated in VSCode
- Active internet connection
- Test app repository containing an `app.json` cloned locally and open in VSCode
- No apps in the git remote. `git remote -v` should not contain any heroku apps

## Test Categories

### 1. Repository Browser Interface

#### Navigate to WebView

1. Open the Heroku extension in the Activity Bar
2. Click on the "Browse starer apps" button
3. Verify a WebView is displayed with a loading indicator
4. Wait for repository lists to populate

#### Expected Results

- Loading indicator displays while fetching data
- Each repository card shows:
  - Repository name
  - Description
  - Language
  - Stars count
  - Last updated date
  - Visibility status

### 2. Search Functionality

#### Basic Search

1. Locate search field at top of view
2. Enter search term
3. Observe real-time filtering (250ms debounce)
4. Clear search field

#### Search Fields Coverage

Test searching by:

- Repository name
- Description
- Programming language
- Repository URL

#### Expected Results

- Results filter across all three sections
- Non-matching items hidden
- Hidden items marked with `aria-hidden="true"`
- Empty results show appropriate state
- Search is case-insensitive

### 3. Repository Selection

#### Card Interaction

1. Click "Deploy to Heroku" button on repository card
2. Observe a smooth animation opening the card and centering it on screen for optimal viewing
3. Verify metadata display:
   - Team selection dropdown (if teams exist)
   - Space selection dropdown (if spaces exist)
   - Configuration variables (if specified in app.json)
4. Test dropdowns functionality

#### Configuration Variables

2. Verify env variables appear (if applicable)
3. Test input validation
4. Test required vs optional fields

### 4. Deployment Process

#### Basic Deployment

1. Click "Deploy to Heroku" button on repository card of your choosing
2. Configure required fields
3. Click "Deploy app" button
4. Verify a drawer opens and displays the deployment progress
5. Verify the newly deployed app is displayed in the Heroku extension panel

#### Team/Space Deployment

1. Click "Deploy to Heroku" button on repository card of your choosing
2. Choose team from dropdown
3. Select space if available
4. Verify a drawer opens and displays the deployment progress
5. Verify app creation in selected team/space
6. Verify the newly deployed app is displayed in the Heroku extension panel

#### Configuration Testing

1. Test with:
   - Personal account
   - Team account
   - Private spaces
   - Configuration variables
2. Verify each combination

## Error Cases

### 2. Authentication Failures

#### Steps

1. Close starter apps WebView
2. Logout of GitHub in VSCode
3. Attempt to open starter apps WebView
4. Verify view does not display
5. Verify you are presented with the dialog: "The extension 'Heroku' wants to sign in using GitHub."
6. Click allow and follow instructions
7. Verify starter apps WebView displays

#### Expected Results

- Clear error indication
- Authentication renewal prompt
- Successful recovery after re-authentication

### 3. Invalid Configurations

#### Steps

1. Test invalid env variables
2. Try deploying without required fields

#### Expected Results

- Validation errors displayed
- Clear error messages
- Prevented deployment with invalid config

### 4. Cancel deployment after it starts

#### Steps

1. Follow instructions for the Deployment Process
2. During an active deployment, click "Cancel" on the deployment dialog
3. Verify an error occurs and deployment fails.

#### Expected Results

- Deployment errors displayed
- Clear error messages
- Prevented deployment unless Heroku has already begun the build process

## Validation Checklist

- [ ] Repository lists load correctly
- [ ] Search filters work across all sections
- [ ] Card metadata displays accurately
- [ ] Team/Space selection functions
- [ ] Configuration variables load and validate
- [ ] Deployment process completes
- [ ] Error states handled properly

## Important Notes

- Search has 250ms debounce
- Repositories cached after initial load
- Configuration variables fetched on demand
- Teams/Spaces grouped by enterprise/organization
- Repository cards maintain consistent state
- Accessibility attributes maintained during filtering
