import * as vscode from 'vscode';

const themeColor = new vscode.ThemeColor('hk.purple');
export const dynoIconsBySize = {
  Free: new vscode.ThemeIcon('hk-icon-dynomite-free-16', themeColor),
  Eco: new vscode.ThemeIcon('hk-icon-dynomite-eco-16', themeColor),
  Hobby: new vscode.ThemeIcon('hk-icon-dynomite-hobby-16', themeColor),
  Basic: new vscode.ThemeIcon('hk-icon-dynomite-basic-16', themeColor),
  'Standard-1X': new vscode.ThemeIcon('hk-icon-dynomite-default-16', themeColor),
  'Standard-2X': new vscode.ThemeIcon('hk-icon-dynomite-default-16', themeColor),
  '1X': new vscode.ThemeIcon('hk-icon-dynomite-1x-16', themeColor),
  '2X': new vscode.ThemeIcon('hk-icon-dynomite-2x-16', themeColor),
  PX: new vscode.ThemeIcon('hk-icon-dynomite-px-16', themeColor),
  'Performance-M': new vscode.ThemeIcon('hk-icon-dynomite-pm-16', themeColor),
  Performance: new vscode.ThemeIcon('hk-icon-dynomite-ps-16', themeColor),
  'Performance-L': new vscode.ThemeIcon('hk-icon-dynomite-pl-16', themeColor),
  'Performance-L-RAM': new vscode.ThemeIcon('hk-icon-dynomite-pl-16', themeColor),
  'Performance-XL': new vscode.ThemeIcon('hk-icon-dynomite-px-pl-16', themeColor),
  'Performance-2XL': new vscode.ThemeIcon('hk-icon-dynomite-px-pl-16', themeColor)
};
