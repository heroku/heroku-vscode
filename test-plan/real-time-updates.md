# 6.1 Log Stream Status Updates Testing

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- Active Heroku application attached to workspace
- At least 1 add-on provisioned
- Start a log session - this is not required for real-time updates but it will allow you to visualize events during
  testing

## Test Categories

### 1. Dyno State Changes

#### Process State Updates

1. Trigger dyno state changes using the context menu or dashboard:
   - Start dyno
   - Stop dyno
   - Restart dyno
2. Verify state change events are reflected in the Heroku Resource Explorer for the correct Dyno:
   - Starting (yellow)
   - Up (green)
   - Crashed (red)
   - Down (red)

#### Expected Results

- Real-time state updates in the Heroku Resource Explorer
- Correct icon updates for each state
- Proper event ordering
- Accurate timestamps

### 2. Formation Scaling Events

#### Manual Scaling

1. Initiate formation scale using the context menu or dashboard
2. Monitor log stream
3. Verify scaling events:
   - Scale initiation
   - Quantity updates
   - Completion status
4. Verify the newly scaled dyno quantity is reflected accurately in the Heroku Resource Explorer

#### Auto-scaling

1. Configure auto-scaling using the context menu (if available for your formation)
2. Generate load to trigger scaling
3. Verify scaling notifications

#### Expected Results

- `SCALED_TO` events captured
- Correct quantity reflected
- Formation view updates

### 3. Add-on Attachment Events

#### Provisioning Flow

1. Install new add-on
2. Monitor attachment events:
   - Provisioning started
   - Provisioning completed
   - Initial attachment
3. Verify status updates

#### Attachment Updates

1. Test attachment modifications
2. Monitor status changes
3. Verify:
   - ATTACHMENT_ATTACHED
   - ATTACHMENT_UPDATED
   - ATTACHMENT_DETACHED

#### Expected Results

- All attachment states captured
- Add-ons view updates
- Proper error handling
- Status reflection in UI

### 4. Process Management

#### Starting Process Events

1. Deploy new release
2. Monitor process starts
3. Verify process information:
   - Process type
   - Command
   - Dyno name

#### State Transitions

1. Track process lifecycle
2. Verify state sequences:
   - Starting → Up
   - Up → Crashed
   - Crashed → Starting

### 5. Formation Size Changes

#### Context Menu Size Selection

1. Locate target formation in Resource Explorer
2. Right-click to open context menu
3. Select "Change dyno sizes"
4. Verify QuickPick dialog shows:
   - Basic dynos (Free, Hobby)
   - Standard dynos (Standard-1X, Standard-2X)
   - Performance dynos (Performance-M, Performance-L)
   - Shield dynos

#### Size Change Process

1. Select new formation size
2. Monitor status updates:
   - Formation update initiated
   - Dyno shutdown events
   - New size application
   - Dyno restart events
3. Verify real-time updates in Resource Explorer:
   - Size indicator changes
   - Dyno state transitions
   - Status messages

#### Expected Results

- QuickPick shows all available sizes
- Current size clearly marked
- Real-time status updates during change
- Proper dyno restart sequence
- Final state reflects new size in the label

### Formation Size Change Scenarios

#### Upgrade Testing

1. Start from Basic tier
2. Upgrade to Standard-1X
3. Verify:
   - Proper shutdown sequence
   - Size change application
   - Clean restart
   - Updated size display
   - Dynos show green after restart

#### Downgrade Testing

1. Start from Standard-2X
2. Downgrade to Standard-1X
3. Verify:
   - Resource adjustment
   - Proper restart sequence
   - Updated pricing tier
   - Correct size indication

#### Multiple Dyno Testing

1. Test formation with multiple dynos
2. Change formation size
3. Verify:
   - All dynos update
   - Correct restart order
   - Consistent state updates
   - Explorer reflects all changes

#### Error Cases

1. Test with:
   - Insufficient permissions
   - Network interruption
   - Quota limits
   - Invalid size selections
2. Verify:
   - Error messages
   - State recovery
   - UI feedback
   - Dyno stability

## Test Scenarios

### Size Change Sequence

```typescript
// Test size change flow
await openContextMenu(dyno);
await selectChangeDynoSize();
await selectNewSize('Standard-1X');
await verifyStateTransitions(['updating', 'stopping', 'starting', 'up']);
```

### Multiple Dyno Updates

```typescript
// Test multiple dyno updates
await changeDynoSize('web', 'Performance-M');
await Promise.all([
  verifyDynoState('web.1', 'up'),
  verifyDynoState('web.2', 'up'),
  verifyFormationSize('web', 'Performance-M')
]);
```

### Validation Points

- [ ] Context menu available
- [ ] QuickPick shows all sizes
- [ ] Current size indicated
- [ ] Size change initiates
- [ ] Status updates show
- [ ] Dynos restart properly
- [ ] Final state correct
- [ ] Error handling works

### UI Elements

- [ ] Context menu option
- [ ] QuickPick dialog
- [ ] Size indicators
- [ ] Status messages
- [ ] Progress indication
- [ ] Error notifications

### Important Notes

- Size changes affect all dynos in formation
- Changes trigger automatic restarts
- Some sizes may be restricted by account type
- Multiple dynos restart in sequence

### Performance Metrics

- Time to show QuickPick with options retrieve from server
- Size change initiation speed
- Status update latency
- Total change completion time
- UI responsiveness during change

### Cleanup Steps

1. Reset to original size
2. Verify all dynos running
3. Check formation status
4. Clear status messages
5. Reset error states

## Validation Matrix

### Event Types

- [ ] STATE_CHANGED
- [ ] ATTACHMENT_ATTACHED
- [ ] ATTACHMENT_DETACHED
- [ ] ATTACHMENT_UPDATED
- [ ] PROVISIONING_COMPLETED
- [ ] SCALED_TO
- [ ] STARTING_PROCESS

### UI Updates

- [ ] Explorer tree refresh
- [ ] Status icons
- [ ] Tooltips
- [ ] Context menus

### Event Processing

- [ ] Regex parsing
- [ ] Event emission
- [ ] State tracking
- [ ] Buffer management

## Test Scenarios

### 1. Multiple Event Types

```typescript
// Test sequence
await startLogSession();
await scaleFormation();
await restartDyno();
await attachAddon();
```

### 2. Rapid State Changes

```typescript
// Quick succession
await Promise.all([restartDyno('web.1'), restartDyno('web.2'), scaleFormation('worker', 2)]);
```

### 3. Error Conditions

```typescript
// Test error handling
await simulateNetworkFailure();
await sendMalformedLogLine();
await testPartialBuffer();
```

## Important Notes

- Events must be processed in order
- Partial line buffering required
- State changes may be rapid
- Network resilience critical
- UI must remain responsive

## Cleanup Procedures

1. Stop all log sessions
2. Reset dyno states
3. Remove test add-ons
4. Clear event listeners
5. Reset UI state

## Performance Considerations

- Monitor memory usage
- Check CPU utilization
- Verify event processing speed
- Test UI responsiveness
