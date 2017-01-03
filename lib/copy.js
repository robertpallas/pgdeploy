const pg = require('pg');
const fs = require('fs');
const async = require('async');
const copyTo = require('pg-copy-streams').to;
const copyFrom = require('pg-copy-streams').from;
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const db = require('./db.js');

const copy = {
    withOptions: ' csv header',

    fromDb(env, directory) {
        const tables = files.getTables(`${process.cwd()}/${pgdeploy.getConfig().directory}`);

        async.eachSeries(tables, (table, callback) => {
            pg.connect(db.getConnectionString(env), (err, client, done) => {
                if(err) {
                    pgdeploy.warn(err);
                    pgdeploy.error('Failed to connect for data export');
                }

                const fileStream = files.getFileStream(`${directory}/${table}`);

                fileStream.on('open', () => {
                    const sql = `copy ${table} to stdout${copy.withOptions}`;
                    const stream = client.query(copyTo(sql));

                    stream.pipe(process.stdout);
                    stream.on('error', () => {
                        done();
                        pgdeploy.warn(`Failed to export ${table}`);
                        callback(); // TODO: check export stalling, callback called case
                    });

                    stream.on('end', () => {
                        pgdeploy.info(`${table} data copied`);
                        done();
                        callback();
                    });
                });

                fileStream.on('finish', () => {
                    pgdeploy.info(`${table} data copied`);
                    done();
                    callback();
                });

                fileStream.on('error', () => {
                    done();
                    pgdeploy.warn(`Failed to export ${table}`);
                    callback(); // TODO: check export stalling, callback called case
                });
            });
        }, (err) => {
            if(err) {
                pgdeploy.warn(err);
                pgdeploy.error('Failed to export data from tables');
            }
            pgdeploy.success('All files done');
        });
    },


    toDb(env, backup, callback) {
        const tables = files.getTables(`${process.cwd()}/${pgdeploy.getConfig().directory}`);

        async.each(tables, (table, cb) => {
            const tableDataFile = `${process.cwd()}/${pgdeploy.getConfig().directory}/__backups/${backup}/${table}`;

            if(!fs.existsSync(tableDataFile)) {
                pgdeploy.warn(`${tableDataFile} does not exist.`);
                cb();
            } else {
                pg.connect(db.getConnectionString(env), (pgConnectError, client, done) => {
                    if(pgConnectError) {
                        pgdeploy.warn(pgConnectError);
                        pgdeploy.error('Failed to connect for data import');
                    }

                    copy.checkColumns(tableDataFile, table, client, (err) => {
                        if(err) {
                            pgdeploy.warn(err);
                            cb();
                        } else {
                            const sql = `copy ${table} from stdin${copy.withOptions}`;
                            const stream = client.query(copyFrom(sql));
                            const fileStream = fs.createReadStream(tableDataFile);

                            fileStream.pipe(stream).on('error', (fileStreamError) => {
                                pgdeploy.warn(fileStreamError);
                                pgdeploy.warn(`Can not write to ${table}`);
                                done();
                                cb();
                            }).on('finish', () => {
                                pgdeploy.info(`${table} imported`);
                                done();
                                cb();
                            });
                        }
                    });
                });
            }
        }, (err) => {
            if(err) {
                pgdeploy.warn(err);
                pgdeploy.error(`Failed to import data from backup ${backup} to ${env}`);
            }
            callback();
        });
    },

    checkColumns(tableDataFile, table, client, cb) {
        const fileContents = files.readFile(tableDataFile);
        const fileRows = fileContents.split('\n');
        const fileColumns = fileRows[0].split(',');

        const sql = 'select attname from pg_attribute where attrelid = $1::regclass and attnum > 0 and not attisdropped;';
        client.query(sql, [table], (err, res) => {
            if(err) {
                pgdeploy.warn(err);
                pgdeploy.error('Failed to get table data before copying backups');
            }

            const sqlColumns = _.map(res.rows, 'attname');
            if(_.isEqual(sqlColumns, fileColumns)) {
                // db and backup file have same columns
                cb();
            } else {
                pgdeploy.warn(`${table} columns in database and backup file do not match.`);
                // console.log('Columns in db: ' + sqlColumns);
                // console.log('Columns in backup: ' + fileColumns);

                pgdeploy.warn(`Please alter the backup file manually or remove it @ ${tableDataFile}`);

                cb(`Will not insert ${table} from backup`);
            }
        });
    }
};

module.exports = copy;
