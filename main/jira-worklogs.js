import request from 'request-promise'
import log from 'electron-log'
import λ from 'contra'
import flatten from 'array-flatten'
import parse from 'date-fns/parse'
import orderBy from 'lodash.orderby'
import differenceInDays from 'date-fns/difference_in_days'
import keychain from './keychain'

// JIRA doesn't provide a nice way to return all the users worklogs
// We therefore need to do some pretty heavy lifting and it's best
// not to do this in the render thread. Lets kick it off in the main
// process here and then pass back results to the renderer

class JiraWorklogs {
  constructor () {
    this.fetching = false
    this.lastFetched = Date.now()

    keychain.getCredentials()
      .then(credentials => log.info('Keychain credentials found'))
      .catch(error => log.info('Unable to fetch credentials', error))
  }

  checkLock (throttle) {
    return new Promise((resolve, reject) => {
      if (this.fetching) {
        log.info('Already fetching worklogs, request denied')
        return reject()
      }

      let executionStart = Date.now()

      // For regular requests we want to throttle how often then can be called
      if (throttle) {
        let secondsSinceLastFetch = Math.round((executionStart - this.lastFetched) / 1000)

        if (secondsSinceLastFetch < 5) {
          log.info('Fetched too recently, request denied')
          return reject()
        }
      }

      resolve()
    })
  }

  request (userKey, throttle) {
    throttle = throttle || false

    let executionStart = Date.now()

    return new Promise((resolve, reject) => {

      this.checkLock(throttle)
        .then(() => {

          this.fetching = true
          keychain.jiraUserKey = userKey

          this.fetchMine()
            .then(worklogs => {
              this.fetching = false
              let executionSeconds = Math.round((Date.now() - executionStart) / 1000)
              log.info('Fetched worklogs', worklogs.length, `Took: ${executionSeconds} seconds`)

              this.lastFetched = Date.now()
              resolve(worklogs)
            })
            .catch(error => {
              this.fetching = false
              log.info('Failed to fetch worklogs', error)

              this.lastFetched = 0
              reject(error)
            })
        })
        .catch(() => reject())
    })
  }

  fetchMine () {
    return new Promise((resolve, reject) => {
      if (!keychain.authKey) {
        keychain.getCredentials()
          .then(() => {
            this.fetch(keychain.jiraUserKey)
              .then(worklogs => resolve(worklogs))
              .catch(error => reject(error))
          })
          .catch(error => {
            log.info('Unable to fetch credentials', error)
            reject(error)
          })
      } else {
        this.fetch(keychain.jiraUserKey)
          .then(worklogs => resolve(worklogs))
          .catch(error => reject(error))
      }
    })
  }

  fetch () {
    return new Promise((resolve, reject) => {
      this.fetchRecentlyUpdatedTasks()
        .then(tasks => {

          log.info('Latest tasks', tasks.length)

          let worklogs = []

          // We now need to fetch the worklogs for each of these tasks
          // Lets throttle the number of API calls we are making at once
          λ.each(tasks, 4, (task, callback) => {

            this.fetchWorklogsForTaskAndUser(task)
              .then(userWorklogs => {

                if (userWorklogs.length)
                  worklogs.push(userWorklogs)

                callback()
              })
              .catch(error => { callback(error) })

          }, err => {

            log.info('Finished fetching all worklogs')

            if (err) {
              this.fetching = false
              return reject(err)
            }

            let flatWorklogs = flatten(worklogs)
            let orderedWorklogs = orderBy(flatWorklogs, ['created'], ['desc'])

            resolve(flatten(orderedWorklogs))
          })
        })
        .catch(error => {
          log.info('Error fetching latest tasks', error)
          this.fetching = false
          reject(error)
        })
    })
  }

  fetchRecentlyUpdatedTasks (startAt = 0) {
    return new Promise((resolve, reject) => {
      let tasks = []

      this.fetchUpdatedTasks(startAt)
        .then(response => {
          tasks = response.issues

          if (response.total > 100 && startAt === 0) {
            this.fetchUpdatedTasks(100)
              .then(response => {
                tasks = tasks.concat(response.issues)
                resolve(tasks)
              })
              .catch(error => resolve(tasks))
          } else {
            resolve(tasks)
          }
        })
        .catch(error => reject(error))
    })
  }

  fetchUpdatedTasks(startAt) {
    return new Promise((resolve, reject) => {
      this.sendRequest('/search', 'POST', {
        jql: `worklogAuthor = currentUser() && worklogDate >= -1w`,
        maxResults: 100,
        fields: ['key', 'summary', 'project']
      })
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }

  fetchWorklogsForTaskAndUser (task) {
    return new Promise((resolve, reject) => {

      this.sendRequest(`/issue/${task.key}/worklog?maxResults=1000`, 'GET')
        .then(response => {

          let currentUserWorklogs = []

          //log.info('Worklogs in issue', task.key, response.worklogs.length)

          response.worklogs.forEach(worklog => {

            let created = parse(worklog.created)
            let ageInDays = differenceInDays(new Date(), created)

            if (worklog.author.key === keychain.jiraUserKey && ageInDays < 7)
              currentUserWorklogs.push({
                id: worklog.id,
                created: worklog.started,
                timeSpentSeconds: worklog.timeSpentSeconds,
                task: {
                  id: task.id,
                  key: task.key,
                  summary: task.fields.summary
                }
              })
          })

          resolve(currentUserWorklogs)
        })
        .catch(error => reject(error))
    })
  }

  sendRequest (urlPath, method, data = {}) {
    return new Promise((resolve, reject) => {
      request({
        uri: `https://${keychain.baseUrl}/rest/api/2${urlPath}`,
        headers: {
          'Authorization': `Basic ${keychain.authKey}`,
        },
        method: method,
        body: data,
        simple: true,
        timeout: 20000,
        json: true,
      })
        .then(response => resolve(response))
        .catch(error => reject(error))
    })
  }


}

export default new JiraWorklogs()
