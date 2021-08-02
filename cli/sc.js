#!/usr/bin/env node

// homebridge-zp/cli/sc.js
// Copyright © 2019-2021 Erik Baauw. All rights reserved.
//
// Homebridge plug-in for SOMA Connect.

'use strict'

const homebridgeLib = require('homebridge-lib')
const ScClient = require('../lib/ScClient')
const packageJson = require('../package.json')

const { b, u } = homebridgeLib.CommandLineTool
const { UsageError } = homebridgeLib.CommandLineParser

const usage = {
  sc: `${b('sc')} [${b('-hVD')}] [${b('-H')} ${u('hostname')}[${b(':')}${u('port')}]] [${b('-t')} ${u('timeout')}] ${u('command')} [${u('argument')} ...]`,
  list: `${b('list')} [${b('-h')}]`,
  position: `${b('position')} [${b('-hm')}] [${b('-S')} ${u('shade')}] [${b('--')}] [${u('position')}]`,
  open: `${b('open')} [${b('-hm')}] [${b('-S')} ${u('shade')}]`,
  close: `${b('close')} [${b('-hm')}] [${b('-S')} ${u('shade')}] [${b('down')}|${b('up')}]`,
  stop: `${b('stop')} [${b('-h')}] [${b('-S')} ${u('shade')}]`,
  battery: `${b('battery')} [${b('-h')}] [${b('-S')} ${u('shade')}]`
}

const description = {
  sc: 'Command line interface to SOMA Connect.',
  list: 'List shades connected to the SOMA Connect.',
  position: 'Get/set shade position.',
  open: 'Open shade.',
  close: 'Close shade.',
  stop: 'Stop shade.',
  battery: 'Get shade battery level.'
}

const help = {
  sc: `${description.sc}

Usage: ${usage.sc}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-V')}, ${b('--version')}
  Print version and exit.

  ${b('-D')}, ${b('--debug')}
  Print debug messages.

  ${b('-H')} ${u('hostname')}[${b(':')}${u('port')}], ${b('--host=')}${u('hostname')}[${b(':')}${u('port')}]
  Connect to SOMA Connect at ${u('hostname')}${b(':3000')} or ${u('hostname')}${b(':')}${u('port')}.
  Default SOMA Connect can be set in the ${b('SC_HOST')} environment variable.

  ${b('-t')} ${u('timeout')}, ${b('--timeout=')}${u('timeout')}
  Set timeout to ${u('timeout')} seconds instead of default ${b('15')}.

Commands:
  ${usage.list}
  ${description.list}

  ${usage.position}
  ${description.position}

  ${usage.open}
  ${description.open}

  ${usage.close}
  ${description.close}

  ${usage.stop}
  ${description.stop}

  ${usage.battery}
  ${description.battery}

For more help, issue: ${b('sc')} ${u('command')} ${b('-h')}`,
  list: `${description.list}

Usage: ${b('sc')} ${usage.list}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.`,
  position: `${description.position}

Usage: ${b('sc')} ${usage.position}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-m')}, ${b('--morningMode')}
  Move the shade slowly, making less mode.

  ${b('-S')} ${u('shade')}, ${b('--shade=')}${u('shade')}
  Control shade with mac ${u('shade')}.
  Use ${b('sc list')} for an overview of connected shades and their mac.
  Default shade can be set in the ${b('SC_SHADE')} environment variable.

  ${u('position')}
  Set shade position to ${u('position')}

${u('position')} is expressed as percentage closed, for example:
  -100  fully closed upwards
   -50  half closed upwards
     0  fully opened
    50  half closed downwards
   100  fully closed downwards

Note that HomeKit expresses position as percentage open.`,
  open: `${description.open}

Usage: ${b('sc')} ${usage.open}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-m')}, ${b('--morningMode')}
  Move the shade slowly, making less mode.

  ${b('-S')} ${u('shade')}, ${b('--shade=')}${u('shade')}
  Control shade with mac ${u('shade')}.
  Use ${b('sc list')} for an overview of connected shades and their mac.
  Default shade can be set in the ${b('SC_SHADE')} environment variable.`,
  close: `${description.close}

Usage: ${b('sc')} ${usage.close}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-m')}, ${b('--morningMode')}
  Move the shade slowly, making less mode.

  ${b('-S')} ${u('shade')}, ${b('--shade=')}${u('shade')}
  Control shade with mac ${u('shade')}.
  Use ${b('sc list')} for an overview of connected shades and their mac.
  Default shade can be set in the ${b('SC_SHADE')} environment variable.

  ${b('down')}
  Close shade by tilting downwards (default).

  ${b('up')}
  Close shade by tilting upwards.`,
  stop: `${description.stop}

Usage: ${b('sc')} ${usage.stop}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-S')} ${u('shade')}, ${b('--shade=')}${u('shade')}
  Control shade with mac ${u('shade')}.
  Use ${b('sc list')} for an overview of connected shades and their mac.
  Default shade can be set in the ${b('SC_SHADE')} environment variable.`,
  battery: `${description.battery}

Usage: ${b('sc')} ${usage.battery}

Parameters:
  ${b('-h')}, ${b('--help')}
  Print this help and exit.

  ${b('-S')} ${u('shade')}, ${b('--shade=')}${u('shade')}
  Control shade with mac ${u('shade')}
  Use ${b('sc list')} for an overview of connected shades and their mac.
  Default shade can be set in the ${b('SC_SHADE')} environment variable..`
}

class Main extends homebridgeLib.CommandLineTool {
  constructor () {
    super()
    this.usage = usage.sc
  }

  async main () {
    try {
      this.clargs = this.parseArguments()
      this.name = 'sc ' + this.clargs.command
      this.usage = `${b('sc')} ${usage[this.clargs.command]}`
      this.help = help[this.clargs.command]
      await this[this.clargs.command](this.clargs.args)
    } catch (error) { this.error(error) }
  }

  parseArguments () {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    const clargs = {
      options: {
        host: process.env.SC_HOST,
        timeout: 15
      }
    }
    parser
      .help('h', 'help', help.sc)
      .version('V', 'version')
      .flag('D', 'debug', () => {
        if (this.debugEnabled) {
          this.setOptions({ vdebug: true })
        } else {
          this.setOptions({ debug: true, chalk: true })
        }
      })
      .option('H', 'host', (value) => {
        homebridgeLib.OptionParser.toHost('host', value, false, true)
        clargs.options.host = value
      })
      .option('t', 'timeout', (value) => {
        clargs.options.timeout = homebridgeLib.OptionParser.toInt(
          'timeout', value, 1, 60, true
        )
      })
      .parameter('command', (value) => {
        if (usage[value] == null || typeof this[value] !== 'function') {
          throw new UsageError(`${value}: unknown command`)
        }
        clargs.command = value
      })
      .remaining((list) => { clargs.args = list })
      .parse()
    return clargs
  }

  createScClient () {
    if (this.clargs.options.host == null || this.clargs.options.host === '') {
      throw new UsageError(`Missing host.  Set ${b('SC_HOST')} or specify ${b('-H')}.`)
    }
    const client = new ScClient({
      host: this.clargs.options.host,
      timeout: this.clargs.options.timeout
    })
    client
      .on('error', (error) => {
        if (error instanceof ScClient.HttpError) {
          this.log(
            'request %d: %s %s',
            error.request.id, error.request.method, error.request.resource
          )
          this.warn('request %d: %s', error.request.id, error)
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
      })
    return client
  }

  checkId (id) {
    if (id == null || id === '') {
      throw new UsageError(`Missing shade mac address.  Set ${b('SC_SHADE')} or specify ${b('-S')}.`)
    } else if (!homebridgeLib.OptionParser.patterns.mac.test(id)) {
      throw new UsageError(`${id}: invalid shade mac address`)
    }
    return id.toLowerCase()
    // TODO check that id is actually connected to SOMA Connect
  }

  async list (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    parser
      .help('h', 'help', this.help)
      .parse(...args)
    this.client = this.createScClient()
    const response = await this.client.listDevices()
    const jsonFormatter = new homebridgeLib.JsonFormatter()
    this.print(jsonFormatter.stringify(response.shades.map((shade) => {
      return {
        id: shade.mac.toUpperCase(),
        model: ScClient.model(shade.type),
        version: response.version, // FIXME: this is the SOMA Connect version
        name: shade.name,
        supportsUp: ScClient.supportsUp(shade.type)
      }
    })))
  }

  async position (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let id = process.env.SC_SHADE
    let targetPosition
    let morningMode = 0
    parser
      .help('h', 'help', this.help)
      .flag('m', 'morningMode', () => { morningMode = 1 })
      .option('S', 'shade', (value) => { id = value })
      .remaining((list) => {
        if (list.length > 1) {
          throw new UsageError('too many arguments')
        }
        if (list.length === 1) {
          targetPosition = homebridgeLib.OptionParser.toInt(
            'position', list[0], -100, 100, true
          )
        }
      })
      .parse(...args)
    this.client = this.createScClient()
    id = this.checkId(id)
    if (targetPosition != null) {
      await this.client.setShadePosition(id, targetPosition, morningMode)
    }
    this.print('' + await this.client.getShadePosition(id))
  }

  async open (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let id = process.env.SC_SHADE
    let morningMode = 0
    parser
      .help('h', 'help', this.help)
      .flag('m', 'morningMode', () => { morningMode = 1 })
      .option('S', 'shade', (value) => { id = value })
      .parse(...args)
    this.client = this.createScClient()
    id = this.checkId(id)
    await this.client.openShade(id, morningMode)
    this.print('' + await this.client.getShadePosition(id))
  }

  async close (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let id = process.env.SC_SHADE
    let morningMode = 0
    let up = false
    parser
      .help('h', 'help', this.help)
      .flag('m', 'morningMode', () => { morningMode = 1 })
      .option('S', 'shade', (value) => { id = value })
      .remaining((list) => {
        if (list.length > 1) {
          throw new UsageError('too many arguments')
        }
        if (list.length === 1) {
          if (['up', 'down'].includes(list[0])) {
            up = list[0] === 'up'
          } else {
            throw new UsageError(`${list[0]}: invalid repeat value`)
          }
        }
      })
      .parse(...args)
    this.client = this.createScClient()
    id = this.checkId(id)
    await this.client.closeShade(id, up, morningMode)
    this.print('' + await this.client.getShadePosition(id))
  }

  async stop (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let id = process.env.SC_SHADE
    parser
      .help('h', 'help', this.help)
      .option('S', 'shade', (value) => { id = value })
      .parse(...args)
    this.client = this.createScClient()
    id = this.checkId(id)
    await this.client.stopShade(id)
    this.print('' + await this.client.getShadePosition(id))
  }

  async battery (...args) {
    const parser = new homebridgeLib.CommandLineParser(packageJson)
    let id = process.env.SC_SHADE
    parser
      .help('h', 'help', this.help)
      .option('S', 'shade', (value) => { id = value })
      .parse(...args)
    this.client = this.createScClient()
    id = this.checkId(id)
    this.print('' + await this.client.getBatteryLevel(id))
  }
}

new Main().main()
