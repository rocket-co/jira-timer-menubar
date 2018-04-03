import { remote, ipcRenderer } from 'electron'
import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import store from './lib/create-store'
import api from './lib/api'
import handleComms from './lib/process-communication'
import { storeState } from './lib/storage'
import { addWorklogs, setUpdating, fetchWorklogs } from './modules/worklog'
import { setVersion, setUpdateInfo, setDownloaded, setChecking, setUpdateAvailable } from './modules/updater'
import { setAuthToken, setJiraDomain } from './modules/user'
import { setFirstLaunchSettings } from './modules/settings'
import AppContainer from 'containers/app/app-container'

const log = remote.require('electron-log')

const originalConsoleLog = console.log.bind(console)
console.log = (...args) => {
  log.info(args)
  originalConsoleLog(...args)
}

window.onerror = (err) => {
  log.error(err)
  originalConsoleLog(...err)
}

render(
  <Provider store={store}>
    <MemoryRouter>
      <AppContainer />
    </MemoryRouter>
  </Provider>,
  document.getElementById('root'),
)

let credentials = remote.getCurrentWindow().credentials

if (credentials) {
  store.dispatch(setAuthToken(credentials.password))
  store.dispatch(setJiraDomain(credentials.account))

  api.init(credentials.password, credentials.account)

  // Lets fetch full worklogs on app launch
  store.dispatch(fetchWorklogs(true))
}

console.log('App version', remote.app.getVersion())
store.dispatch(setVersion(remote.app.getVersion()))

// Listen and respond to inter process communication
store.dispatch(setFirstLaunchSettings())
handleComms()

// Save our local state to cache file every 60 seconds
setInterval(() => {
  storeState(store.getState())
}, 60000)
