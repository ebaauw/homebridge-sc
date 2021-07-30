// homebridge-sc/lib/ScPlatform.js
// Copyright © 2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')
const ScAccessory = require('./ScAccessory')

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
      const validHosts = []
      for (const i in this.config.hosts) {
        try {
          const host = homebridgeLib.OptionParser.toHost(
            'hosts[' + i + ']', this.config.hosts[i], true, true
          )
          validHosts.push(host)
        } catch (error) {
          if (error instanceof homebridgeLib.OptionParser.UserInputError) {
            this.warn('config.json: %s', error)
          } else {
            this.error(error)
          }
        }
      }
      this.config.hosts = validHosts
    } catch (error) { this.error(error) }

    this.bridges = {}
    this.jobs = []
    this.unInitialised = 0

    this
      .on('accessoryRestored', this.accessoryRestored)
      .once('heartbeat', this.init)
    this.debug('config: %j', this.config)
  }

  get logLevel () { return 3 }

  waitFor (accessory) {
    this.unInitialised++
    this.warn('waiting for %d accessories to initialise', this.unInitialised)
    accessory.on('initialised', () => {
      if (--this.unInitialised <= 0) {
        this.debug('initialised')
        this.emit('initialised')
      }
    })
  }

  async init (beat) {
    for (const host of this.config.hosts) {
      if (this.bridges[host] == null) {
        this.bridges[host] = new ScAccessory.Bridge(this, {
          host: host,
          firmware: '0.0.1'
        })
        this.waitFor(this.bridges[host])
      }
    }
  }

  accessoryRestored (className, version, id, name, context) {
    switch (className) {
      case 'SomaConnect':
        if (this.config.hosts.includes(id)) {
          this.bridges[id] = new ScAccessory.Bridge(this, context)
          this.waitFor(this.bridges[id])
        }
        break
      case 'SomaTilt2':
        if (this.bridges[context.bridgeId] != null) {
          this.bridges[context.bridgeId].addTilt2(id, context)
        }
        break
      default:
        this.warn(
          '%s: ignore unknown %s %v accesssory', name, className, version
        )
        break
    }
  }
}

module.exports = ScPlatform
