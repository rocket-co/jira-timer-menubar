import { ipcRenderer } from 'electron'
import Immutable from 'seamless-immutable'
import store from '../lib/create-store'

// Actions
const SET_SINGLE_SETTING = 'jt/settings/SET_SINGLE_SETTING'

const initialState = Immutable({
  openAtLogin: false,
  firstLaunch: true,
})

// Reducer
export default function reducer (state = initialState, action = {}) {
  switch (action.type) {

    case SET_SINGLE_SETTING:
      return state.set(action.name, action.value)


    default: return state
  }
}

// Action Creators
export const setSingleSetting = (name, value) => ({
  type: SET_SINGLE_SETTING,
  name,
  value,
})

// Side effects
export const setFirstLaunchSettings = () => dispatch => {

  let state = store.getState()

  console.log('state', state)

  if (state.settings.firstLaunch) {
    dispatch(setSingleSetting('firstLaunch', false))
    dispatch(setOpenAtLogin(true))
  }
}

export const setOpenAtLogin = enabled => dispatch => {

  dispatch(setSingleSetting('openAtLogin', enabled))

  ipcRenderer.send('openAtLogin', {
    enabled
  })
}