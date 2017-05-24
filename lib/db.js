const pg = require('pg');
const pgdeploy = require('./pgdeploy.js');

const dataTypes = ['text', 'boolean', 'timestamptz', 'bigint', 'numeric', 'interval', 'json', 'uuid'];

const db = {

    dataTypes,

    getConnectionString(env) {
        let envConfig;

        if(env.username) {
            // env is object
            envConfig = env;
        } else {
            envConfig = pgdeploy.getConfig().environments[env];
        }

        return `pg://${envConfig.username}:${envConfig.password}@${envConfig.host}/${envConfig.database}`;
    },

    query(env, sql, data, callback) {
        pg.connect(db.getConnectionString(env), (connectError, client, done) => {
            if(connectError) {
                callback(connectError, null);
            } else {
                client.query(sql, data, (err, result) => {
                    done();
                    callback(err, result);
                });
            }
        });
    },

    getAllReleases(env, callback) {
        let envName = env.envName || env;
        this.query(env, 'select * from releases.releases order by id desc', [], (err, result) => {
            if(!err) {
                callback(null, result.rows);
            } else {
                pgdeploy.warn(err);
                callback(`Failed to get releases for ${envName}`, null);
            }
        });
    },

    getLastReleaseVersion(env, callback) {
        let envName = env.envName || env;
        this.query(env, 'select version from releases.releases order by id desc limit 1', [], (err, result) => {
            if(!err) {
                const latestVersionExists = result.rows && result.rows[0] && result.rows[0].version;

                if(latestVersionExists) {
                    pgdeploy.info(`Last release on ${env} is ${result.rows[0].version}`);
                    callback(null, result.rows[0].version);
                } else {
                    pgdeploy.info(`There are no releases on ${envName}`);
                    callback(null, null);
                }
            } else {
                pgdeploy.warn(err);
                callback(`Failed to get last release version for ${envName}`, null);
            }
        });
    },

    init(env, callback) {
        let envName = env.envName || env;
        this.query(env, 'create schema if not exists releases', [], (createSchemaError) => {
            if(createSchemaError) {
                callback(`Could not create releases schema for ${envName}`);
            }

            const sql = 'create table if not exists releases.releases(id serial, version text unique, released_by text, created_at timestamptz, description text)';
            db.query(env, sql, [], (err) => {
                if(err) {
                    callback(`Could not create releases table for ${envName}`);
                }

                pgdeploy.info(`Database initialized for environment ${envName}`);
                callback();
            });
        });
    }
};

module.exports = db;
