// homebridge-sc/lib/ScAccessory.js
// Copyright © 2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')
const ScService = require('./ScService')
const ScClient = require('./ScClient')

class ScAccessory extends homebridgeLib.AccessoryDelegate {
  constructor (bridge, params) {
    super(bridge.platform, {
      id: params.id,
      name: params.name,
      category: params.category,
      manufacturer: 'SOMA Smart Home',
      model: params.model,
      firmware: params.firmware
    })
    this.inheritLogLevel(bridge)
    this.id = params.id.toLowerCase()
    this.bridge = bridge
    this.client = this.bridge.client
    this.context.id = params.id
    this.context.name = params.name
    this.context.bridgeId = this.bridge.id
    this.context.firmware = params.firmware
    // this.log('%s v%s at %s', params.model, params.firmware, params.id)
    this.log('%s at %s', params.model, params.id)
    this.bridge.once('initialised', () => { this.emit('initialised') })
  }

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
    this.log('%s v%s', this.values.model, this.values.firmware)

    this.service = new ScService.Bridge(this)
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
        }
        for (const shade of body.shades) {
          const id = shade.mac.toUpperCase()
          switch (shade.type) {
            case 'shade':
            case 'tilt':
              if (this.shades[id] == null) {
                this.addShade(id, {
                  id: id,
                  name: shade.name,
                  type: shade.type,
                  firmware: this.values.firmware
                })
              }
              break
            default:
              this.warn(
                '%s [%s]: ignoring upsupported type %s',
                shade.name, id, shade.type
              )
              break
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

  addShade (id, context) {
    this.shades[id] = new ScAccessory.Shade(this, context)
  }
}

class SomaShade extends ScAccessory {
  constructor (bridge, params) {
    params.category = bridge.platform.Accessory.Categories.WINDOW_COVERING
    params.model = ScClient.model(params.type)
    super(bridge, params)
    this.context.name = params.name
    this.context.type = params.type
    this.service = new ScService.WindowCovering(this, {
      supportsUp: ScClient.supportsUp(params.type)
    })
    this.batteryService = new homebridgeLib.ServiceDelegate.Battery(this)
  }
}

module.exports = ScAccessory
