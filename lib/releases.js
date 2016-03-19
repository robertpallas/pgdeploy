'use strict';

const fs = require('fs');
const recursive = require('recursive-readdir-sync');
const async = require('async');
const _ = require('lodash');
const pgdeploy = require('./pgdeploy.js');

let releases = {
	directory: pgdeploy.getConfig().directory,

	getSqlFiles() {
		let files;
		try {
			files = recursive(this.directory);
			files = files.filter(this.isFileVersionedSql);
			return files;
		} catch(err) {
			pgdeploy.error('Could not read SQL release files @ ' + this.directory);
		}
	},

	isFileVersionedSql(fileName) {
		return /^.*\.v[0-9]{5}\.sql$/.test(fileName);
	},

	getReleaseFiles(release) {
		let files = this.getSqlFiles();

		return files.filter((el) => {
			return el.indexOf(release + '.sql') > -1;
		});
	},

	getReleases() {
		let files = this.getSqlFiles();
		return _.sortBy(_.uniq(_.map(files, (el) => {
			let filePieces = _.reverse(_.split(el, '.'));
			return filePieces[1];
		})));
	},

	getLatestRelease() {
		let releases = this.getReleases();
		releases = _.reverse(releases);
		return releases[0] || 'v00000';
	},

	getNextReleaseVersion(latestRelease) {
		let latestReleaseInt = parseInt(latestRelease.replace(/v0{0,4}/g, ''));
		return 'v' + _.padStart((latestReleaseInt + 1), 5, '0');
	}
};

module.exports = releases;
