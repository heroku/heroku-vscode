import zlib from 'node:zlib';
import tar from 'tar-stream';
import vscode from 'vscode';
import { getRootRepository } from './git-utils';

/**
 *
 * @param workspaceFolder The workspace folder to create a tarball from
 * @returns an Uint8Array of the tarball
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
