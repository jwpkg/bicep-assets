import { Command, Option } from 'clipanion';
import { hashElement } from 'folder-hash';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join, resolve, extname } from 'path';

import { CopyBuildPlugin } from '../build-plugins/copy';
import { NodeJsBuildPlugin } from '../build-plugins/nodejs';
import { ViteBuildPlugin } from '../build-plugins/vite';
import { Configuration } from '../configuration';
import { Manifest } from '../utils/manifest';
import { IBuildCommand, PluginManager } from '../utils/plugin-manager';

export class BuildCommand extends Command {
  static paths = [
    ['build'],
  ];

  outFolder = Option.String('--output,-o', '.bicep-assets', {
    description: 'The output folder for the assets. Defaults to .bicep-assets',
  });

  static usage = Command.Usage({
    description: 'Build the assets for the bicep template',
    details: `
      This command will build the assets for the bicep template. 
      It will generate a distribution folder with all assets.
    `,
  });

  async execute() {
    const configuration = await Configuration.load(false);
    const pluginManager = new PluginManager();

    pluginManager.register('nodejs', new NodeJsBuildPlugin());
    pluginManager.register('vite', new ViteBuildPlugin());
    pluginManager.register('copy', new CopyBuildPlugin());

    const commands = await pluginManager.load(configuration.assets);

    const manifestContent: Manifest = {
      // resourceProviderId: configuration.customResourceProviderId,
      storageAccountName: configuration.storageAccountName,
      subscription: configuration.subscription,
      resourceGroup: configuration.resourceGroup,
      assets: {},
    };

    for (const command of commands) {
      const hash = await this.execBuild(command, this.outFolder);
      manifestContent.assets[command.name] = hash ?? 'ERROR';
    }

    await mkdir(this.outFolder, {
      recursive: true,
    });
    await writeFile(join(this.outFolder, 'manifest.json'), JSON.stringify(manifestContent, null, 2), 'utf-8');

    const bicepContent = this.generateBicep(manifestContent, this.outFolder);
    await writeFile(join('bicep-assets.bicep'), bicepContent, 'utf-8');
  }

  async execBuild(command: IBuildCommand, outputFolder: string) {
    await mkdir(outputFolder, {
      recursive: true,
    });
    const tempFolder = await mkdtemp(resolve(join(outputFolder, 'tmp-asset-')));
    try {
      const result = await command.buildInFolder(tempFolder);
      const hash = (await hashElement('.', tempFolder, {
        encoding: 'hex',

      })).hash;

      let filename = hash;

      if (typeof result === 'string') {
        const extension = extname(result);
        if (extension.length > 1) {
          filename = filename + extension;
        }
      }

      const output = join(outputFolder, filename);
      if (existsSync(output)) {
        await this.retry(rm(output, {
          recursive: true,
        }));
      }

      if (typeof result === 'string') {
        await this.retry(rename(result, join(outputFolder, filename)));
        await this.retry(rm(tempFolder, {
          recursive: true,
        }));
      } else {
        await this.retry(rename(tempFolder, join(outputFolder, filename)));
      }

      return filename;
    } catch (error) {
      await this.retry(rm(tempFolder, {
        recursive: true,
      }));
      throw error;
    }
  }

  async retry<T>(command: Promise<T>): Promise<T> {
    const backOffInterval = 1000; // 1 second
    let retry = 0;
    let lastError: Error | undefined = undefined;
    while (retry < 3) {
      try {
        return await command;
      } catch (error) {
        retry++;
        await new Promise(resolve => setTimeout(resolve, backOffInterval * retry));
        if (retry >= 3) {
          lastError = error as Error;
          break;
        }
      }
    }
    throw lastError;
  }

  generateBicep(manifestContent: Manifest, outFolder: string) {
    if (Object.keys(manifestContent.assets).length === 0) {
      return '';
    }

    const assets = Object.entries(manifestContent.assets).map(([k, v]) => {
      const stats = statSync(join(outFolder, v));
      const filename = stats.isDirectory() ? `${v}.zip` : v;

      // return `${k.replace(/[-.]/g, '_')}: {
      //   resourceProviderId: '${manifestContent.resourceProviderId}'
      //   filename: '${filename}'
      // }`;
      return `${k.replace(/[-.]/g, '_')}: {
        subscription: '${manifestContent.subscription}'
        resourceGroup: '${manifestContent.resourceGroup}'
        storageAccountName: '${manifestContent.storageAccountName}'
        containerName: 'assets'
        filename: '${filename}'
      }`;
    });

    return `

@export()
type Asset = {
  storageAccountName: string
  subscription: string
  resourceGroup: string
  containerName: string
  filename: string
}
    
@export() 
var assets = {
  ${assets.join('\n ')}
}
`;
  }
}
