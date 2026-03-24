/**
 * Trace cumulatif pour chaque requête backend.
 * Chaque étape est horodatée relativement au début de la requête.
 * Le résultat est injecté dans la clé `debug` de toute réponse JSON.
 */
export class RequestTrace {
  private entries: { t: number; msg: string }[] = []
  private t0 = Date.now()
  readonly route: string

  constructor(route: string) {
    this.route = route
    this.log(`-> ${route}`)
  }

  log(msg: string): void {
    this.entries.push({ t: Date.now() - this.t0, msg })
  }

  toJSON(): {
    route: string
    total_ms: number
    ts: string
    entries: { t: number; msg: string }[]
  } {
    return {
      route: this.route,
      total_ms: Date.now() - this.t0,
      ts: new Date(this.t0).toISOString(),
      entries: [...this.entries],
    }
  }

  /** Safe for HTTP headers (ASCII-only, no newlines). */
  toHeaderValue(): string {
    const raw = JSON.stringify(this.toJSON())
    return raw.replace(/[^\x20-\x7E]/g, "?")
  }
}
