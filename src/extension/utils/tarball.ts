import zlib from 'node:zlib';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import vscode from 'vscode';
import * as tar from 'tar-stream';
import { HerokuCommand } from '../commands/heroku-command';
import { logExtensionEvent } from './logger';

/**
 * Creates a compressed tarball (tar.gz) from the contents of a workspace folder.
 * The function respects git ignore rules and excludes node_modules directory.
 *
 * @param root - The workspace folder to create a tarball from
 * @param signal - An optional AbortSignal to abort the operation
 * @returns A Promise that resolves to a Uint8Array containing the compressed tarball data
 *
 * @example
 * const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
 * if (workspaceFolder) {
 *   const tarballData = await packSources(workspaceFolder);
 * }
 *
 * - Files in node_modules are automatically excluded
 * - Files matched by .gitignore rules are excluded
 * - File paths in the archive are relative to the workspace root
 * - The function uses streaming to handle large directories efficiently
 *
 * @throws {Error} If unable to read workspace files or create the tarball
 */
export async function packSources(root: vscode.Uri, signal?: AbortSignal): Promise<Uint8Array> {
  const files = await getSourceFilePaths(root, signal);

  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const chunks: Buffer[] = [];

  gzip.on('data', (chunk) => chunks.push(chunk as Buffer));

  pack.pipe(gzip);

  for (const file of files) {
    const content = await readFile(file);
    const relativePath = vscode.workspace.asRelativePath(file, false);
    pack.entry({ name: relativePath }, Buffer.from(content));
  }

  pack.finalize();
  await new Promise((resolve) => gzip.on('end', resolve));
  return Buffer.concat(chunks);
}

/**
 * Gets the source files within the provided git repo
 *
 * @param root The root directory of the git repo to get files for
 * @param signal The abort signal to cancel the operation
 * @returns A list of file paths to be included in the tarball
 *
 * @example
 * const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
 */
export async function getSourceFilePaths(root: vscode.Uri, signal?: AbortSignal): Promise<string[]> {
  // git command to list all tracked files and directories
  // that do not match the patterns in the .gitignore
  const gitProcess = HerokuCommand.exec('git ls-files -c -o --exclude-standard', { cwd: root.fsPath, signal });
  const result = await HerokuCommand.waitForCompletion(gitProcess);
  const paths = result.output.toString().split('\n').filter(Boolean);

  const allFiles: string[] = [];

  for (const p of paths) {
    const fullPath = path.join(root.fsPath, p);
    try {
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        // Recursively get all files in directory
        const files = await walkDirectory(fullPath);
        allFiles.push(...files);
      } else {
        allFiles.push(fullPath);
      }
    } catch (error) {
      logExtensionEvent(`Failed to process path: ${fullPath}`);
    }
  }

  return allFiles;
}

/**
 * Walks a directory and returns a list of all files within it
 *
 * @param dir The directory to walk
 * @returns A list of file paths within the directory
 *
 * @example
 * const files = await walkDirectory('/path/to/directory');
 */
async function walkDirectory(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await walkDirectory(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    logExtensionEvent(`Failed to walk directory: ${dir}`);
  }

  return files;
}
