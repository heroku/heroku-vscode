import { exec } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as resolve from 'resolve.exports';
import packageLock from '../package-lock.json' assert {type:'json'}

/**
 * Finds the ESM entry point for a package based
 * on the specified path of the package.json.
 *
 * The value returned is the esm path relative
 * to the project root.
 *
 * @param {string} pjsonRootPath The root directory expected to contain the package.json
 * @returns string The path of the esm entry for the specified package.json path
 */
async function findEsmEntry(pjsonRootPath) {
  const pjsonBytes = await readFile(path.join(pjsonRootPath, 'package.json'));
  const pjson = JSON.parse(pjsonBytes.toString());

  if (pjson.exports) {
    const result = resolve.exports(pjson, '.', { conditions: ['import'], unsafe: true });
    if (result) {
      return path.join(pjsonRootPath, result[0]);
    }
  }
  return pjson.module ?? pjson.main ? path.join(pjsonRootPath, pjson.module ?? pjson.main) : null;
}

/**
 * Gets the dependencies, the module specified and esm entry
 * for the specified file path. The file path can be any relative
 * path to a file in node_modules. This path is usually generated
 * from the `tsc --listFiles` command.
 *
 * @param {string} filePath The path of a dependency to fnd the package-lock entry for
 * @returns {dependencies: Record<string, string>, moduleSpecifier: string, esmEntry: string} | null
 */
async function getPackageInfo(filePath) {
  if (filePath.includes('@types/')) {
    return null;
  }
  const createInfoObject = async (targetPath) => {
    const moduleSpecifier = targetPath.replace('node_modules/', '');
    const esmEntry = await findEsmEntry(targetPath);

    return { dependencies: packageLock.packages[targetPath].dependencies, moduleSpecifier, esmEntry };
  };

  if (packageLock.packages[filePath]) {
    return await createInfoObject(filePath);
  }

  const fragments = filePath.split('/');
  let i = fragments.length;
  while (i--) {
    const targetPath = fragments.slice(0, i).join('/');
    if (targetPath && packageLock.packages[targetPath]) {
      return await createInfoObject(targetPath);
    }
  }
  return null;
}

/**
 * Adds and entry into the import map object
 * based on the resolved path of a source file
 * that will be used in the project.
 *
 * @param {string} resolvedFilePath
 * @returns void
 */
async function addImportMapEntry(resolvedFilePath) {
  const packageInfo = await getPackageInfo(resolvedFilePath);
  if (!packageInfo) {
    return;
  }
  const { dependencies, moduleSpecifier, esmEntry } = packageInfo;
  if (!esmEntry || !moduleSpecifier || importMap.has(moduleSpecifier)) {
    return;
  }
  importMap.set(moduleSpecifier, packageInfo);
  if (dependencies) {
    for (const dependency in dependencies) {
      await addImportMapEntry(`node_modules/${dependency}`)
    }
  }
}

/**
 * Gets the list of files that are part
 * of the compilation.
 *
 * @see https://www.typescriptlang.org/tsconfig/#listFiles
 */
const tscOutput = await new Promise(resolve => {
  let buffer = '';
  const tscProcess = exec('tsc --listFiles -p src/webviews/tsconfig.json');
  tscProcess.stdout.addListener('data', (data) => {
    buffer += data;
  });

  tscProcess.addListener('exit', () => {
    resolve(buffer)
  });
});

const importMap = new Map();
const files = tscOutput.split('\n')
  .filter(fileName => fileName.startsWith(process.cwd()))
  .map(fileName => fileName.substring(process.cwd().length + 1));

for (const fileName of files) {
  if (fileName.includes('@types')) {
    continue;
  }
  await addImportMapEntry(fileName);
}
const importMapJson = {imports: {}}
for (const importEntry of importMap) {
  const [moduleSpecifier, {esmEntry}] = importEntry;
  importMapJson.imports[moduleSpecifier] = esmEntry;
}
await writeFile(path.join('src', 'extension', 'importmap.json'), JSON.stringify(importMapJson, undefined, 2));
