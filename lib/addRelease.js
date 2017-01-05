const pgdeploy = require('./pgdeploy.js');
const files = require('./files.js');
const releases = require('./releases.js');

function addRelease(latestRelease, directory) {
    const releaseFiles = releases.getReleaseFiles(latestRelease);

    if(latestRelease !== 'v00000' && releaseFiles.length < 2) {
        pgdeploy.error('Latest release does not include any SQL files, no point to create a new one.');
    }

    const data = {
        version: releases.getNextReleaseVersion(latestRelease),
        released_by: pgdeploy.getUser()
    };

    const filename = `/${directory}/releases/insert_release.${data.version}.sql`;
    pgdeploy.info(`New file: ${filename}`);


    if(files.fileExists(filename)) {
        pgdeploy.warn(`Release file ${data.version} already exists`);
    } else {
        files.createFileFromTemplate(filename, 'insert_release.sql', data);

        pgdeploy.info(`Release ${data.version} added`);
    }
}

module.exports = addRelease;
