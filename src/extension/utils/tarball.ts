import zlib from 'node:zlib';
import vscode from 'vscode';
import * as tar from 'tar-stream';
import { HerokuCommand } from '../commands/heroku-command';

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
  const include = new vscode.RelativePattern(root, '**/*');
  const exclude = new vscode.RelativePattern(root, '**/node_modules/**');

  const files = await vscode.workspace.findFiles(include, exclude);
  const gitProcess = HerokuCommand.exec('git check-ignore --no-index --stdin', { cwd: root.fsPath, signal });
  gitProcess.stdin?.write(files.map((file) => file.fsPath).join('\n'));
  gitProcess.stdin?.end();
  const result = await HerokuCommand.waitForCompletion(gitProcess);
  const ignored = result.output
    .toString()
    .split('\n')
    .filter(Boolean)
    .reduce((set, path) => {
      set.add(path);
      return set;
    }, new Set());

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
