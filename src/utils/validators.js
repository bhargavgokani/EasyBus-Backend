function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongEnoughPassword(password) {
  // Simple baseline: length >= 8. Can be strengthened later.
  return typeof password === "string" && password.length >= 8;
}

module.exports = { isValidEmail, isStrongEnoughPassword };

