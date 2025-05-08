import { Command } from 'clipanion';

import { richFormat } from '../utils/clipanion-format';

/**
 * A command that prints the usage of all commands.
 *
 * Paths: `-h`, `--help`
 */
export class HelpCommand extends Command<any> {
  static paths = [['-h'], ['--help']];
  async execute() {
    this.context.stdout.write(this.cli.usage());
    this.context.stdout.write('\n');
    this.context.stdout.write(richFormat.header('Description'));
    this.context.stdout.write('\n');
    this.context.stdout.write(`
  This CLI tool provides assets management for bicep templates. It works by pre-packing the used assets in hashed based files.
  These files will be uploaded to a storage account after which they can be used in the bicep template.

    `);
  }
}
