import { AzureCliCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { Command, Option } from 'clipanion';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as t from 'typanion';
import { archiveFolder } from 'zip-lib';

import { isManifest } from '../utils/manifest';

export class UploadCommand extends Command {
  static paths = [
    ['upload'],
  ];

  distFolder = Option.String('--dist-folder', '.bicep-assets');
  asset = Option.String('-a', {
    required: true,
  });
  targetContainer = Option.String('-c', {
    required: true,
  });
  targetBlob = Option.String('-b', {
    required: true,
  });
  targetAccount = Option.String('-s', {
    required: true,
  });

  async execute() {
    this.cli.run(['build']);

    const manifestFile = join(this.distFolder, 'manifest.json');

    if (!existsSync(manifestFile)) {
      throw new Error(`No asset file found in dit folder: '${this.distFolder}'`);
    }

    const manifestContent = JSON.parse(await readFile(manifestFile, 'utf-8'));

    t.assert(manifestContent, isManifest);

    const blobServiceClient = new BlobServiceClient(
      `https://${this.targetAccount}.blob.core.windows.net`,
      new AzureCliCredential(),
    );

    const client = blobServiceClient.getContainerClient(this.targetContainer);
    await client.createIfNotExists();

    const assetHash = manifestContent.assets[this.asset];
    if (!assetHash) {
      throw new Error('Invalid upload asset');
    }

    const tempFolder = await mkdtemp(tmpdir());
    try {
      console.log(`Publishing asset: ${assetHash} (${this.asset})`);
      const fileName = this.targetBlob;
      await archiveFolder(join(this.distFolder, assetHash), join(tempFolder, fileName));

      const content = await readFile(join(tempFolder, fileName));
      await client.uploadBlockBlob(fileName, content, content.length);
    } finally {
      await rm(tempFolder, {
        recursive: true,
      });
    }
  }
}
