import Immutable from 'seamless-immutable'
import api from '../lib/api'
import { ipcRenderer } from 'electron'
import { push } from 'react-router-redux'

// Actions
const USER_LOGIN = 'jt/user/USER_LOGIN'
const USER_LOGIN_RESPONSE = 'jt/user/USER_LOGIN_RESPONSE'
const USER_LOGOUT = 'jt/user/USER_LOGOUT'
const USER_SET_AUTH_TOKEN = 'jt/user/USER_SET_AUTH_TOKEN'
const USER_SET_PROFILE = 'jt/user/USER_SET_PROFILE'
const USER_SET_JIRA_DOMAIN = 'jt/user/USER_SET_JIRA_DOMAIN'

const initialState = Immutable({
  loginPending: false,
  loginError: false,
  authToken: null,
  jiraDomain: null,
  profile: {},
})

// Reducer
export default function reducer (state = initialState, action = {}) {
  switch (action.type) {

    case USER_LOGIN:
      return state.set('loginPending', true)

    case USER_LOGIN_RESPONSE: {
      let nextState = state.set('loginPending', false)

      if (action.status === 'success') {
        nextState = nextState.set('loginError', initialState.loginError)
      } else {
        nextState = nextState.set('loginError', action.error)
      }

      return nextState
    }

    case USER_LOGOUT: {
      ipcRenderer.send('updateTitle', 'Login')
      return state.set('authToken', null)
    }

    case USER_SET_AUTH_TOKEN: {
      ipcRenderer.send('updateTitle', 'Idle')
      return state.set('authToken', action.token)
    }

    case USER_SET_PROFILE:
      return state.set('profile', action.profile)

    case USER_SET_JIRA_DOMAIN:
      return state.set('jiraDomain', action.jiraDomain)

    default: return state
  }
}

// Action Creators
export const userLoginResponse = (status, error) => ({
  type: USER_LOGIN_RESPONSE,
  status,
  error,
})

export const setAuthToken = token => ({
  type: USER_SET_AUTH_TOKEN,
  token
})

export const setProfile = profile => ({
  type: USER_SET_PROFILE,
  profile
})

export const setJiraDomain = jiraDomain => ({
  type: USER_SET_JIRA_DOMAIN,
  jiraDomain
})

export const isLoggedIn = state =>
  state.accessToken


// Side effects
export const userLogin = (username, password, authUrl) => async dispatch => {
  dispatch({ type: USER_LOGIN })

  api.login(username, password, authUrl)
    .then(response => {
      dispatch(userLoginResponse('success', null))
    })
    .catch(error => {
      console.log('error logging in', error)
      dispatch(userLoginResponse('error', true))
    })
}

export const userLogout = () => dispatch => {
  api.logout()
  dispatch({ type: USER_LOGOUT })
}
