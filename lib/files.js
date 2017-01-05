const fs = require('fs');
const Mustache = require('mustache');
const recursive = require('recursive-readdir-sync');
const mkpath = require('mkpath');
const path = require('path');
const wrench = require('wrench');

const pgdeploy = require('./pgdeploy.js');

const files = {
    readFile(filename) {
        try {
            return fs.readFileSync(filename, 'utf8');
        } catch (err) {
            return pgdeploy.error(`Can not read ${filename}`);
        }
    },

    writeFile(filename, contents) {
        try {
            this.createDir(path.dirname(filename));

            const filePath = process.cwd() + filename;
            return fs.writeFileSync(filePath, contents);
        } catch (err) {
            pgdeploy.warn(err);
            return pgdeploy.error(`Can not write to ${filename}`);
        }
    },

    readDir(dir) {
        try {
            return fs.readdirSync(dir);
        } catch (err) {
            pgdeploy.warn(`No directory @ ${dir}. Creating.`);
            this.createDir(dir);
            return this.readDir(dir);
        }
    },

    createDir(dir) {
        mkpath.sync(this.getFullPath(dir));
    },

    copyDir(from, to) {
        wrench.copyDirSyncRecursive(from, to, {
            forceDelete: false,
            excludeHiddenUnix: false,
            preserveFiles: true
        });
    },

    createFileFromTemplate(filename, template, data) {
        const contents = Mustache.render(this.readFile(`${__dirname}/templates/${template}`), data);

        this.writeFile(filename, contents);
    },

    getSchemas(directory) {
        return this.readDir(directory).filter(file => fs.statSync(`${directory}/${file}`).isDirectory()
                && ['releases'].indexOf(file) === -1
                && file.match(/^[a-zA-Z].*/g));
    },

    getTables(directory) {
        const schemas = this.getSchemas(directory);
        let tables = [];

        schemas.forEach((schema) => {
            const tableNames = this.readDir(`${directory}/${schema}/tables`).filter(filename => filename.startsWith('create_')).map((filename) => {
                let tableName = filename.replace('create_', '', filename);
                tableName = tableName.replace(/\.v[0-9]{5}\.sql/, '', filename);

                return `${schema}.${tableName}`;
            });

            tables = tables.concat(tableNames);
        });

        return tables;
    },

    getBackups(directory) {
        return this.readDir(`${directory}/__backups`).filter(file => fs.statSync(`${directory}/__backups/${file}`).isDirectory());
    },

    getFileStream(filename) {
        this.writeFile(filename, '');
        return fs.createWriteStream(`${process.cwd()}/${filename}`);
    },


    getTests(directory) {
        return recursive(directory).filter(file => file.match(/.*tests\/test_.*\.js/g));
    },

    fileExists(filename) {
        return fs.existsSync(this.getFullPath(filename));
    },

    // unify path to full path no matter if it comes as full or not
    getFullPath(directory) {
        return process.cwd() + directory.replace(process.cwd(), '');
    }
};

module.exports = files;
