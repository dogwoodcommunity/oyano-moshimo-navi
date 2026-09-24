/** A route is only a request: the readable people list remains authoritative. */
export function resolveConsultTarget<T extends { id: string }>(
  people: readonly T[],
  requestedId: string | string[] | undefined
): { person: T | null; reason: "selected" | "choose" | "unavailable" | "empty" } {
  if (requestedId !== undefined) {
    const person = typeof requestedId === "string" && requestedId
      ? people.find((candidate) => candidate.id === requestedId) ?? null
      : null;
    return { person, reason: person ? "selected" : "unavailable" };
  }
  if (people.length === 1) return { person: people[0], reason: "selected" };
  return { person: null, reason: people.length ? "choose" : "empty" };
}

/** Invalidate outstanding reads/writes when a person's screen is replaced. */
export function createConsultTargetScope() {
  let revision = 0;
  let active = false;
  const capture = () => {
    const capturedRevision = revision;
    return () => active && revision === capturedRevision;
  };
  return {
    begin() {
      revision += 1;
      active = true;
      return capture();
    },
    capture,
    invalidate() {
      active = false;
      revision += 1;
    }
  };
}
