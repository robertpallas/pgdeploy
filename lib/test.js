const Mocha = require('mocha');

const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');

const mocha = new Mocha();

function runTests(env, callback) {
    const config = pgdeploy.getConfig();

    if(!config.environments[env]) {
        pgdeploy.error(`Environment ${env} not found`);
    } else if(config.environments[env].protected) {
        // tests are only ran on non-protected environments like local
        pgdeploy.error('Will not run tests on protected environment');
    } else {
        global.pgdeployTestEnvironmentName = env;

        const directory = config.directory;
        const testFiles = files.getTests(directory);

        pgdeploy.info(`Found ${testFiles.length} files with tests`);
        pgdeploy.info('Testing');

        testFiles.forEach(file => mocha.addFile(file));

        // begin transaction, note that we should never commit it,
        // thus no changes are made to the database
        db.query(env, 'begin', [], (err) => {
            if(err) {
                pgdeploy.error(`Could not connect to database on ${env}`);
            }

            mocha.run(callback);
        });
    }
}

module.exports = runTests;

