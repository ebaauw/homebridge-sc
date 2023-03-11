// homebridge-sc/lib/ScService.js
// Copyright © 2021-2023 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')

class ScService extends homebridgeLib.ServiceDelegate {
  static get Bridge () { return Bridge }
  static get WindowCovering () { return WindowCovering }
}

class Bridge extends homebridgeLib.ServiceDelegate {
  constructor (accessory, params = {}) {
    params.name = accessory.name
    params.Service = accessory.Services.my.Resource
    params.primaryService = true
    super(accessory, params)

    this.addCharacteristicDelegate({
      key: 'heartrate',
      Characteristic: this.Characteristics.my.Heartrate,
      props: { minValue: 1, maxValue: 60, minStep: 1 },
      value: 5
    })
    this.addCharacteristicDelegate({
      key: 'logLevel',
      Characteristic: this.Characteristics.my.LogLevel,
      value: this.accessoryDelegate.logLevel
    })
    this.addCharacteristicDelegate({
      key: 'statusFault',
      Characteristic: this.Characteristics.hap.StatusFault,
      value: this.Characteristics.hap.StatusFault.GENERAL_FAULT
    })
  }
}

class WindowCovering extends homebridgeLib.ServiceDelegate {
  constructor (accessory, params = {}) {
    params.name = accessory.name
    params.Service = accessory.Services.hap.WindowCovering
    params.primaryService = true
    super(accessory, params)
    this.id = accessory.id
    this.venerianBlind = params.supportsUp
    this.client = accessory.client

    this.addCharacteristicDelegate({
      key: 'currentPosition',
      Characteristic: this.Characteristics.hap.CurrentPosition,
      unit: '%',
      value: 100 // % open
    })
    this.addCharacteristicDelegate({
      key: 'targetPosition',
      Characteristic: this.Characteristics.hap.TargetPosition,
      unit: '%',
      value: 100, // % open
      props: { minValue: 0, maxValue: 100, minStep: this.venerianBlind ? 10 : 5 }
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      await this.setPosition()
    })
    this.addCharacteristicDelegate({
      key: 'holdPosition',
      Characteristic: this.Characteristics.hap.HoldPosition
    }).on('didSet', async (value, fromHomeKit) => {
      if (!fromHomeKit) {
        return
      }
      await this.client.stopShade(this.id)
    })
    this.addCharacteristicDelegate({
      key: 'positionState',
      Characteristic: this.Characteristics.hap.PositionState,
      value: this.Characteristics.hap.PositionState.STOPPED
    })
    if (this.venerianBlind) {
      this.addCharacteristicDelegate({
        key: 'closeUpwards',
        Characteristic: this.Characteristics.my.CloseUpwards,
        value: false
      }).on('didSet', async (value, fromHomeKit) => {
        if (!fromHomeKit) {
          return
        }
        await this.setPosition()
      })
    }
    this.addCharacteristicDelegate({
      key: 'morningMode',
      Characteristic: this.Characteristics.my.MorningMode,
      value: false
    })
    if (!this.client.u1) {
      this.addCharacteristicDelegate({
        key: 'currentAmbientLightLevel',
        Characteristic: this.Characteristics.hap.CurrentAmbientLightLevel
      })
    }
    this.addCharacteristicDelegate({
      key: 'lastUpdated',
      Characteristic: this.Characteristics.my.LastUpdated,
      silent: true
    })
  }

  async setPosition () {
    let position = 100 - this.values.targetPosition // % closed --> % open
    if (this.venerianBlind) {
      if (this.values.closeUpwards) {
        position *= -1
      }
      this.targetCloseUpwards = this.values.closeUpwards
    }
    this.values.positionState =
      this.values.targetPosition > this.values.currentPosition
        ? this.Characteristics.hap.PositionState.INCREASING
        : this.Characteristics.hap.PositionState.DECREASING
    this.moving = new Date()
    await this.client.setShadePosition(
      this.id, position, this.values.morningMode
    )
  }

  updatePosition (position) {
    let closeUpwards
    if (this.venerianBlind) {
      position = Math.round(position / 10) * 10
      if (position < 0) {
        position *= -1
        closeUpwards = true
      } else if (position > 0) {
        closeUpwards = false
      }
    } else {
      position = Math.round(position / 5) * 5
    }
    position = 100 - position // % open --> % closed
    this.values.currentPosition = position
    if (closeUpwards != null) {
      this.values.closeUpwards = closeUpwards
    }
    if (
      this.moving == null || new Date() - this.moving >= 30000 || (
        position === this.values.targetPosition &&
        (closeUpwards == null || closeUpwards === this.targetCloseUpwards)
      )
    ) {
      this.moving = null
      this.values.targetPosition = position
      this.values.positionState = this.Characteristics.hap.PositionState.STOPPED
    }
    this.values.lastUpdated = (new Date()).toString().slice(0, 24)
  }
}

module.exports = ScService
