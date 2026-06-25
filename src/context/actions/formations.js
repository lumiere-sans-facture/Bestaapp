// Domaine formation des techniciens : modules et avancement par utilisateur.
export function createFormationActions(setState) {
  return {
    addFormation: (formation) =>
      setState((s) => ({
        ...s,
        formations: [...(s.formations || []), { ...formation, id: crypto.randomUUID() }],
      })),

    updateFormation: (formationId, patch) =>
      setState((s) => ({
        ...s,
        formations: (s.formations || []).map((f) => (f.id === formationId ? { ...f, ...patch } : f)),
      })),

    deleteFormation: (formationId) =>
      setState((s) => ({
        ...s,
        formations: (s.formations || []).filter((f) => f.id !== formationId),
        formationProgress: (s.formationProgress || []).filter((p) => p.formationId !== formationId),
      })),

    setFormationProgress: (userId, formationId, status) =>
      setState((s) => {
        const rest = (s.formationProgress || []).filter((p) => !(p.userId === userId && p.formationId === formationId));
        return {
          ...s,
          formationProgress: [
            { id: `fp-${userId}-${formationId}`, userId, formationId, status, date: new Date().toISOString() },
            ...rest,
          ],
        };
      }),
  };
}
