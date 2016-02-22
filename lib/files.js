'use strict';

const fs = require('fs');
const Mustache = require('mustache');
const rarra = require('./rarra.js');
const mkpath = require('mkpath');
const path = require('path');

var files = {
	readFile: function(filename) {
		try {
			return fs.readFileSync(filename, 'utf8');
		} catch(err) {
			rarra.error('Can not read ' + filename);
		}
	},

	writeFile: function(filename, contents) {
		try {
			let filePath = process.cwd() + filename;
			mkpath.sync(path.dirname(filePath));
			return fs.writeFileSync(filePath, contents);
		} catch(err) {
			console.log(err);
			rarra.error('Can not write to ' + filename);
		}
	},

	createFileFromTemplate: function(filename, template, data) {

		let contents = Mustache.render(this.readFile('./lib/templates/' + template + '.sql'), data);

		this.writeFile(filename, contents);
	},

	getSchemas: function(directory) {
		return fs.readdirSync(directory).filter(function (file) {
			return fs.statSync(directory+'/'+file).isDirectory();
		});
	}
};

module.exports = files;
