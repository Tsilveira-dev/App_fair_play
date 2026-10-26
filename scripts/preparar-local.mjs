import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';

try {
  await copyFile(new URL('../.env.example', import.meta.url),
    new URL('../.env.local', import.meta.url), constants.COPYFILE_EXCL);
  console.log('.env.local criado. Preencha somente as chaves de TESTE nesse arquivo ignorado pelo Git.');
} catch (erro) {
  if (erro.code !== 'EEXIST') throw erro;
  console.log('.env.local já existe e foi preservado.');
}
