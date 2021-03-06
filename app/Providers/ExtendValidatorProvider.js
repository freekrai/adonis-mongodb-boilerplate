'use strict'

const { ServiceProvider } = require('@adonisjs/fold')

class ExtendValidatorProvider extends ServiceProvider {
  existValidator (data, field, message, args, get) {
    const Exceptions = use('Exceptions')
    return new Promise((resolve, reject) => {
      /**
       * skip if value is empty, required validation will
       * take care of empty values
       */
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      const collectionName = args[0]
      const databaseField = args[1] || field
      if (!collectionName) {
        throw new Exceptions.RunTimeException('Unique rule require collection name')
      }
      (async () => {
        const database = db.collection(collectionName)
        database.where(databaseField).eq(fieldValue)
        /**
         * if args[2] and args[3] are available inside the array
         * take them as whereNot key/value pair to limit scope
         */
        if (args[2] && args[3]) {
          database.where(args[2]).eq(args[3])
        }

        const exists = await database.findOne()
        return exists
      }).then(function (exists) {
        if (exists) {
          reject(message)
        } else {
          resolve('valid')
        }
      }).catch(reject)
    })
  }

  digitValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (/^\d+/i.test(fieldValue)) {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  numericValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      let fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (typeof fieldValue === 'number') {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  lengthValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (fieldValue.length === parseInt(args[0])) {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  objectIdValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (/^(?=[a-f\d]{24}$)(\d+[a-f]|[a-f]+\d)/i.test(fieldValue)) {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  minValueValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (fieldValue >= args[0]) {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  maxValueValidator (data, field, message, args, get) {
    return new Promise((resolve, reject) => {
      const fieldValue = get(data, field)
      if (!fieldValue) {
        return resolve('validation skipped')
      }
      if (fieldValue <= args[0]) {
        resolve('valid')
      } else {
        reject(message)
      }
    })
  }

  * boot () {
    // register bindings
    const Validator = use('Adonis/Addons/Validator')
    Validator.extend('exist', this.existValidator, '{{field}} is not exists')
    Validator.extend('objectId', this.objectIdValidator, '{{field}} is not valid ObjectID')
    Validator.extend('digit', this.digitValidator, '{{field}} is not valid digit')
    Validator.extend('numeric', this.numericValidator, '{{field}} is not valid numeric')
    Validator.extend('length', this.lengthValidator, '{{field}} is not valid length')
    Validator.extend('minValue', this.minValueValidator, '{{field}} is not valid minValue')
    Validator.extend('maxValue', this.maxValueValidator, '{{field}} is not valid maxValue')
  }
}

module.exports = ExtendValidatorProvider
