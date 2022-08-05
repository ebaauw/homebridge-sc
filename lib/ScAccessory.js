// homebridge-sc/lib/ScAccessory.js
// Copyright © 2021-2022 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')
const ScService = require('./ScService')
const ScClient = require('./ScClient')
const packageJson = require('../package.json')

class ScAccessory extends homebridgeLib.AccessoryDelegate {
  static get Bridge () { return SomaConnect }
  static get Shade () { return SomaShade }
}

class SomaConnect extends homebridgeLib.AccessoryDelegate {
  constructor (platform, params) {
    super(platform, {
      id: params.host,
      name: params.host,
      category: platform.Accessory.Categories.RANGE_EXTENDER,
      manufacturer: 'SOMA Smart Home',
      model: 'SOMA Connect',
      firmware: params.firmware
    })
    this.id = params.host
    this.context.host = params.host
    this.context.firmware = params.firmware
    this.whitelist = params.whitelist
    this.log('%s v%s', this.values.model, this.values.firmware)
    this.debug('whitelist: %j', this.whitelist)

    this.service = new ScService.Bridge(this)
    this.manageLogLevel(this.service.characteristicDelegate('logLevel'))
    this.dummyService = new homebridgeLib.ServiceDelegate.Dummy(this)

    this.client = params.client
    if (this.client == null) {
      this.client = new ScClient({
        host: params.host,
        timeout: this.platform.config.timeout
      })
    }
    this.client
      .removeAllListeners()
      .on('error', (error) => {
        if (error instanceof ScClient.HttpError) {
          this.log(
            'request %d: %s %s',
            error.request.id, error.request.method, error.request.resource
          )
          this.warn('request %d: %s', error.request.id, error)
          if (error.statusCode === 408) {
            this.service.values.statusFault =
              this.Characteristics.hap.StatusFault.GENERAL_FAULT
          }
        } else {
          this.error(error)
        }
      })
      .on('request', (request) => {
        this.debug(
          'request %d: %s %s', request.id, request.method, request.resource
        )
        this.vdebug(
          'request %d: %s %s', request.id, request.method, request.url
        )
      })
      .on('response', (response) => {
        this.vdebug(
          'request %d: response: %j', response.request.id, response.body
        )
        this.debug(
          'request %d: http status %d %s',
          response.request.id, response.statusCode, response.statusMessage
        )
        this.service.values.statusFault =
          this.Characteristics.hap.StatusFault.NO_FAULT
      })

    this.shades = {}

    this.notYetInitialised = true
    this.heartbeatEnabled = true
    this.on('heartbeat', this.heartbeat)
  }

  async heartbeat (beat) {
    if (this.initialBeat == null) {
      this.initialBeat = beat
    }

    if ((beat - this.initialBeat) % 120 === 0) {
      // Check for new devices and battery every 2 minutes.
      try {
        const body = await this.client.listDevices()
        if (this.notYetInitialised) {
          this.values.firmware = body.version
          this.context.firmware = this.values.firmware
          this.log(
            '%s v%s at %s', this.values.model, this.values.firmware,
            this.client.address
          )
          if (this.whitelist.length > 0) {
            this.debug('whitelist: %j', this.whitelist)
          }
          const recommendedVersion = packageJson.engines['soma-connect']
          if (this.values.firmware !== recommendedVersion) {
            this.warn(
              'recommended version: %s v%s',
              this.values.model, recommendedVersion
            )
          }
        }
        for (const shade of body.shades) {
          const id = shade.mac.toUpperCase()
          if (this.shades[id] == null) {
            this.addShade(id, { id, shade })
          }
        }
        for (const id in this.shades) {
          try {
            const shade = this.shades[id]
            shade.service.updatePosition(
              await this.client.getShadePosition(shade.id)
            )
            shade.batteryService.values.battery =
              await this.client.getBatteryLevel(shade.id)
            shade.service.values.currentAmbientLightLevel =
              await this.client.getLightLevel(shade.id)
          } catch (error) { this.error(error) }
        }
        if (this.notYetInitialised) {
          delete this.notYetInitialised
          this.debug('initialised')
          this.emit('initialised')
        }
      } catch (error) { this.error(error) }
    } else if (
      (beat - this.initialBeat) % this.service.values.heartrate === 0
    ) {
      // Check for position every heartrate seconds.
      for (const id in this.shades) {
        try {
          const shade = this.shades[id]
          shade.service.updatePosition(
            await this.client.getShadePosition(shade.id)
          )
        } catch (error) { this.error(error) }
      }
    }
  }

  addShade (id, params) {
    params.model = ScClient.model(params.shade)
    params.name = params.shade.name == null
      ? params.shade.type + '_' + id
      : params.shade.name
    params.firmware = this.values.firmware
    if (this.whitelist.length !== 0 && !this.whitelist.includes(id)) {
      if (this.notYetInitialised) {
        this.log(
          '%s: %s at %s not whitelisted', params.name, params.model, params.id
        )
      }
      return
    }
    if (this.platform.shades[id] != null) {
      if (this.notYetInitialised) {
        this.warn(
          '%s: %s at %s already exposed through %s',
          params.name, params.model, id, this.platform.shades[id].bridge.id
        )
      }
      return
    }
    if (!['shade', 'tilt'].includes(params.shade.type)) {
      if (this.notYetInitialised) {
        this.warn(
          '%s at %s: ignoring upsupported type %s %s',
          params.name, id, params.shade.type, params.shade.gen
        )
      }
      return
    }
    this.shades[id] = new ScAccessory.Shade(this, params)
    this.platform.shades[id] = this.shades[id]
    this.log('%s: %s at %s', params.name, params.model, params.id)
  }
}

class SomaShade extends ScAccessory {
  constructor (bridge, params) {
    super(bridge.platform, {
      id: params.id,
      name: params.name,
      category: bridge.platform.Accessory.Categories.WINDOW_COVERING,
      manufacturer: 'SOMA Smart Home',
      model: params.model,
      firmware: params.firmware
    })
    this.inheritLogLevel(bridge)
    this.id = params.id.toLowerCase()
    this.bridge = bridge
    this.client = this.bridge.client
    this.bridge.once('initialised', () => { this.emit('initialised') })

    this.service = new ScService.WindowCovering(this, {
      supportsUp: ScClient.supportsUp(params.shade)
    })
    this.batteryService = new homebridgeLib.ServiceDelegate.Battery(this)
  }
}

module.exports = ScAccessory
