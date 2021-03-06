// homebridge-sc/lib/ScClient.js
// Copyright © 2021-2022 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')

const types = {
  shade: { model: 'SOMA Smart Shade 2' },
  tilt: { model: 'SOMA Tilt 2', supportsUp: true }
}

/** Client to a SOMA Connect.
  * @extends HttpClient
  */
class ScClient extends homebridgeLib.HttpClient {
  /** Map `type` to model.
    * @param {string} type - Type as returned by
    * {@link ScClient#listDevices listDevices()}.
    * @return {string} - The (commercial) model name.
    */
  static model (type) {
    return types[type] != null ? types[type].model : type
  }

  /** Return whether shade of type `type` supports `up` to
    * {@link ScClient#closeShade closeShade()}, and negative `targetPosition` to
    * {@link ScClient#setShadePosition setShadePosition()}
    * @param {string} type - Type as returned by
    * {@link ScClient#listDevices listDevices()}.
    * @return {boolean} - Supports `closeUpwards`.
    */
  static supportsUp (type) {
    return types[type] != null ? types[type].supportsUp : false
  }

  /** Create a new instance of a client to a SOMA Connect.
    * @param {object} params - Parameters.
    * @param {string} params.host - SOMA Connect hostname and port.
    * @param {integer} [parasm.timeout=15] - Request timeout (in seconds).
    */
  constructor (params = {}) {
    const _params = {
      port: 3000,
      timeout: 15
    }
    const optionParser = new homebridgeLib.OptionParser(_params)
    optionParser
      .hostKey('host')
      .intKey('timeout', 1, 60)
      .parse(params)
    super({
      host: _params.hostname + ':' + _params.port,
      json: true,
      maxSockets: 1,
      timeout: _params.timeout
    })
    this._params = _params
    this._props = {}
  }

  /** List connect devices.
    */
  async listDevices () {
    const { body } = await this.get('/list_devices')
    return body
  }

  /** Get shade position.
    * @param {string} id - The mac address of the shade.
    * @return {integer} - The shade position: 0 for open,
    * 100 for fully closed downwards, and -100 for fully closed upwards.
    */
  async getShadePosition (id) {
    const { body } = await this.get('/get_shade_state/' + id)
    return body.closed_upwards ? -body.position : body.position
  }

  /** Get shade battery level.
    * @param {string} id - The mac address of the shade.
    * @return {integer} - The battery percentage.
    */
  async getBatteryLevel (id) {
    const { body } = await this.get('/get_battery_level/' + id)
    return body.battery_percentage
  }

  /** Get shade solar panel light level.
    * @param {string} id - The mac address of the shade.
    * @return {integer} - The light level.
    */
  async getLightLevel (id) {
    const { body } = await this.get('/get_light_level/' + id)
    return body.light_level
  }

  /** Set shade position.
    * @param {string} id - The mac address of the shade.
    * @param {ineteger} [targetPosition = 0] - The target shade position,
    * from -100 for fully closed upwards,
    * through 0 for fully open,
    * to 100 for fully closed (downwards).
    * @param {boolean} [morningMode = true] - Use morning mode.
    */
  async setShadePosition (id, targetPosition = 0, morningMode = true) {
    let url = '/set_shade_position/' + id + '/' + targetPosition
    if (morningMode) {
      url += '?morning_mode=1'
    }
    return this.get(url)
  }

  /** Open shade.
    * @param {string} id - The mac address of the shade.
    * @param {boolean} [morningMode = true] - Use morning mode.
    * @return {integer} - The target position, 0.
    */
  async openShade (id, morningMode = true) {
    let url = '/open_shade/' + id
    if (morningMode) {
      url += '?morning_mode=1'
    }
    await this.get(url)
    return 0
  }

  /** Close shade downwards.
    * @param {string} id - The mac address of the shade.
    * @param {boolean} [up = false] - Close the shade upwards.
    * @param {boolean} [morningMode = true] - Use morning mode.
    * @return {integer} - The target position, 100.
    */
  async closeShade (id, up = false, morningMode = true) {
    let url = '/close_shade/' + id
    if (up) {
      url += '?close_upwards=1'
    }
    if (morningMode) {
      url += (up ? '&' : '?') + 'morning_mode=1'
    }
    await this.get(url)
    return 100
  }

  /** Stop shade.
    * @param {string} id - The mac address of the shade.
    */
  async stopShade (id) {
    await this.get('/stop_shade/' + id)
  }

  /** Send GET request to SOMA Connect.
    * @param {string} url - The requested URL.
    * @return {HttpResponse} response - The response.
    */
  async get (url) {
    const response = await super.get(url)
    if (response.body.version != null) {
      this._props.version = response.body.version
    }
    if (response.body.result !== 'success') {
      const error = new homebridgeLib.HttpClient.HttpError(
        `SOMA connect result: ${response.body.result}`, response.request
      )
      this.emit('error', error)
      throw error
    }
    return response
  }
}

module.exports = ScClient
