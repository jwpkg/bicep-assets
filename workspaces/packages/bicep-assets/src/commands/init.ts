import { Command, Option } from 'clipanion';

import { Configuration } from '../configuration';

export class InitCommand extends Command {
  static paths = [
    ['init'],
  ];

  static usage = Command.Usage({
    description: 'Initializes the bicep assets configuration',
    details: `
      This command will initialize the bicep assets configuration. 
      It will create a the bicep-assets-config.yaml with the assets:
      - subscription
      - resource group
      - storage account name
    `,
  });

  resourceGroup = Option.String('-g,--resource-group', {
    description: 'The resource group to use for the deployment. When not provided it will try to suggest from the current az login state',
    required: false,
  });

  subscription = Option.String('-s,--subscription', {
    description: 'The subscription to use for the deployment. When not provided it will try to suggest from the current az login state',
    required: false,
  });

  forceReevaluate = Option.Boolean('-f,--force', false, {
    description: 'Force a reevaluation/redeploy even if the concept is already initialized correctly',
  });

  async execute() {
    console.log('Setting up configuration...\n');
    const config = await Configuration.load(true, this.forceReevaluate);
    console.log();
    console.log('Configuration:');
    console.log('  subscription: ', config.subscription);
    console.log('  resource group: ', config.resourceGroup);
    console.log('  storage account name: ', config.storageAccountName);
    console.log('  assets:');
    for (const asset of config.assets) {
      console.log('    - ', asset.name, '(', asset.path, ')');
    }
    console.log();
  }
}
