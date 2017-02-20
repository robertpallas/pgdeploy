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

        pg.connect(db.getConnectionString(env), (pgConnectErr, client, done) => {
            if(pgConnectErr) {
                pgdeploy.warn(pgConnectErr);
                pgdeploy.error('Failed to connect for data export');
            }

            async.eachSeries(tables, (table, asyncCb) => {
                const fileStream = files.getFileStream(`${directory}/${table}`);

                fileStream.on('open', () => {
                    const sql = `copy ${table} to stdout${copy.withOptions}`;
                    const dbStream = client.query(copyTo(sql));

                    dbStream.pipe(fileStream);

                    dbStream.on('end', () => {
                        pgdeploy.info(`${table} data out from db`);
                    });
                    dbStream.on('error', (dbStreamErr) => {
                        fileStream.end();
                        pgdeploy.warn(`Failed to export ${table} from db`);
                        pgdeploy.warn(dbStreamErr);
                    });
                });

                fileStream.on('end', () => {
                    pgdeploy.info(`${table} data copied`);
                    asyncCb();
                });

                fileStream.on('error', (fileStreamErr) => {
                    pgdeploy.warn(`Failed to export ${table} into file`);
                    asyncCb(fileStreamErr);
                });
            }, (err) => {
                done();
                if(err) {
                    pgdeploy.warn(err);
                    pgdeploy.error('Failed to export data from tables');
                }
                pgdeploy.success('All files done');
            });
        });
    },

    toDb(env, backup, callback) {
        const tables = files.getTables(`${process.cwd()}/${pgdeploy.getConfig().directory}`);

        pg.connect(db.getConnectionString(env), (pgConnectError, dbHandler, done) => {
            if(pgConnectError) {
                pgdeploy.warn(pgConnectError);
                pgdeploy.error('Failed to connect for data import');
            }

            // copy data to database in one transaction
            dbHandler.query('begin', [], (txBeginErr) => {
                if(txBeginErr) {
                    pgdeploy.warn(txBeginErr);
                    pgdeploy.error('Failed to start transaction for data import');
                }

                this.getAndDropForeignKeys(dbHandler, (fkDropErr, foreignKeyQueries) => {
                    if(fkDropErr) {
                        this.dbDone(dbHandler, 'rollback;', done, () => {
                            pgdeploy.warn(fkDropErr);
                            pgdeploy.error(`Failed to import data from backup ${backup} to ${env}`);
                        });
                    } else {
                        async.eachSeries(tables, (table, asyncCb) => {
                            const tableDataFile = `${process.cwd()}/${pgdeploy.getConfig().directory}/__backups/${backup}/${table}`;

                            if(!fs.existsSync(tableDataFile)) {
                                pgdeploy.warn(`${tableDataFile} does not exist.`);
                                asyncCb();
                            } else {
                                copy.checkColumns(tableDataFile, table, dbHandler, (err) => {
                                    if(err) {
                                        asyncCb(err);
                                    } else {
                                        const sql = `copy ${table} from stdin${copy.withOptions}`;
                                        const stream = dbHandler.query(copyFrom(sql));
                                        const fileStream = fs.createReadStream(tableDataFile);

                                        fileStream.pipe(stream).on('error', (fileStreamError) => {
                                            pgdeploy.warn(`Can not write to ${table}`);
                                            asyncCb(fileStreamError);
                                        }).on('end', () => {
                                            pgdeploy.info(`${table} imported`);
                                            asyncCb();
                                        });
                                    }
                                });
                            }
                        }, (err) => {
                            if(err) {
                                this.dbDone(dbHandler, 'rollback;', done, () => {
                                    pgdeploy.warn(err);
                                    pgdeploy.error(`Failed to import data from backup ${backup} to ${env}`);
                                });
                            } else {
                                dbHandler.query('select * from utils.reset_sequences()', [], (queryErr) => {
                                    if(queryErr) {
                                        this.dbDone(dbHandler, 'rollback;', done, () => {
                                            pgdeploy.warn(queryErr);
                                            pgdeploy.error('Failed to reset sequences');
                                        });
                                    } else {
                                        async.each(foreignKeyQueries, (query, asyncCb) => {
                                            dbHandler.query(query, [], asyncCb);
                                        }, (foreignKeyAddErr) => {
                                            if(foreignKeyAddErr) {
                                                this.dbDone(dbHandler, 'rollback;', done, () => {
                                                    pgdeploy.warn(foreignKeyAddErr);
                                                    pgdeploy.error(`Failed to add foreign keys after backup ${backup} to ${env}`);
                                                });
                                            } else {
                                                pgdeploy.info(`Added back ${foreignKeyQueries.length} foreign key constraints.`);
                                                this.dbDone(dbHandler, 'commit;', done, callback);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
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
                cb('Failed to get table data before copying backups');
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
    },

    getAndDropForeignKeys(client, cb) {
        const getSql = 'select * from utils.get_add_fk_constraint_queries() as queries;';
        const dropSql = 'select * from utils.drop_fk_constraints();';

        client.query(getSql, [], (getErr, getRes) => {
            if(getErr) {
                pgdeploy.warn(getErr);
                cb('Failed to get foreign key constraints from sql before copying backups');
            }

            if(!getRes || !getRes.rows || !getRes.rows.length || !getRes.rows[0].queries) {
                cb('Failed to get foreign key constraints list before copying backups');
            }
            pgdeploy.info(`Copied ${getRes.rows[0].queries.length} foreign key constraints to add back later`);

            client.query(dropSql, [], (dropErr) => {
                if(dropErr) {
                    pgdeploy.warn(dropErr);
                    cb('Failed to drop foreign key constraints before copying backups');
                }

                cb(null, getRes.rows[0].queries);
            });
        });
    },

    dbDone(dbHandler, action, done, callback) {
        dbHandler.query(action, [], () => {
            done();
            callback();
        });
    }
};

module.exports = copy;
