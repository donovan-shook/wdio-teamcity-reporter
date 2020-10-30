wdio-teamcity-reporter
======================

WebdriverIO TeamCity reporter based on https://github.com/sullenor/wdio-teamcity-reporter, which makes it possible to display test results
in real-time, makes test information available on the Tests tab of the Build Results page.

This version of the WebdriverIO TeamCity reporter incorporates screenshot reporting (see below).

## Installation

```bash
npm install @danielgallo/wdio-teamcity-reporter --save-dev
```

Instructions on how to install WebdriverIO can be found here: http://webdriver.io/guide/getstarted/install.html


## Configuration

Add reporter in your [wdio.conf.js](https://webdriver.io/docs/configurationfile.html) file:

```javascript
exports.config = {
  // ...
  reporters: ['@danielgallo/wdio-teamcity-reporter'],
  reporterOptions: {
    screenshotPath: 'temp/screenshots/', // optional
    captureStandardOutput: false, // optional
    flowId: true, // optional
    message: '[title]', // optional
  },
  // ...
}
```


## Screenshots

You can capture one or more screenshots by calling `browser.takeScreenshot()` within the various hooks
in your `wdio.conf.js` file, for example:

Capture a screenshot at the start and end of every test:
```javascript
beforeTest: function (test, context) {
    browser.takeScreenshot();
},

afterTest: function(test, context, { error, result, duration, passed, retries }) {
    browser.takeScreenshot();
}
```

The example above shows a useful way of capturing a "before" and "after"
screenshot for each test, for subsequent viewing within TeamCity Test results.

Alternatively, you could just capture a screenshot on a failed test:

```javascript
afterTest: function(test, context, { error, result, duration, passed, retries }) {
    if (!passed) {
        browser.takeScreenshot();
    }
}
```

By using this reporter, screenshots will then show up in TeamCity Test results as "Screenshot 1", "Screenshot 2", etc, under each test.

**Important:** In order for TeamCity to see the screenshots, you need to add the screenshot folder as an Artifact Path in TeamCity.
By default, screenshots will be saved under `./temp/screenshots/`, or you can
define a custom path by setting `screenshotPath` on the `reporterOptions` within
`wdio.conf.js` (see below).

**Note:** Screenshots taken within test suites are not currently captured by this reporter.
Only screenshots using the `browser.takeScreenshot()` method within the hooks
in `wdio.conf.js` are captured and reported to TeamCity.

## reporterOptions

`reporterOptions` provide you a possibility to adjust reporter functionality.

- `screenshotPath (string)` - define a custom path to save screenshots. Default `./temp/screenshots/`.
- `captureStandardOutput (boolean)` — if `true`, all the standard output (and standard error) messages received between `testStarted` and `testFinished` messages will be considered test output. The default value is `false` and assumes usage of testStdOut and testStdErr service messages to report the test output. Default `false`.
- `flowId (boolean)` — if `true`, `flowId` property will be added to all messages. Flow tracking is necessary for example to distinguish separate processes running in parallel. Default `true`.
- `message (string)` — possibility to provide particular format for the name property. Possible keys: `[browser]`, `[title]`. Example, `[browser] / [title]`. Default `[title]`.


## Links

- Reference to the TeamCity documentation about reporting messages: https://www.jetbrains.com/help/teamcity/reporting-test-metadata.html#Displaying+additional+test+data


## License

> The MIT License
