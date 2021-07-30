// homebridge-sc/lib/ScPlatform.js
// Copyright © 2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')

class ScPlatform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.config = {
      hosts: [],
      timeout: 15
    }
    const optionParser = new homebridgeLib.OptionParser(this.config, true)
    optionParser
      .stringKey('platform')
      .stringKey('name')
      .arrayKey('hosts')
      .intKey('timeout', 1, 60) // seconds
      .on('userInputError', (message) => {
        this.warn('config.json: %s', message)
      })
    try {
      optionParser.parse(configJson)
    } catch (error) { this.fatal(error) }

    this
      .on('accessoryRestored', this.accessoryRestored)
      .on('init', this.init)
      .on('heartbeat', this.heartbeat)
    this.debug('config: %j', this.config)
  }

  async init (beat) {
    this.emit('initialised')
  }

  async heartbeat (beat) {
  }

  accessoryRestored (className, version, id, name, context) {
    switch (className) {
      default:
        this.warn(
          '%s: ignore unknown %s %v accesssory', name, className, version
        )
        break
    }
  }
}

module.exports = ScPlatform
