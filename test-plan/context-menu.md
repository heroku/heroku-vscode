# 6. Context Menu Integration Testing

Most all Heroku CLI commands can be associated to an app name or id, formation id, dyno name or id, redis add-on , or
postgres add-on are included as context menu items when right-clicking on the respective Heroku Resource Explorer tree
item.

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- Test application with:
  - Multiple dynos
  - Heroku Postgres add-on provisioned
  - Redis add-on provisioned

## Test Categories

### 1. Resource Explorer Context Menu Availability

#### App-Level Commands

1. Right-click on app in explorer
2. Verify numerous commands are available, organized by topic in sub-menus

#### Dyno Commands

1. Right-click on dyno formation
2. Verify commands:

   - Scale/Autoscale Dynos
   - Change Dyno Size
   - List app dynos
   - others

3. Right-click on individual dyno
4. Verify commands:
   - Restart/Stop Dyno

#### Add-on Commands

1. Verify all addons contain management related menu options

- Change plan
- Permanently delete
- Rename
- others...

2. Test Heroku Postgres context menu:

   - View Database Info
   - View Credentials
   - Reset Database
   - Promote Database
   - View Backups
   - many, many others

3. Test Redis context menu:
   - Key value store with submenu items

### 2. Context Awareness Testing

#### Command State Management

1. Test command enablement:
   - Resource-specific commands only available on correct resource

### 3. Command Parameter Handling

#### Parameter Collection

1. Test commands requiring input:
   - Verify parameter prompts
   - Test default values
   - Validate input constraints
   - Test cancel operations

#### Context-Based Defaults

1. Verify automatic parameter population based on resource:
   - Resource names - e.g. `--app`, `--dyno-name` flags, etc.
   - Resource identifiers - e.g. `--addon-name` flag, etc.

### 4. Command Execution Flow

#### Error Handling/Input Validation

1. Test error scenarios:
   - Invalid parameters
   - Omitting required flags and params when prompted

### 5. Integration Points

#### Command Registration

- [ ] Commands properly registered
- [ ] Correct labels/command associations

#### Resource Explorer Integration

- [ ] Context menus appear on right-click
- [ ] Commands grouped logically
- [ ] labels correct

#### CLI Command Mapping

- [ ] Commands map to correct CLI operations
- [ ] Parameters properly translated
- [ ] Results properly handled
- [ ] Command execution results displayed in drawer

## Validation Matrix

### Resource Types

- [ ] Applications
- [ ] Dynos
- [ ] Formations
- [ ] Postgres DBs
- [ ] Redis instances
- [ ] Other add-ons

### Command Categories

- [ ] Information/View
- [ ] Configuration
- [ ] Control/Management
- [ ] Maintenance
- [ ] Monitoring

### Context Awareness

- [ ] Resource Explorer item contains the expected menu options
- [ ] Add-on plans contain the expected menu options

## Important Notes

- Parameter validation critical for required flags and args
- Error handling must be graceful
- Context menu performance important
- CLI command correlation must be accurate
