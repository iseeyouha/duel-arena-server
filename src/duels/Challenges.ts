import type { DuelRules } from "../duel/rules.js";

/** What a challenger brings: the offer opens on these. */
export type Terms = { rules: DuelRules; stake: number };
export type Request = { from: string; to: string; terms: Terms; until: number };

/** How long a request waits for its answer. */
export const REQUEST_SECONDS = 20;

/**
 * Duel requests waiting for an answer, by session id. One out per challenger: a new one replaces
 * theirs. Times are in milliseconds. Not state: a request is lost on a reconnect.
 */
export class Challenges {
  private requests = new Map<string, Request>();

  /** Returns the request this one replaced, if any, so its target can be told. */
  request(from: string, to: string, terms: Terms, now: number) {
    const replaced = this.requests.get(from);
    this.requests.set(from, { from, to, terms, until: now + REQUEST_SECONDS * 1000 });
    return replaced && replaced.to !== to ? replaced : undefined;
  }

  find(from: string, to: string) {
    const request = this.requests.get(from);
    return request?.to === to ? request : undefined;
  }

  take(from: string, to: string) {
    const request = this.find(from, to);
    if (request) { this.requests.delete(from); }
    return request;
  }

  /** Every request to or from somebody, gone, so each other side can be told. */
  dropAll(id: string) {
    const dropped = [...this.requests.values()].filter((request) => request.from === id || request.to === id);
    for (const request of dropped) this.requests.delete(request.from);
    return dropped;
  }

  expire(now: number) {
    const expired = [...this.requests.values()].filter((request) => now >= request.until);
    for (const request of expired) this.requests.delete(request.from);
    return expired;
  }
}
