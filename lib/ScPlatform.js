// homebridge-sc/lib/ScPlatform.js
// Copyright © 2021-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')
const { semver } = homebridgeLib
const ScAccessory = require('./ScAccessory')

class ScPlatform extends homebridgeLib.Platform {
  constructor (log, configJson, homebridge) {
    super(log, configJson, homebridge)
    this.config = {
      hosts: {},
      timeout: 15
    }
    const validHosts = {}
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
      for (const i in this.config.hosts) {
        try {
          const host = homebridgeLib.OptionParser.toObject(
            `hosts[${i}]`, this.config.hosts[i], true
          )
          const config = {}
          const optionParser = new homebridgeLib.OptionParser(config, true)
          optionParser
            .stringKey('host')
            .arrayKey('shades')
            .on('userInputError', (error) => {
              this.warn('config.json: hosts[%d]: %s', i, error)
            })
          optionParser.parse(host)
          host.host = homebridgeLib.OptionParser.toHost(
            `hosts[${i}]`, host.host, true, true
          )
          const validShades = []
          for (const j in config.shades) {
            try {
              const shade = homebridgeLib.OptionParser.toString(
                `hosts[${i}].shades[${j}]`, config.shades[j], true, true
              )
              validShades.push(shade.toUpperCase())
            } catch (error) {
              if (error instanceof homebridgeLib.OptionParser.UserInputError) {
                this.warn(error)
              } else {
                this.error(error)
              }
            }
          }
          validHosts[host.host] = validShades
        } catch (error) {
          if (error instanceof homebridgeLib.OptionParser.UserInputError) {
            this.warn(error)
          } else {
            this.error(error)
          }
        }
      }
    } catch (error) {
      if (error instanceof homebridgeLib.OptionParser.UserInputError) {
        this.warn(error)
      } else {
        this.error(error)
      }
    }
    this.config.hosts = validHosts
    if (Object.keys(this.config.hosts).length === 0) {
      this.warn('config.json: no host specified')
    }
    this.debug('config: %j', this.config)

    this.bridges = {}
    this.shades = {}
    this.jobs = []
    this.unInitialised = 0

    this
      .on('accessoryRestored', this.accessoryRestored)
      .once('heartbeat', this.init)
  }

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
    if (this.unInitialised <= 0) {
      this.debug('initialised')
      this.emit('initialised')
      await homebridgeLib.timeout(1000)
    }
    for (const host in this.config.hosts) {
      if (this.bridges[host] == null) {
        this.bridges[host] = new ScAccessory.Bridge(this, {
          host,
          firmware: '0.0.1',
          whitelist: this.config.hosts[host]
        })
      }
    }
  }

  accessoryRestored (className, version, id, name, context) {
    switch (className) {
      case 'SomaConnect':
        if (this.config.hosts[id] != null && semver.gte(version, '1.0.15')) {
          context.whitelist = this.config.hosts[id]
          this.bridges[id] = new ScAccessory.Bridge(this, context)
          this.waitFor(this.bridges[id])
        }
        break
      case 'SomaShade':
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
