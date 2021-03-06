'use strict'
const BaseController = use('App/Controllers/Http/Api/BaseController')
const User = use('App/Models/User')
const Exceptions = use('Exceptions')
const Config = use('Config')
const Hash = use('Hash')
const Mail = use('Mail')
const crypto = use('crypto')
const uuid = use('uuid')

/**
 *
 * @class AuthController
 */
class AuthController extends BaseController {
  /**
   * Register
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf UsersController
   *
   */
  async register ({ request, response }) {
    const user = new User(request.only('name', 'email', 'password'))
    const verificationToken = crypto.createHash('sha256').update(uuid.v4()).digest('hex')
    user.fill({
      verificationToken: verificationToken,
      verified: false
    })
    await user.save()
    return response.apiCreated(user)
    // await Mail.send('emails.verification', { user: user }, (message) => {
    //   message.to(user.email, user.name)
    //   message.from(Config.get('mail.sender'))
    //   message.subject('Please Verify Your Email Address')
    // })
  }

  /**
   * Login
   *
   * @param {any} request
   * @param {any} response
   *
   * @memberOf AuthController
   *
   */
  async login ({ request, response, auth }) {
    const email = request.input('email')
    const password = request.input('password')
    await this.validate(request.all(), { email: 'required', password: 'required' })
    // Attempt to login with email and password
    const { token, refreshToken } = await auth.withRefreshToken().attempt(email, password)
    const user = await User.findBy({ email })
    if (!user.verified) {
      throw new Exceptions.AccountNotVerifiedException('Email is not verified')
    }
    user.token = token
    user.refreshToken = refreshToken
    response.apiSuccess(user)
  }

  /**
   * Logout
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async logout ({ request, response, auth }) {
    await auth.logout()

    return response.send('success')
  }

  /**
   * Social login
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async socialLogin ({ request, response, auth }) {
    const network = request.param('social')
    await this.validate(request.all(), { socialToken: 'required|string' })
    await this.validate({ social: request.param('social') }, { social: 'required|in:facebook,google' })
    const Social = use('Adonis/Auth/Social')
    const socialToken = request.input('socialToken')
    const socialUser = await Social.verifyToken(network, socialToken)
    if (!socialUser) {
      throw new Exceptions.LoginFailedException('Invalid token')
    }
    let user = await User.where('email', socialUser.email).first()
    if (!user) {
      user = await User.create({
        name: socialUser.name,
        email: socialUser.email,
        language: socialUser.locale.substring(2),
        verified: true,
        socialId: socialUser.id,
        password: use('uuid').v4(),
        avatar: network === 'facebook' ? socialUser.picture.data.url : socialUser.picture
      })
    }
    user.token = await auth.generate(user)
    return response.apiSuccess(user)
  }

  /**
   * re-sends verification token to the users
   * email address.
   *
   * @param  {Object} request
   * @param  {Object} response
   *
   */
  async sendVerification ({ request, response }) {
    await this.validate(request.all(), { email: 'required' })
    const user = await User.findBy({ email: request.input('email') })
    if (!user) {
      throw new Exceptions.ResourceNotFoundException(`Can not find user with email "${request.input('email')}"`)
    }
    const verificationToken = crypto.createHash('sha256').update(uuid.v4()).digest('hex')
    user.verificationToken = verificationToken
    await user.save()
    response.apiSuccess(null, 'Email sent successfully')
    await Mail.send('emails.verification', { user: user }, (message) => {
      message.to(user.email, user.name)
      message.from(Config.get('mail.sender'))
      message.subject('Please Verify Your Email Address')
    })
  }

  /**
   * verifies a user account with a give
   * token
   *
   * @param  {Object} request
   * @param  {Object} response
   */
  async verify ({ request, response }) {
    const token = request.input('token')
    const user = await User.findBy({ verificationToken: token })
    if (!user) {
      throw new Exceptions.BadRequestException(`Invalid token`)
    }
    user.verified = true
    user.unset('verificationToken')
    await user.save()
    await request.with({ message: 'Account verified successfully' }).flash()
    response.redirect('/')
  }

  /**
   * Me
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async me ({ request, response, auth }) {
    const user = await auth.getUser()
    return response.apiSuccess(user)
  }

  /**
   * Forgot
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async forgot ({ request, response }) {
    await this.validate(request.all(), { email: 'required' })
    const user = await User.findBy({ email: request.input('email') })
    if (!user) {
      throw new Exceptions.ResourceNotFoundException(`Can not find user with email "${request.input('email')}"`)
    }
    const verificationToken = crypto.createHash('sha256').update(uuid.v4()).digest('hex')
    user.verificationToken = verificationToken
    await user.save()

    response.apiSuccess(null, 'Email sent successfully')

    await Mail.send('emails.reset', { user: user }, (message) => {
      message.to(user.email, user.name)
      message.from(Config.get('mail.sender'))
      message.subject('Reset your password')
    })
  }

  /**
   * Reset password form
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async getReset ({ request, response }) {
    const token = request.input('token')
    const user = await User.findBy({ verificationToken: token })
    if (!token || !user) {
      throw new Exceptions.BadRequestException(`Invalid token`)
    }
    await response.sendView('reset', { token: token })
  }

  /**
   * Reset password
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async postReset ({ request, response }) {
    const token = request.input('token')
    await this.validate(request.all(), {
      password: 'required|min:6|max:50',
      passwordConfirmation: 'same:password'
    })
    const password = request.input('password')
    const user = await User.findBy({ verificationToken: token })
    if (!token || !user) {
      throw new Exceptions.BadRequestException(`Invalid token`)
    }
    const hashPassword = await Hash.make(password)
    user.password = hashPassword
    user.unset('verificationToken')
    await user.save()
    await request.with({ message: 'Reset password successfully' }).flash()
    response.redirect('/')
  }

  /**
   * Change password
   *
   * @param {any} request
   * @param {any} response
   * @returns
   *
   * @memberOf AuthController
   *
   */
  async password ({ request, response, auth }) {
    await this.validate(request.all(), { password: 'required', newPassword: 'required|min:6|max:50' })
    const password = request.input('password')
    const newPassword = request.input('newPassword')
    const user = await auth.getUser()
    const check = await Hash.verify(password, user.password)
    if (!check) {
      throw new Exceptions.ValidateErrorException('Password does not match')
    }
    const hashPassword = await Hash.make(newPassword)
    user.set('password', hashPassword)
    user.unset('verificationToken')
    await user.save()
    response.apiSuccess(user, 'Change password successfully')
  }
}

module.exports = AuthController
