# 1.1 Extension Installation

## Prerequisites

- **VS Code**: 1.60.0 or higher
- **Node.js**: 22.x or higher
- **npm**: 10.x or higher

## Building the VSIX

### 1. Clone Repository

```bash
git clone https://github.com/heroku/heroku-vscode
cd heroku-vscode
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Extension

```bash
npm run compile
```

### 4. Package Extension

```bash
npm install -g @vscode/vsce
vsce package
```

_This creates `heroku-vscode-<version>.vsix` in root directory_

## Test Cases

### 1. VSIX Installation

#### Steps

1. Open VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
3. Type "Install from VSIX"
4. Navigate to generated `.vsix` file
5. Select and confirm installation

#### Expected Results

- Installation completes without errors
- No warning messages displayed

### 2. Extension Verification

#### Steps

1. Open Extensions panel (`Ctrl+Shift+X` or `Cmd+Shift+X`)
2. Search for "Heroku" or "unknown publisher" (in the case of an unsigned build)
3. Observe a Heroku icon in the vscode Activity Bar

#### Expected Results

- Extension listed in installed extensions
- Correct version number displayed
- Publisher and description accurate
- Verify the Heroku icon in the Activity Bar is present and clickable

### 3. Command palette contains Heroku commands

#### Steps

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Heroku"

#### Expected Results

- Heroku commands appear in palette

## Validation Checklist

- VSIX builds successfully
- Installation completes
- Extension visible in VS Code
- Version number correct
- Activation successful
- Commands available

## Cleanup Procedures

### 1. Extension Removal

1. Open Extensions panel
2. Click on the extension
3. Select "Uninstall"
4. Reload VS Code

### 2. Data Cleanup

#### Windows

```bash
rm -rf %USERPROFILE%\.vscode\extensions\heroku-vscode*
```

#### macOS/Linux

```bash
rm -rf ~/.vscode/extensions/heroku-vscode*
```

## Important Notes

- **Documentation**: Record all installation errors
- **Platform Testing**: Verify on all supported OS
- **VS Code Versions**: Test on stable and insiders
- **Updates**: Verify load after VS Code updates
