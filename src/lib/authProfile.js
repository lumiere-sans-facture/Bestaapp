// Un compte Auth est le même sur le web et dans l'APK : son uid est la clé
// stable du profil. Les anciens profils (u1/u2/...) restent liés par email.
// Une erreur de lecture n'est JAMAIS une preuve que le profil est absent.
const emailSansJokers = (email) => email.replace(/[\\%_]/g, '\\$&');

export const fetchAuthProfile = async (client, authUser) => {
  const email = authUser?.email?.trim();
  if (!client || !email) return { profile: null, injoignable: true };

  let erreurLecture = false;
  try {
    if (authUser.id) {
      const { data, error } = await client.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (data) return { profile: data, injoignable: false };
      erreurLecture = Boolean(error);
    }

    // Compatibilité avec les profils antérieurs aux uid Supabase. La casse
    // de l'email historique peut différer de celle normalisée par Auth.
    const { data, error } = await client.from('profiles').select('*')
      .ilike('email', emailSansJokers(email)).maybeSingle();
    if (data) return { profile: data, injoignable: false };
    return { profile: null, injoignable: erreurLecture || Boolean(error) };
  } catch {
    return { profile: null, injoignable: true };
  }
};
