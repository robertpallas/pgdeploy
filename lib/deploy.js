const inquirer = require('inquirer');
const async = require('async');
const pg = require('pg');
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');
const db = require('./db.js');
const files = require('./files.js');
const releases = require('./releases.js');
const importData = require('./import.js');
const test = require('./test.js');

const deployHelper = {
    options: {},
    releaseVersion: null,
    env: null
};

function cleanDatabase(callback) {
    const user = deployHelper.env.username;

    if(deployHelper.options.clean) {
        db.query(deployHelper.env, `drop owned by ${user} cascade;`, [], (err) => {
            if(err) {
                pgdeploy.warn(err);
                pgdeploy.error('Database clean failed!');
            }

            pgdeploy.info('Database cleaned, everything deleted.');

            db.init(deployHelper.env, callback);
        });
    } else {
        callback();
    }
}

function checkNextDeploy() {
    // if only one release was supposed to be deployed
    // or the next release has no files stop deploying releases
    const releaseFiles = releases.getReleaseFiles(deployHelper.releaseVersion);
    return deployHelper.options.single || !releaseFiles.length;
}

function deployRelease(callback) {
    const ver = deployHelper.releaseVersion;
    const releaseFiles = releases.getReleaseFiles(ver);

    pgdeploy.info('');
    pgdeploy.info(`${releaseFiles.length} files in release ${ver}`);

    if(!releaseFiles.length) {
        pgdeploy.error('No files to release. Do "pgdeploy add release"?');
    }

    if(releaseFiles.length < 2) {
        pgdeploy.error('There is no point to deploy release with less than 2 files since one is always release version insert.');
    }

    if(deployHelper.options.notTransaction && releaseFiles.length !== 2) {
        pgdeploy.error('You can only deploy 1 file besides the release insert without transactions. For your safety.');
    }

    deployHelper.releaseVersion = releases.getNextReleaseVersion(deployHelper.releaseVersion);

    pg.connect(db.getConnectionString(deployHelper.env), (err, dbHandler, done) => {
        if(err) {
            callback(err);
        }

        let txCommands = {
            begin: 'begin',
            commit: 'commit'
        };

        if(deployHelper.options.notTransaction) {
            txCommands = {
                begin: 'select true;',
                commit: 'select true;'
            };
        }

        // deploy releases to the database in one transaction
        dbHandler.query(txCommands.begin, [], (txBeginErr) => {
            if(txBeginErr) {
                callback(txBeginErr);
            }

            async.each(releaseFiles, (filename, releaseCb) => {
                const sqlFileContents = files.readFile(filename);

                if(deployHelper.options.verbose || deployHelper.options.dryRun) {
                    pgdeploy.info(`${filename}:`);
                    pgdeploy.info('-----------');
                    console.log(sqlFileContents);
                    pgdeploy.info('');
                }

                if(!deployHelper.options.dryRun) {
                    dbHandler.query(sqlFileContents, [], (sqlDeployErr) => {
                        pgdeploy.info(`Deploy ${filename}`);
                        releaseCb(sqlDeployErr);
                    });
                } else {
                    releaseCb();
                }
            }, (releaseError) => {
                if(releaseError) {
                    callback(releaseError);
                }

                dbHandler.query(txCommands.commit, [], (txCommitErr) => {
                    done();
                    callback(txCommitErr);
                });
            });
        });
    });
}

function doNotCleanGenerateOrTest() {
    if(deployHelper.options.clean) {
        pgdeploy.warn('Will not clean the database');
    }

    if(deployHelper.options.generate) {
        pgdeploy.warn('Will not generate test data');
    }

    if(deployHelper.options.test) {
        pgdeploy.warn('Will not run tests');
    }

    deployHelper.options.clean = false;
    deployHelper.options.generate = false;
    deployHelper.options.test = false;
}

function checkOptions(callback) {
    const env = deployHelper.env;
    let callDoNotClean = false;

    if(env.protected && !deployHelper.options.force) {
        let envName = deployHelper.env.envName;

        pgdeploy.info(`${envName} is protected environment.`);

        callDoNotClean = true;

        if(!deployHelper.options.single) {
            pgdeploy.warn('Will only deploy single version');
        }

        deployHelper.options.single = true;
    }

    if(deployHelper.options.dryRun) {
        pgdeploy.info('Doing a dry run. No changes are made to the database.');

        callDoNotClean = true;
    }

    if(deployHelper.options.notTransaction && !deployHelper.options.single) {
        deployHelper.options.single = true;
        pgdeploy.warn('Using no transactions you can only release single version. Forced the release to 1 version.');
    }

    if(callDoNotClean) {
        doNotCleanGenerateOrTest();
    }

    if(env.protected && !deployHelper.options.dryRun && !deployHelper.options.force) {
        inquirer.prompt([
            {
                type: 'list',
                name: 'release',
                message: 'Are you sure you wish to release?',
                choices: ['No', 'Yes', 'Maybe']
            }
        ], (res) => {
            if(res.release === 'Yes') {
                callback();
            } else {
                pgdeploy.error('OK, no release.');
            }
        });
    } else {
        callback();
    }
}

function testAndFinish() {
    if(deployHelper.options.test) {
        pgdeploy.info('Starting tests');
        test(deployHelper.env, (failures) => {
            if(failures) {
                pgdeploy.error('Tests failed');
            } else {
                pgdeploy.success();
            }
        });
    } else {
        pgdeploy.success();
    }
}

function askCredentialsAndBuildEnvObject(envObject, callback) {
    if(envObject.envName === 'Ask Credentials') {
        const validate = (res) => (res && res.length) ? true : 'Value required';
        inquirer.prompt([
            {
                type: 'input',
                name: 'host',
                message: 'PostgreSQL host location with port number',
                default: 'localhost:5432',
                validate
            },
            {
                type: 'input',
                name: 'username',
                message: 'Username',
                validate
            },
            {
                type: 'password',
                name: 'password',
                message: 'Password',
                validate
            },
            {
                type: 'input',
                name: 'database',
                message: 'Database',
                validate
            },
            {
                type: 'confirm',
                name: 'save',
                message: 'Save to pgdeploy config?',
                default: false
            },
            {
                type: 'input',
                name: 'envName',
                message: 'Save as environment',
                default: 'live',
                when: answers => answers.save
            },
            {
                type: 'confirm',
                name: 'protected',
                message: 'Protected from cleanup and test data generation?',
                default: true,
                when: answers => answers.save
            }
        ], (res) => {
            const config = pgdeploy.getConfig();
            config.environments[res.envName] = _.pick(res, ['host', 'username', 'password', 'database', 'protected']);
            pgdeploy.setConfig(config);

            if(typeof res.protected != 'boolean') {
                // assume new env to be protected if not saved to config file
                res.protected = true;
            }

            deployHelper.env = res;
            if(!deployHelper.env.envName) {
                deployHelper.env.envName = 'this environment';
            }

            callback();
        });
    } else if(envObject.host || envObject.username || envObject.password || envObject.database) {
        if(!envObject.host || !envObject.username || !envObject.password || !envObject.database) {
            pgdeploy.error('When setting credentials via command line all its fields (hostname, username, password and database) are mandatory');
        } else {
            deployHelper.env = _.pick(envObject, ['host', 'username', 'password', 'database']);
            deployHelper.env.envName = 'Arguments environment';
            deployHelper.env.protected = true;
            callback();
        }
    } else {
        deployHelper.env = pgdeploy.getConfig().environments[envObject.envName];
        deployHelper.env.envName = envObject.envName;
        callback();
    }
}

function deployToEnvironment(envObject) {
    askCredentialsAndBuildEnvObject(envObject, () => {
        checkOptions(() => {
            cleanDatabase(() => {
                db.getLastReleaseVersion(deployHelper.env, (err, ver) => {
                    if(err) {
                        pgdeploy.error(err);
                    }

                    if(!ver) {
                        ver = 'v00000';
                    }

                    deployHelper.releaseVersion = releases.getNextReleaseVersion(ver);

                    async.doUntil(deployRelease, checkNextDeploy, (deployErr) => {
                        if(deployErr) {
                            pgdeploy.warn(deployErr);

                            let errMsg = 'Failed to deploy.';
                            if(!deployHelper.options.notTransaction) {
                                errMsg += ' Rollback.';
                            }
                            pgdeploy.error(errMsg);
                        }

                        if(deployHelper.options.generate) {
                            importData(() => {
                                pgdeploy.info('Data inserted');
                                testAndFinish();
                            }, deployHelper.env, deployHelper.options.generate);
                        } else {
                            testAndFinish();
                        }
                    });
                });
            });
        });
    });
}

function deploy(options) {
    deployHelper.options = options;

    const envNames = pgdeploy.geEnvironmentNames();

    if(options.host || options.username || options.database || options.password) {
        deployToEnvironment(options);
    } else if(options.env) {
        if(!_.includes(envNames, options.env)) {
            pgdeploy.error(`${options.env} environment is not defined in pgdeploy.json`);
        } else {
            deployToEnvironment(options);
        }
    } else {
        envNames.push(new inquirer.Separator());
        envNames.push('Ask Credentials');

        // if -e / --env is not set ask interactively
        inquirer.prompt([
            {
                type: 'list',
                name: 'envName',
                message: 'Environment',
                choices: envNames
            }
        ], deployToEnvironment);
    }
}

module.exports = deploy;
