import Store from 'electron-store'
import Immutable from 'seamless-immutable'

const storage = new Store()

// Save redux state to local file
export const persistMiddleware = ({ getState }) => next => action => {
  // Get the state after the action was performed
  next(action)
  let latestState = getState()

  let mutableState = Immutable.asMutable(latestState, {deep: true})

  // We need to null the authToken as we store this in secure keychain
  mutableState.user.authToken = null

  storage.set('redux', mutableState)
}

export default storage
