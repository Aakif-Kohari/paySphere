const BaseRepository = require('./base.repository');
const User = require('../models/user.model');

/**
 * Concrete UserRepository class handling specialized User queries.
 */
class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find a user by their email address.
   */
  async findByEmail(email, options = {}) {
    return this.findOne({ email: email.trim().toLowerCase() }, options);
  }

  /**
   * Find a user by their Google login ID.
   */
  async findByGoogleId(googleId, options = {}) {
    return this.findOne({ googleId }, options);
  }

  /**
   * Find a user with a valid, non-expired password reset token.
   */
  async findByResetToken(hashedToken, options = {}) {
    return this.findOne(
      {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
      },
      options
    );
  }
}

module.exports = new UserRepository();
