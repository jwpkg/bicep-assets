import { Builtins, Cli  } from 'clipanion';

import { BuildCommand } from './commands/build';
import { DeployCommand } from './commands/deploy';
import { HelpCommand } from './commands/help';
import { InitCommand } from './commands/init';

const [_node, _app, ...args] = process.argv;

const cli = new Cli({
  binaryLabel: 'Bicep Assets CLI',
  binaryName: 'bicep-assets',
  binaryVersion: require('../package.json').version,
});
cli.register(HelpCommand);
cli.register(Builtins.VersionCommand);
cli.register(InitCommand);
cli.register(BuildCommand);
cli.register(DeployCommand);
// cli.register(UploadCommand);
// cli.register(SpecDeployCommand);
cli.runExit(args);
