import { DeploymentStacksClient } from '@azure/arm-resourcesdeploymentstacks';
import { AzureCliCredential } from '@azure/identity';
import axios from 'axios';
import { Command, Option } from 'clipanion';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { archiveFolder } from 'zip-lib';

import { NodeBuildCommand, NodeJsBuildPlugin } from '../build-plugins/nodejs';
import { Configuration } from '../configuration';

export class InitCommand extends Command {
  static paths = [
    ['init'],
  ];

  resourceGroup = Option.String('-g,--resource-group');

  subscription = Option.String('-s,--subscription');

  resourcePrefix = Option.String('-p,--resource-prefix', 'bicep-assets');

  forceReevaluate = Option.Boolean('-f,--force', false, {
    description: 'Force a reevaluation/redeploy even if the concept is already initialized correctly',
  });

  private version: string;

  constructor() {
    super();
    const json = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));
    this.version = json.version;
  }

  async execute() {
    console.log('Setting up configuration...\n');
    const config = await Configuration.load(true, this.forceReevaluate);
    if (this.forceReevaluate === false) {
      const currentConfig = await this.getConfiguration(config.customResourceProviderId);
      if (currentConfig?.version === this.version) {
        console.log('Initialized correctly!');
        return;
      }
    }

    console.log();
    console.log('Configuration:');
    console.log(config);

    // console.log();
    // console.log('Deploying infra');
    // const outputs = await this.deployInfra(config, false);
    // console.log();
    // console.log('Deployment outputs:');
    // console.log(outputs);

    // if (outputs?.storageAccountName && typeof outputs.storageAccountName === 'object' && 'value' in outputs.storageAccountName && typeof outputs.storageAccountName.value === 'string') {
    //   config.storageAccountName = outputs.storageAccountName.value;
    // }

    // saveConfig(config);

    // console.log();
    // await this.uploadCustomResourceProviderPackage(config, (outputs as any).uploadCRPUrl.value!);

    // console.log();
    // console.log('Deploying infra (phase 2)');
    // await this.deployInfra(config, true);
  }

  async deployInfra(config: Configuration, execZipDeploy: boolean) {
    const creds = new AzureCliCredential();

    const client = new DeploymentStacksClient(creds, config.subscription);

    const result = await client.deploymentStacks.beginCreateOrUpdateAtResourceGroupAndWait(
      config.resourceGroup,
      `${config.resourcePrefix}-ds`,
      {
        properties: {
          actionOnUnmanage: {
            managementGroups: 'detach',
            resourceGroups: 'delete',
            resources: 'delete',
          },
          denySettings: {
            mode: 'none',
          },
          parameters: {
            resourcePrefix: { value: config.resourcePrefix },
            execZipDeploy: { value: execZipDeploy },
            version: { value: this.version },
          },
          template: JSON.parse(await readFile(resolve(__dirname, '../../res/bootstrap.json'), 'utf-8')),
        },
      },
    );
    return result.properties?.outputs;
  }

  async uploadCustomResourceProviderPackage(_config: Configuration, uploadCRPUrl: string) {
    const isJs = existsSync(resolve(__dirname, '../bicep-assets-crp/index.js'));

    const plugin = new NodeJsBuildPlugin();
    const build = new NodeBuildCommand('bicep-assets-crp', resolve(__dirname, `../bicep-assets-crp/index.${isJs ? 'js' : 'ts'}`), plugin);

    const tempFolder = await mkdtemp(tmpdir());
    const buildFolder = await mkdtemp(`${tmpdir()}-build`);
    try {
      await build.buildInFolder(buildFolder);

      console.log('Publishing custom resource provider code');
      const fileName = 'bicep-assets-crp.zip';
      await archiveFolder(buildFolder, join(tempFolder, fileName));

      const zipFile = await readFile(join(tempFolder, fileName));
      await axios.put(uploadCRPUrl, zipFile, {
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'x-ms-blob-type': 'BlockBlob',
        },
      });
    } finally {
      await rm(tempFolder, {
        recursive: true,
      });

      await rm(buildFolder, {
        recursive: true,
      });
    }
  }

  async getConfiguration(resourceProviderId: string): Promise<Record<string, string> | null> {
    try {
      const creds = new AzureCliCredential();
      const token = await creds.getToken(['https://management.azure.com/.default']);

      const res = await axios.post(`https://management.azure.com${resourceProviderId}/listConfiguration`, {}, {
        params: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'api-version': '2018-09-01-preview',
        },
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      });

      return res.data;
    } catch (_error) {
      return null;
    }
  }
}
