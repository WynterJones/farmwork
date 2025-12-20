#!/usr/bin/env node

import { program } from 'commander';
import { init } from '../src/init.js';
import { add } from '../src/add.js';
import { status } from '../src/status.js';
import { doctor } from '../src/doctor.js';
import chalk from 'chalk';

const VERSION = '1.0.0';

console.log(chalk.green(`
╔═════════════════════════════════════╗
║      🌾 Farmwork CLI v${VERSION}        ║
╚═════════════════════════════════════╝
`));

program
  .name('farmwork')
  .description('Farmwork - Agentic development harness for AI-assisted projects')
  .version(VERSION);

program
  .command('init')
  .description('Initialize Farmwork in current directory')
  .option('-i, --interactive', 'Run interactive setup wizard')
  .option('-t, --template <type>', 'Project template (nextjs, rails, python, node)')
  .option('-f, --force', 'Overwrite existing files')
  .action(init);

program
  .command('add <type> <name>')
  .description('Add a component (agent, command, audit)')
  .action(add);

program
  .command('status')
  .description('Show Farmwork status and metrics')
  .action(status);

program
  .command('doctor')
  .description('Check Farmwork setup and diagnose issues')
  .action(doctor);

program.parse();
