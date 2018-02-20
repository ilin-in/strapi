'use strict';

/**
 * Module dependencies
 */

// Public node modules.
const _ = require('lodash');
const fs = require('fs');
const path = require('path');

module.exports = {
  provider: 'local',
  name: 'Local server',
  init: (strapi, config) => {
    return {
      upload: (file) => {
        return new Promise((resolve, reject) => {
          fs.writeFile(path.join(strapi.config.appPath, 'public', `uploads/${file.hash}.${file.ext}`), file.buffer, (err) => {
            if (err) {
              return reject(err);
            }

            file.url = `/uploads/${file.hash}.${file.ext}`;

            resolve();
          });
        });
      },
      delete: (file) => {
        return new Promise((resolve, reject) => {
          fs.unlink(path.join(strapi.config.appPath, 'public', file.url), (err) => {
            if (err) {
              return reject(err);
            }

            resolve();
          });
        });
      }
    };
  }
};
