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

        async.each(tables, (table, asyncCb) => {
            pg.connect(db.getConnectionString(env), (err, client, done) => {
                if(err) {
                    pgdeploy.warn(err);
                    pgdeploy.error('Failed to connect for data export');
                }

                const fileStream = files.getFileStream(`${directory}/${table}`);

                fileStream.on('open', () => {
                    const sql = `copy ${table} to stdout${copy.withOptions}`;
                    const dbStream = client.query(copyTo(sql));

                    dbStream.pipe(fileStream);

                    dbStream.on('end', () => {
                        pgdeploy.info(`${table} data out from db`);
                        done();
                    });
                    dbStream.on('error', (dbStreamErr) => {
                        fileStream.end();
                        done();
                        pgdeploy.warn(`Failed to export ${table} from db`);
                        pgdeploy.warn(dbStreamErr);
                    });
                });

                fileStream.on('finish', () => {
                    pgdeploy.info(`${table} data copied`);
                    asyncCb();
                });

                fileStream.on('error', (fileStreamErr) => {
                    pgdeploy.warn(`Failed to export ${table} into file`);
                    asyncCb(fileStreamErr);
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

        async.each(tables, (table, asyncCb) => {
            const tableDataFile = `${process.cwd()}/${pgdeploy.getConfig().directory}/__backups/${backup}/${table}`;

            if(!fs.existsSync(tableDataFile)) {
                pgdeploy.warn(`${tableDataFile} does not exist.`);
                asyncCb();
            } else {
                pg.connect(db.getConnectionString(env), (pgConnectError, dbHandler, done) => {
                    if(pgConnectError) {
                        pgdeploy.warn(pgConnectError);
                        pgdeploy.error('Failed to connect for data import');
                    }

                    copy.checkColumns(tableDataFile, table, dbHandler, (err) => {
                        if(err) {
                            pgdeploy.warn(err);
                            asyncCb();
                        } else {
                            const sql = `copy ${table} from stdin${copy.withOptions}`;
                            const stream = dbHandler.query(copyFrom(sql));
                            const fileStream = fs.createReadStream(tableDataFile);

                            fileStream.pipe(stream).on('error', (fileStreamError) => {
                                pgdeploy.warn(fileStreamError);
                                pgdeploy.warn(`Can not write to ${table}`);
                                done();
                                asyncCb();
                            }).on('finish', () => {
                                pgdeploy.info(`${table} imported`);
                                done();
                                asyncCb();
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

            // reset sequences after import
            pg.connect(db.getConnectionString(env), (pgConnectError, dbHandler, done) => {
                if(pgConnectError) {
                    pgdeploy.warn(pgConnectError);
                    pgdeploy.error('Failed to connect for sequence reset');
                }

                dbHandler.query('select * from utils.reset_sequences()', [], (queryErr) => {
                    done();

                    if(queryErr) {
                        pgdeploy.warn(queryErr);
                        pgdeploy.error('Failed to reset sequences');
                    }

                    callback();
                });
            });
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
