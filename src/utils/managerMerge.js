/** Code de réunion d'espaces gérants : même forme côté interface et SQL. */
export const normaliserCodeReunionGerants = (value = '') =>
  String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export const codeReunionGerantsValide = (value) =>
  /^[A-Z0-9]{12}$/.test(normaliserCodeReunionGerants(value));
