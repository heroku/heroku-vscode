# 5. Dyno Management Testing

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- Active Heroku application

## Test Cases

#### Expected Results

- Scale dialog shows current count
- Valid range enforced
- Formation updates immediately
- Resource Explorer reflects changes
- Status updates show scaling progress

### 2. Dyno Restart Operations

#### Single Dyno Stop/Restart

1. Right-click specific dyno
2. Select "Restart" or "Stop"
3. Verify:
   - Action initiates
   - State transitions in explorer
   - Dyno returns to running state if restarted or stops if stop was chosen

### 3. Dyno Status Management

#### Status Monitoring

1. Observe dyno states in explorer:
   - Up (running)
   - Starting
   - Crashed
   - Idle
2. Verify status icon updates
3. Verify label matches state information

#### State Transitions

1. Test various state changes:
   - Start → Up
   - Up → Restarting
   - Crashed → Restarting
2. Verify explorer updates and icon colors match

- Up (green)
- Restarting (yellow)
- Stopped/Crashed (red)

### 4. Configuration Modification

#### Dyno Formation Changes

1. Right-click on a Formation
2. Select "Change dyno sizes"
3. Test size modifications:
   - Basic tier options
   - Standard tier options
   - Performance tier options
4. Verify:
   - Size change applies
   - Dynos restart automatically and states are displayed
   - New configuration active

#### Resource Limits

1. Test scaling beyond limits
2. Check error notifications

## Validation Checklist

### Context Menu

- [ ] Scale options available
- [ ] Restart options present
- [ ] Configuration changes accessible
- [ ] Status information visible

### Operations

- [ ] Scaling works correctly
- [ ] Restarts execute properly
- [ ] Size changes apply
- [ ] Status updates show

### UI Elements

- [ ] Resource Explorer updates
- [ ] Status icons accurate
- [ ] Error messages clear

### State Management

- [ ] State transitions correct
- [ ] Formation updates reflect
- [ ] Process types handled
- [ ] Error states managed

## Test Scenarios

## Important Notes

- Restarts interrupt service temporarily
- Size changes require restart

## Error Cases

1. Invalid scale numbers

## Cleanup Steps

1. Reset dyno counts
2. Verify formation state
3. Check process types
