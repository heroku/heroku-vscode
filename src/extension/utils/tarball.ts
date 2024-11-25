import zlib from 'node:zlib';
import vscode from 'vscode';
import * as tar from 'tar-stream';
import { getRootRepository } from './git-utils';

/**
 * Creates a compressed tarball (tar.gz) from the contents of a workspace folder.
 * The function respects git ignore rules and excludes node_modules directory.
 *
 * @param workspaceFolder - The workspace folder to create a tarball from
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
export async function packSources(workspaceFolder: vscode.WorkspaceFolder): Promise<Uint8Array> {
  const rootRepository = await getRootRepository();

  const include = new vscode.RelativePattern(workspaceFolder, '**/*');
  const exclude = new vscode.RelativePattern(workspaceFolder, '**/node_modules/**');

  const files = await vscode.workspace.findFiles(include, exclude);
  const ignored = await rootRepository?.checkIgnore(files.map((file) => file.fsPath));

  const pack = tar.pack();
  const gzip = zlib.createGzip();
  const chunks: Buffer[] = [];

  gzip.on('data', (chunk) => chunks.push(chunk as Buffer));

  pack.pipe(gzip);

  for (const file of files) {
    if (ignored?.has(file.fsPath)) {
      continue;
    }
    const content = await vscode.workspace.fs.readFile(file);
    const relativePath = vscode.workspace.asRelativePath(file, false);
    pack.entry({ name: relativePath }, Buffer.from(content));
  }

  pack.finalize();
  await new Promise((resolve) => gzip.on('end', resolve));
  return Buffer.concat(chunks);
}
