function buildTokenClaims(user) {
  const userId = String(user._id);
  return {
    sub: userId,
    userId,
    email: user.email
  };
}

function createAccessToken(user, options = {}) {
  const jwtImpl = options.jwtImpl || require('jsonwebtoken');
  const secret = options.secret || process.env.JWT_SECRET;
  const expiresIn = options.expiresIn || process.env.JWT_EXPIRES_IN || '2h';
  return jwtImpl.sign(buildTokenClaims(user), secret, { expiresIn });
}

module.exports = { buildTokenClaims, createAccessToken };
