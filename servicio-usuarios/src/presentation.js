function publicUser(user) {
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: String(source._id || source.id),
    nombre: source.nombre,
    email: source.email
  };
}

module.exports = { publicUser };
