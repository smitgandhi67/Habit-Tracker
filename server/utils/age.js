// Age helper for the Capabilities module. Derives whole-year age from a birthdate,
// counting a birthday as reached only on/after the day itself.

function ageFromBirthdate(birthdate, now = new Date()) {
  if (!birthdate) return null;
  const b = new Date(birthdate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const monthDiff = now.getMonth() - b.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < b.getDate())) {
    age -= 1;
  }
  return age < 0 ? null : age;
}

module.exports = { ageFromBirthdate };
