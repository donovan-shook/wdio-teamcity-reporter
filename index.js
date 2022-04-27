'use strict'

const WdioReporter = require('@wdio/reporter').default
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const Readable = require('stream').Readable
const { v4: uuid } = require('uuid')
const shell = require('shelljs')

/**
 * @typedef {Object} SuiteStats
 * @property {string} type
 * @property {string} start
 * @property {string} uid
 * @property {string} cid
 * @property {string} title
 * @property {string} fullTitle
 * @property {undefined} tags
 * @property {Array} tests
 * @property {Array} hooks
 * @property {Array} suites
 * @property {Array} hooksAndTests
 */

/**
 * @typedef {Object} TestStats
 * @property {string} type
 * @property {string} start
 * @property {number} _duration
 * @property {string} uid
 * @property {string} cid
 * @property {string} title
 * @property {string} fullTitle
 * @property {Array} output
 * @property {any} argument
 * @property {string} state
 * @property {string} [end]
 */

class WdioTeamcityReporter extends WdioReporter {
  static escape (str) {
    if (!str) return ''
    return str
      .toString()
      .replace(/\|/g, '||')
      .replace(/\n/g, '|n')
      .replace(/\r/g, '|r')
      .replace(/\[/g, '|[')
      .replace(/\]/g, '|]')
      .replace(/\u0085/g, '|x') // next line
      .replace(/\u2028/g, '|l') // line separator
      .replace(/\u2029/g, '|p') // paragraph separator
      .replace(/'/g, '|\'')
  }

  static bool (value, fallback) {
    return typeof value === 'boolean' ? value : fallback
  }

  static number (value, fallback) {
    return typeof value === 'number' ? value : fallback
  }

  static string (value, fallback) {
    return typeof value === 'string' ? value : fallback
  }

  constructor (reporterOptions) {
    const r = WdioTeamcityReporter
    const params = {
      captureStandardOutput: r.bool(reporterOptions.captureStandardOutput, false),
      flowId: r.bool(reporterOptions.flowId, true),
      message: r.string(reporterOptions.message, '[title]'),
      screenshotPath: r.string(reporterOptions.screenshotPath, 'temp/screenshots/'),
      stdout: true,
      writeStream: process.stdout
    }
    const options = Object.assign(reporterOptions, params)

    super(options)

    const folderPath = path.join(process.cwd(), params.screenshotPath)

    shell.mkdir('-p', folderPath)

    this.fullScreenshotPath = folderPath
    this.currentTestStats = null
    this.previousTestUid = null
    this.iterator = 0
  }

  /**
   * @param {SuiteStats} suiteStats
   */
  onSuiteStart (suiteStats) {
    this._m('##teamcity[testSuiteStarted name=\'{name}\' flowId=\'{id}\']', suiteStats)
  }

  /**
   * @param {TestStats} testStats
   */
  onTestStart (testStats) {
    this.currentTestStats = testStats

    this._m('##teamcity[testStarted name=\'{name}\' captureStandardOutput=\'{capture}\' flowId=\'{id}\']', testStats)
  }

  /**
   * @param {TestStats} testStats
   */
  onTestEnd (testStats) {
    if (testStats.state === 'skipped') {
      return
    }
    this._m('##teamcity[testFinished name=\'{name}\' duration=\'{ms}\' flowId=\'{id}\']', testStats)
  }

  /**
   * @param {TestStats} testStats
   */
  onTestFail (testStats) {
    const { escape, number } = WdioTeamcityReporter
    const specFileRetryAttempts = number(this.runnerStat.config.specFileRetryAttempts, 0)
    const specFileRetries = number(this.runnerStat.config.specFileRetries, 0)
    const attempt = escape(`${specFileRetryAttempts}/${specFileRetries}`)

    if (specFileRetryAttempts === specFileRetries) {
      this._m('##teamcity[testFailed name=\'{name}\' message=\'{error}\' details=\'{stack}\' flowId=\'{id}\']', testStats)
    } else {
      this._m(`##teamcity[message name='{name}' text='attempt ${attempt} failed: {error}' flowId='{id}']`, testStats)
    }
  }

  /**
   * @param {TestStats} testStats
   */
  onTestSkip (testStats) {
    this._m('##teamcity[testIgnored name=\'{name}\' message=\'skipped\' flowId=\'{id}\']', testStats)
  }

  /**
   * @param {SuiteStats} suiteStats
   */
  onSuiteEnd (suiteStats) {
    this._m('##teamcity[testSuiteFinished name=\'{name}\' flowId=\'{id}\']', suiteStats)
  }

  onAfterCommand (command) {
    const screenshotRegEx = /\/session\/[^/]*\/screenshot/

    // If this is a screenshot command and there is an associated value (the screenshot data)
    if (screenshotRegEx.test(command.endpoint) && command.result.value) {
      // Save screenshot to path (TODO: allow path to be defined in initial config)
      if (this.currentTestStats.uid === this.previousTestUid) {
        this.iterator++
      } else {
        this.iterator = 0
      }

      const uuidFilename = uuid()
      const bufferData = Buffer.from(command.result.value, 'base64')
      const streamData = new Readable()
      const fileName = `${this.iterator}-${uuidFilename}.png`
      const filePath = path.join(this.fullScreenshotPath, fileName)
      streamData.push(bufferData)
      streamData.push(null)
      streamData.pipe(fs.createWriteStream(filePath))

      const screenshotDisplayName = `Screenshot ${this.iterator + 1}`

      this._m(`##teamcity[testMetadata name='${screenshotDisplayName}' type='image' value='${fileName}' flowId='{id}']`, this.currentTestStats)

      this.previousTestUid = this.currentTestStats.uid
    }
  }

  /**
   * @param {string} template
   * @param {TestStats | SuiteStats} stats
   */
  _m (template, stats) {
    assert(stats != null, '_m(): missing stats argument')

    if (!this.options.flowId) {
      template = template.replace(' flowId=\'{id}\'', '')
    }

    const fragment = pattern => {
      switch (pattern) {
        case '{capture}':
          return this.options.captureStandardOutput ? 'true' : 'false'
        case '{id}':
          return this.runnerStat.sessionId + '/' + stats.cid
        case '{ms}':
          return stats._duration
        case '{name}':
          var name = this.options.message
          if (name.includes('[browser]')) name = name.replace(/\[browser\]/g, this._v())
          if (name.includes('[title]')) name = name.replace(/\[title\]/g, stats.title)
          return name
        case '{state}':
          return stats.state
        case '{error}':
          return stats.error.message
        case '{stack}':
          return stats.error.stack
        default:
          return ''
      }
    }

    const m = template.replace(/\{[a-z]+\}/gi, m =>
      WdioTeamcityReporter.escape(fragment(m)))

    this.write(m + '\n')
  }

  _v () {
    // @see https://github.com/webdriverio/webdriverio/blob/v6.10.5/packages/webdriver/src/types.ts#L215
    const { browserName, browserVersion, version } = this.runnerStat.capabilities;
    return `${browserName} ${browserVersion || version}`;
  }
}

module.exports.default = WdioTeamcityReporter
module.exports.reporterName = 'teamcity'
