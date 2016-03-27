'use strict';

const fs = require('fs');
const Mustache = require('mustache');
const recursive = require('recursive-readdir-sync');
const pgdeploy = require('./pgdeploy.js');
const mkpath = require('mkpath');
const path = require('path');
const wrench = require('wrench');

let files = {
	readFile(filename) {
		try {
			return fs.readFileSync(filename, 'utf8');
		} catch(err) {
			pgdeploy.error('Can not read ' + filename);
		}
	},

	writeFile(filename, contents) {
		try {
			this.createDir(path.dirname(filename));

			if(!path.isAbsolute(filename)) {
				filename = process.cwd() + filename;
			}
			return fs.writeFileSync(filename, contents);
		} catch(err) {
			pgdeploy.warn(err);
			pgdeploy.error('Can not write to ' + filename);
		}
	},

	readDir(dir) {
		try {
			return fs.readdirSync(dir);
		} catch(err) {
			pgdeploy.warn('No directory @ ' + dir + '. Creating.');
			this.createDir(dir);
			return this.readDir(dir);
		}
	},

	createDir(dir) {
		if(!path.isAbsolute(dir)) {
			dir = process.cwd() + dir;
		}
		mkpath.sync(dir);
	},

	copyDir(from, to) {
		wrench.copyDirSyncRecursive(from, to, {
			forceDelete: false,
			excludeHiddenUnix: false,
			preserveFiles: true
		});
	},

	createFileFromTemplate(filename, template, data) {

		let contents = Mustache.render(this.readFile(__dirname + '/templates/' + template), data);

		this.writeFile(filename, contents);
	},

	getSchemas(directory) {
		return this.readDir(directory).filter((file) => {
			return fs.statSync(directory+'/'+file).isDirectory()
				&& ['releases'].indexOf(file) == -1
				&& file.match(/^[a-zA-Z].*/g);
		});
	},

	getTables(directory) {

		let schemas = this.getSchemas(directory);
		let tables =  [];

		schemas.forEach((schema) => {
			let tableNames = this.readDir(directory + '/' + schema + '/tables').filter((filename) => {
				return filename.startsWith('create_');
			}).map((filename) => {
				let tableName = filename.replace('create_', '', filename);
				tableName = tableName.replace(/\.v[0-9]{5}\.sql/, '', filename);

				return schema + '.' + tableName;
			});

			tables = tables.concat(tableNames);
		});

		return tables;
	},

	getBackups(directory) {
		return this.readDir(directory + '/__backups').filter((file) => {
			return fs.statSync(directory + '/__backups/' + file).isDirectory();
		});
	},

	getFileStream(filename) {
		this.writeFile(filename, '');
		return fs.createWriteStream(process.cwd() + '/' + filename);
	},


	getTests(directory) {
		return recursive(directory).filter(file => file.match(/.*tests\/test_.*\.js/g));
	}
};

module.exports = files;
