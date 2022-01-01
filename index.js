// homebridge-sc/index.js
// Copyright © 2021-2022 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const ScPlatform = require('./lib/ScPlatform')
const packageJson = require('./package.json')

module.exports = (homebridge) => {
  ScPlatform.loadPlatform(homebridge, packageJson, 'SC', ScPlatform)
}
