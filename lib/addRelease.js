'use strict';

const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const releases = require('./releases.js');
const _ = require('lodash');

module.exports=addRelease;

function addRelease(latestRelease, directory) {

	let releaseFiles = releases.getReleaseFiles(latestRelease);

	if(latestRelease != 'v00000' && releaseFiles.length < 2) {
		pgdeploy.error('Latest release does not include any SQL files, no point to create a new one.');
	}

	let data = {
		version: releases.getNextReleaseVersion(latestRelease),
		released_by: pgdeploy.getUser()
	};

	let filename = '/' + directory + '/releases/insert_release.' + data.version + '.sql';
	pgdeploy.info('New file: ' + filename);

	files.createFileFromTemplate(filename, 'insert_release', data);

	pgdeploy.info('Release ' + data.version + ' added');
}
