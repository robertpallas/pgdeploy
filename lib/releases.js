const recursive = require('recursive-readdir-sync');
const _ = require('lodash');

const pgdeploy = require('./pgdeploy.js');

const releases = {
    directory: pgdeploy.getConfig().directory,

    getSqlFiles() {
        try {
            let files = recursive(this.directory);
            files = files.filter(this.isFileVersionedSql);
            return files;
        } catch (err) {
            return pgdeploy.error(`Could not read SQL release files @ ${this.directory}`);
        }
    },

    isFileVersionedSql(fileName) {
        return /^.*\.v[0-9]{5}\.sql$/.test(fileName);
    },

    getReleaseFiles(release) {
        const files = this.getSqlFiles();

        return files.filter(el => el.indexOf(`${release}.sql`) > -1);
    },

    getReleases() {
        const files = this.getSqlFiles();
        return _.sortBy(_.uniq(_.map(files, (el) => {
            const filePieces = _.reverse(_.split(el, '.'));
            return filePieces[1];
        })));
    },

    getLatestRelease() {
        let releaseList = this.getReleases();
        releaseList = _.reverse(releaseList);
        return releaseList[0] || 'v00000';
    },

    getNextReleaseVersion(latestRelease) {
        const latestReleaseInt = parseInt(latestRelease.replace(/v0{0,4}/g, ''), 10);
        return `v${_.padStart((latestReleaseInt + 1), 5, '0')}`;
    }
};

module.exports = releases;
