function uniqueEmail(baseEmail, tag = 'qa') {
  const [local, domain] = baseEmail.split('@');
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return `${local}+${tag}-${stamp}@${domain}`;
}

module.exports = {
  uniqueEmail,
};
