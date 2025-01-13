# 5.1 Log Session Testing

## Prerequisites

- VS Code with extension installed
- Authenticated Heroku session
- At least one active Heroku application
- VS Code Output panel accessible

## Test Cases

### 1. Session Initialization Methods

#### Context Menu Invocation

1. Locate app in Heroku Apps Explorer
2. Right-click to open context menu
3. Select "Start Log Session"
4. Verify output channel opens

#### Inline Button

1. Find app in Heroku Resource Explorer
2. Click log stream button (text-icon)
3. Verify session initialization in VSCode drawer

#### Expected Results

- Output channel in the drawer opens automatically
- Channel shows "Log session started for {app-name}" at first line
- Real-time logs begin streaming
- Proper channel focus

### 2. Log Stream Functionality

#### Basic Streaming

1. Start log session
2. Monitor real-time log output
3. Verify log format:
   - Timestamps
   - Log levels
   - Source identifiers
   - Message content

#### Multiple Sessions

1. Start log session for App A
2. Start log session for App B
3. Toggle between sessions
4. Verify buffer retention

#### Expected Results

- One panel for each app with active log streams
- Previous session looses focus when new one starts
- Buffer includes the first 100 lines per session (if available)
- Proper session switching

### 3. Session Control

#### Mute/Unmute

1. Start log session
2. Test mute functionality:
   - Through context menu ("End log session" context menu item)
   - Via inline button
3. Verify real-time updates still work after log stream session is stopped
4. Test unmute functionality
5. Verify output resumes

#### Session Termination

1. Start log session
2. Test termination methods:
   - Context menu "End log session"
   - Inline stop button

## Validation Points

### Stream Management

- [ ] Session initializes properly
- [ ] Real-time streaming works
- [ ] Buffer limit enforced (100 lines)
- [ ] Proper session switching
- [ ] Mute/unmute functions
- [ ] Clean termination

### UI Integration

- [ ] Context menu options work
- [ ] Inline buttons function
- [ ] Output channel management
- [ ] Visual feedback accurate

### Error Handling

- [ ] Network errors handled
- [ ] Permission errors shown
- [ ] Heartbeat timeout works
- [ ] Reconnection attempts are made when network failure or socket timeout occur

## Command Reference

```typescript
// Start log session
vscode.commands.executeCommand('heroku:start-log-session', app, muted, lines)

// Session duration
private logSessionDuration = 15 * 60 * 1000; // 15 minutes

// Buffer size
private maxLines = 100;
```

## Important Notes

- Streams timeout after 15 minutes but will be restart
- Buffer limited to 100 lines
- Muted sessions continue streaming for real-time updates to function
- Network issues or stream termination triggers a heartbeat timeout

## Context Menu Options

- "Start Log Session"
- "End log Session"

## Inline Buttons

- Text icon: Start session
- Disconnect icon: End session

## Cleanup Steps

1. Stop all active log sessions
2. Clear output channel
3. Verify no lingering connections
4. Reset mute states
