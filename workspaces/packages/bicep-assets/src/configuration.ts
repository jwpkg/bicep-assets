import { Subscription, SubscriptionClient } from '@azure/arm-resources-subscriptions';
import { ResourceGroup, ResourceManagementClient } from '@azure/arm-resources';
import { AzureCliCredential } from '@azure/identity';
import { prompt } from 'enquirer';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as t from 'typanion';
import YAML from 'yaml';

export const defaultConfigFile = 'bicep-assets-config.yaml';

export const isSubscription = t.cascade(t.isString(), t.isUUID4());
export const isResourceGroup = t.isString();

export const isAssetConfiguration = t.isObject({
  path: t.isString(),
  name: t.isOptional(t.isString()),
  plugin: t.isOptional(t.isString()),
});

export const isConfiguration = t.isObject({
  subscription: isSubscription,
  resourceGroup: isResourceGroup,
  storageAccountName: t.isString(),
  resourcePrefix: t.isOptional(t.isString()),
  assets: t.isOptional(t.isArray(t.isOneOf([
    t.isString(),
    isAssetConfiguration,
  ]))),
});

export type ConfigurationOptions = t.InferType<typeof isConfiguration>;
export type DefinedConfig = Required<ConfigurationOptions>;

type PartialConfig = Partial<ConfigurationOptions>;

export interface AssetDefinition {
  path: string;
  plugin: string;
  name: string;
}

export function makeDefined(config: ConfigurationOptions): DefinedConfig {
  return {
    resourcePrefix: 'bicep-assets',
    assets: [],
    ...config,
  };
}

export async function loadConfig(): Promise<DefinedConfig> {
  const data = await readFile(defaultConfigFile, 'utf-8');
  const parsed = YAML.parse(data);
  if (isConfiguration(parsed)) {
    return makeDefined(parsed);
  }
  throw new Error('Invalid configuration file found');
}

export async function saveConfig(config: Configuration, cwd?: string) {
  return savePartialConfig(config, cwd);
}

async function savePartialConfig(config: PartialConfig, _cwd?: string) {
  const yamlData = YAML.stringify(config);
  const data = `# yaml-language-server: $schema=https://raw.githubusercontent.com/jwpkg/bicep-assets/refs/heads/release/main/json-schema.json
${yamlData}`;
  await writeFile(defaultConfigFile, data, 'utf-8');
}

const STORAGE_ACCOUNT_TAG_NAME = 'bicep-assets-storage-account-name';
export class Configuration {
  subscription: string;
  resourceGroup: string;
  storageAccountName: string;
  assets: AssetDefinition[];

  constructor(options: DefinedConfig) {
    this.subscription = options.subscription;
    this.resourceGroup = options.resourceGroup;
    this.storageAccountName = options.storageAccountName;
    this.assets = options.assets?.map(assetDefinition => {
      if (typeof assetDefinition === 'string') {
        return {
          path: assetDefinition,
          plugin: 'copy',
          name: this.sanitizedName(assetDefinition),
        };
      } else {
        return {
          plugin: 'copy',
          name: this.sanitizedName(assetDefinition.path),
          ...assetDefinition,
        };
      }
    }) ?? [];
  }

  private sanitizedName(name: string) {
    return name
      .replace(/[/-]/g, '_')
      .replace(/_$/, '')
      .replace(/^_/, '');
  }

  static async load(interactive: boolean, reevaluate: boolean = false): Promise<Configuration> {
    const exists = existsSync(defaultConfigFile);
    const data = exists ? await readFile(defaultConfigFile, 'utf-8') : '';
    const config = exists ? YAML.parse(data) as PartialConfig : {};

    if (isConfiguration(config) && !reevaluate) {
      return new Configuration(makeDefined(config));
    }

    if (!isSubscription(config.subscription) && interactive || reevaluate) {
      config.subscription = await this.lookupSubscription(config);
    } else {
      throw new Error('Invalid configuration');
    }

    if (!t.isString()(config.resourceGroup) && interactive || reevaluate) {
      const rg = await this.lookupResourceGroup(config.subscription!, config);
      config.resourceGroup = rg.name;
      if (typeof rg.tags?.[STORAGE_ACCOUNT_TAG_NAME] === 'string') {
        config.storageAccountName = rg.tags[STORAGE_ACCOUNT_TAG_NAME];
      }
    } else {
      throw new Error('Invalid configuration');
    }

    if (!t.isString()(config.storageAccountName) && interactive || reevaluate) {
      const storageAccountName = await prompt<any>({
        name: 'storageAccountName',
        type: 'input',
        message: 'Specify storage account name',
        initial: config.storageAccountName,
      });
      config.storageAccountName = storageAccountName.storageAccountName;

      await savePartialConfig(config);
    } else {
      throw new Error('Invalid configuration');
    }

    return new Configuration(makeDefined(config as ConfigurationOptions));
  }

  static async lookupSubscription(current?: PartialConfig) {
    const creds = new AzureCliCredential();

    const client = new SubscriptionClient(creds);
    const subscriptions: Subscription[] = [];

    for await (const subscription of client.subscriptions.list()) {
      subscriptions.push(subscription);
    }

    const initial = subscriptions.findIndex(s => s.id === current?.subscription);

    const result = await prompt<any>({
      name: 'subscription',
      type: 'autocomplete',
      message: 'Specify subscription',
      choices: subscriptions.map(s => ({
        message: `${s.subscriptionId} (${s.displayName})`,
        name: `${s.subscriptionId}`,
      })),
      initial: initial === -1 ? undefined : initial,
    });

    await savePartialConfig({
      ...current,
      subscription: result.subscription,
    });

    return result.subscription;
  }

  static async lookupResourceGroup(subscriptionId: string, current?: PartialConfig): Promise<ResourceGroup> {
    const creds = new AzureCliCredential();

    const client = new ResourceManagementClient(creds, subscriptionId);
    const resourceGroups: ResourceGroup[] = [];

    for await (const resourceGroup of client.resourceGroups.list()) {
      resourceGroups.push(resourceGroup);
    }

    const initial = resourceGroups.findIndex(r => r.name === current?.resourceGroup);


    const result = await prompt<any>({
      name: 'resourceGroup',
      type: 'autocomplete',
      message: 'Specify resource group',
      choices: [
        ...resourceGroups.map(r => ({
          message: `${r.name} (${r.location})`,
          name: `${r.name}`,
          value: r,
        })),
      ],
      initial: initial === -1 ? undefined : initial,
    });

    var storageAccountName: string | undefined = undefined;

    if (typeof result.resourceGroup.tags?.[STORAGE_ACCOUNT_TAG_NAME] === 'string') {
      storageAccountName = result.resourceGroup.tags[STORAGE_ACCOUNT_TAG_NAME];
    }

    await savePartialConfig({
      ...current,
      resourceGroup: result.resourceGroup.name,
      storageAccountName,
    });

    return result.resourceGroup as ResourceGroup;
  }
}
