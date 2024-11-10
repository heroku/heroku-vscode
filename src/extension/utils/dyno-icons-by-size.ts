import * as vscode from 'vscode';

const themeColor = new vscode.ThemeColor('hk.purple');
export const dynoIconsBySize: Readonly<Record<string, vscode.ThemeIcon>> = {
  Free: new vscode.ThemeIcon('hk-icon-dynomite-free-16', themeColor),
  Eco: new vscode.ThemeIcon('hk-icon-dynomite-eco-16', themeColor),
  Hobby: new vscode.ThemeIcon('hk-icon-dynomite-hobby-16', themeColor),
  Basic: new vscode.ThemeIcon('hk-icon-dynomite-basic-16', themeColor),
  'Standard-1X': new vscode.ThemeIcon('hk-icon-dynomite-default-16', themeColor),
  'Standard-2X': new vscode.ThemeIcon('hk-icon-dynomite-default-16', themeColor),
  '1X': new vscode.ThemeIcon('hk-icon-dynomite-1x-16', themeColor),
  '2X': new vscode.ThemeIcon('hk-icon-dynomite-2x-16', themeColor),
  PX: new vscode.ThemeIcon('hk-icon-dynomite-px-16', themeColor),
  'Private-S': new vscode.ThemeIcon('hk-icon-dynomite-space-ps-16', themeColor),
  'Private-M': new vscode.ThemeIcon('hk-icon-dynomite-space-pm-16', themeColor),
  'Private-L': new vscode.ThemeIcon('hk-icon-dynomite-space-pl-16', themeColor),
  'Private-L-RAM': new vscode.ThemeIcon('hk-icon-dynomite-space-pl-16', themeColor),
  'Private-XL': new vscode.ThemeIcon('hk-icon-dynomite-space-pl-16', themeColor),
  'Private-2XL': new vscode.ThemeIcon('hk-icon-dynomite-space-pl-16', themeColor),
  Performance: new vscode.ThemeIcon('hk-icon-dynomite-ps-16', themeColor),
  'Performance-M': new vscode.ThemeIcon('hk-icon-dynomite-pm-16', themeColor),
  'Performance-L': new vscode.ThemeIcon('hk-icon-dynomite-pl-16', themeColor),
  'Performance-L-RAM': new vscode.ThemeIcon('hk-icon-dynomite-pl-16', themeColor),
  'Performance-XL': new vscode.ThemeIcon('hk-icon-dynomite-pl-16', themeColor),
  'Performance-2XL': new vscode.ThemeIcon('hk-icon-dynomite-2x-16', themeColor),
  'Shield-S': new vscode.ThemeIcon('hk-icon-dynomite-shield-ps-16', themeColor),
  'Shield-M': new vscode.ThemeIcon('hk-icon-dynomite-shield-pm-16', themeColor),
  'Shield-L': new vscode.ThemeIcon('hk-icon-dynomite-shield-pl-16', themeColor),
  'Shield-XL': new vscode.ThemeIcon('hk-icon-dynomite-shield-pl-16', themeColor),
  'Shield-2XL': new vscode.ThemeIcon('hk-icon-dynomite-shield-pl-16', themeColor)
};

export const herokuDynoSizes: Readonly<Record<string, { description: string; icon: vscode.ThemeIcon }>> = {
  Eco: {
    description: 'Low-cost, sleeps after inactivity.',
    icon: dynoIconsBySize.Eco
  },
  Basic: {
    description: 'Simple, no advanced features.',
    icon: dynoIconsBySize.Basic
  },
  'Standard-1X': {
    description: 'Moderate workload, 512 MB RAM.',
    icon: dynoIconsBySize['Standard-1X']
  },
  'Standard-2X': {
    description: 'Larger apps, 1 GB RAM.',
    icon: dynoIconsBySize['Standard-2X']
  },
  'Performance-M': {
    description: 'High-demand, 2.5 GB RAM.',
    icon: dynoIconsBySize['Performance-M']
  },
  'Performance-L': {
    description: 'Resource-intensive, 14 GB RAM.',
    icon: dynoIconsBySize['Performance-L']
  },
  'Performance-XL': {
    description: 'Large-scale, 62 GB RAM.',
    icon: dynoIconsBySize['Performance-XL']
  },
  'Performance-2XL': {
    description: 'Maximum resources, 126 GB RAM.',
    icon: dynoIconsBySize['Performance-2XL']
  },
  'Private-M': {
    description: 'Isolated, 2.5 GB RAM.',
    icon: dynoIconsBySize['Private-M']
  },
  'Private-L': {
    description: 'Demanding apps, 14 GB RAM.',
    icon: dynoIconsBySize['Private-L']
  },
  'Private-L-RAM': {
    description: 'High-memory isolated environment.',
    icon: dynoIconsBySize['Private-L-RAM']
  },
  'Private-XL': {
    description: 'High-performance, 62 GB RAM.',
    icon: dynoIconsBySize['Private-XL']
  },
  'Private-2XL': {
    description: 'Maximum isolation, 126 GB RAM.',
    icon: dynoIconsBySize['Private-2XL']
  },
  'Shield-S': {
    description: 'HIPAA-compliant, 1 GB RAM.',
    icon: dynoIconsBySize['Shield-S']
  },
  'Shield-M': {
    description: 'HIPAA-compliant, 2.5 GB RAM.',
    icon: dynoIconsBySize['Shield-M']
  },
  'Shield-L': {
    description: 'Secure, 14 GB RAM.',
    icon: dynoIconsBySize['Shield-L']
  },
  'Shield-XL': {
    description: 'Large-scale compliance, 62 GB RAM.',
    icon: dynoIconsBySize['Shield-XL']
  },
  'Shield-2XL': {
    description: 'Top-tier compliance, 126 GB RAM.',
    icon: dynoIconsBySize['Shield-2XL']
  }
};
