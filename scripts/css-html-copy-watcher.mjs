import { watch, cp, readdir } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve('./src/webviews');
const target = /(html|css)$/;
const files = await readdir(dir, { recursive: true });
files.forEach((file) => {
  if (target.test(file)) {
    void cp(`./src/webviews/${file}`, `./out/webviews/${file}`);
  }
});

const watcher = watch(dir, { recursive: true });

for await (const event of watcher) {
  const { eventType, filename } = event;
  if (target.test(filename)) {
    void cp(`./src/webviews/${filename}`, `./out/webviews/${filename}`);
  }
}
