const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

export function getEmailDomain(email: string) {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

// Many universities use a separate student subdomain (e.g. st.knust.edu.gh
// for students vs knust.edu.gh for staff) — collapse those onto the same
// root domain so students and lecturers from the same institution share one
// University row and can see each other's courses.
export function normalizeUniversityDomain(domain: string) {
  const labels = domain.split(".");
  if (labels.length > 1 && (labels[0] === "student" || labels[0] === "st")) {
    return labels.slice(1).join(".");
  }
  return domain;
}

export function isLikelyUniversityEmail(email: string) {
  const domain = getEmailDomain(email);
  return Boolean(domain) && !FREE_EMAIL_DOMAINS.has(domain);
}

export function getUniversityNameFromDomain(domain: string) {
  return domain
    .split(".")[0]
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
