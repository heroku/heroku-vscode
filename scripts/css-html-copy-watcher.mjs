import { watch, cp, readdir } from 'node:fs/promises';
import path from 'node:path';

const [copyOnly] = process.argv.slice(2);
const dir = path.resolve('./src/webviews');
const target = /(html|css|svg|png|jpeg)$/;
const files = await readdir(dir, { recursive: true });

for (const file of files) {
  if (target.test(file)) {
    await cp(`./src/webviews/${file}`, `./out/webviews/${file}`);
  }
}

if (copyOnly) {
  process.exit(0);
}
const watcher = watch(dir, { recursive: true });

for await (const event of watcher) {
  const { eventType, filename } = event;
  if (target.test(filename)) {
    void cp(`./src/webviews/${filename}`, `./out/webviews/${filename}`);
  }
}
