import { AzureCliCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { Command, Option } from 'clipanion';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as t from 'typanion';
import { archiveFolder } from 'zip-lib';

import { Configuration } from '../configuration';
import { isManifest } from '../utils/manifest';

export class DeployCommand extends Command {
  static paths = [
    ['deploy'],
  ];

  static usage = Command.Usage({
    description: 'Deploys the assets to the storage account',
    details: `
      This command will deploy the assets in the dist folder to the storage account.
    `,
  });

  distFolder = Option.String('--dist-folder', '.bicep-assets');

  executeBuild = Option.Boolean('--build', true);

  async execute() {
    if (this.executeBuild) {
      await this.cli.run(['build']);
    }

    const manifestFile = join(this.distFolder, 'manifest.json');

    if (!existsSync(manifestFile)) {
      throw new Error(`No asset file found in dit folder: '${this.distFolder}'`);
    }

    const manifestContent = JSON.parse(await readFile(manifestFile, 'utf-8'));

    t.assert(manifestContent, isManifest);


    for (const [name, fileName] of Object.entries(manifestContent.assets)) {
      const stat = statSync(join(this.distFolder, fileName));
      const targetFileName = stat.isDirectory() ? `${fileName}.zip` : fileName;

      await this.uploadAsset(name, fileName, targetFileName, stat.isDirectory());
    }
  }

  async uploadAsset(name: string, fileName: string, targetFileName: string, compress: boolean) {
    const configuration = await Configuration.load(false);
    const creds = new AzureCliCredential();

    const blobServiceClient = new BlobServiceClient(
      `https://${configuration.storageAccountName}.blob.core.windows.net`,
      creds,
    );

    const containerClient = blobServiceClient.getContainerClient('assets');

    const tempFolder = await mkdtemp(tmpdir());
    try {
      console.log(`Publishing asset: ${fileName} (${name})`);
      if (compress) {
        await archiveFolder(join(this.distFolder, fileName), join(tempFolder, targetFileName));

        const zipFile = await readFile(join(tempFolder, targetFileName));

        containerClient.uploadBlockBlob(targetFileName, zipFile, zipFile.length);
      } else {
        const content = await readFile(join(this.distFolder, fileName));
        containerClient.uploadBlockBlob(targetFileName, content, content.length);
      }
    } finally {
      await rm(tempFolder, {
        recursive: true,
      });
    }
  }
}
