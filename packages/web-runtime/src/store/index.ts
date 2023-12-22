import ancestorMetaData from './ancestorMetaData'
import app from './app'
import apps from './apps'
import auth from './auth'
import config from './config'
import user from './user'
import navigation from './navigation'
import spaces from './spaces'

const strict = process.env.NODE_ENV === 'development'

const runtime = {
  namespaced: true,
  modules: {
    ancestorMetaData,
    auth,
    spaces
  }
}

export default {
  modules: {
    app,
    apps,
    user,
    config,
    navigation,
    runtime
  },
  strict
}
