#!/usr/bin/env node

const program = require('commander');
const pgdeploy = require('./lib/pgdeploy.js');

const init = require('./lib/init.js');
const setupEnv = require('./lib/setupEnvironment.js');
const releases = require('./lib/releases.js');
const deploy = require('./lib/deploy.js');
const exportData = require('./lib/export.js');
const importData = require('./lib/import.js');
const test = require('./lib/test.js');

const addFunction = require('./lib/addFunction.js');
const addRelease = require('./lib/addRelease.js');
const addSchema = require('./lib/addSchema.js');
const addTable = require('./lib/addTable.js');

const addCalls = {
    addFunction,
    addRelease,
    addSchema,
    addTable
};

program.version(require('./package.json').version);

program
    .command('init')
    .description('initialize pgdeploy project')
    .option('-f, --force', 'Deletes previously initialized project')
    .action(options => init(options));

program
    .command('setup [env]')
    .description('add another database environment to manage')
    .action((env) => {
        setupEnv(env, (err) => {
            if(err) {
                pgdeploy.error(err);
            } else {
                pgdeploy.success();
            }
        });
    });

program
    .command('add [what]')
    .description('add a release or schema/table/function into latest release')
    .action((what) => {
        const latestRelease = releases.getLatestRelease();
        const directory = pgdeploy.getConfig().directory;
        const filename = `add${what.substr(0, 1).toUpperCase()}${what.substr(1).toLowerCase()}`;

        addCalls[filename](latestRelease, directory);
    });

program
    .command('deploy')
    .description('deploy the unreleased releases to environment')
    .option('-c, --clean', 'Deletes everything in the environment database before deploy')
    .option('-g, --generate', 'Generate test data from one of the backups after deploy with import')
    .option('-d, --dry-run', 'Dry run shows you what it deploys but wont commit anything')
    .option('-v, --verbose', 'Log your release process in more detail')
    .option('-s, --single', 'Deploy only next unreleased version')
    .option('-t, --test', 'Run tests')
    .option('-n, --not-transaction', 'Deploy by committing release sql files one by one rather than as a patch in a transaction. Allows only single working file besides the release.')
    .action(options => deploy(options));

program
    .command('export')
    .description('Export all data from tables to a local back-up')
    .action(() => exportData());

program
    .command('import')
    .description('Import data from local back-up into one of the environments database tables')
    .action(() => {
        importData(() => {
            pgdeploy.success('All found files done');
        });
    });

program
    .command('test [env]')
    .description('Run all test files')
    .action(env => test(env));

program.parse(process.argv);
