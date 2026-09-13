# Discovery provider evaluation — 2026-09-13

## Decision

Do not change production discovery based on this test. Neither tested public endpoint passes the release gate: recognizable studio versions of Hey Jude, Strange Fruit, and Robot Stop must appear first without specifying an artist. Evaluate the authenticated Apple Music catalog next, if a MusicKit developer token is available. The public iTunes Search API is a separate service; its results do not establish the quality or coverage of Apple Music API search.

## Method

Ran ten title-only searches against the public US iTunes song endpoint and Deezer's public search endpoint, returning 25 results per search. Requests were spaced by at least 3.2 seconds per provider. No account credentials, game writes, LLM calls, or production changes. `scripts/eval-discovery.mjs` reproduces the comparison; raw normalized responses are in `discovery-2026-09-13.json`.

Rank is an exact normalized title plus expected-artist match, not proof of the correct performance or edition. Artist substring matching accommodates credit variations. Parenthetical live/remaster qualifiers are not discarded in this metric. This strict rule can undercount remasters of the intended performance; it can also count a different edit with an identical title. Individual results were inspected for those limitations. Ten handpicked cases and one timing sample per query are directional evidence, not a statistically representative benchmark or service-level guarantee. Cache state and geography can change results.

| Song / intended artist | iTunes rank | Deezer rank |
| --- | ---: | ---: |
| Hey Jude / The Beatles | 1 | 2* |
| Strange Fruit / Billie Holiday | 1 | 1 |
| Robot Stop / King Gizzard (studio) | absent | absent |
| New York Kiss / Spoon | 1 | 1 |
| Avril 14th / Aphex Twin | 1 | 1 |
| Sense / King Gizzard | 1 | absent |
| Selkies: The Endless Obsession / BTBAM | 1 | 1 |
| Phantom Island / King Gizzard | absent | 1 |
| Vampire Empire / Big Thief | 1 | 1 |
| Hey Jude (Live) / Paul McCartney | 1 | 1 |

- iTunes: 8/10 title/artist matches first; median response 315 ms.
- Deezer: 7/10 title/artist matches first; median response 295 ms.
- *Deezer's first Hey Jude result is a 2015 remaster. The exact-title match at rank 2 is the shortened Love version (239 seconds), so this is not a successful original-recording identification.
- Both APIs surfaced other-field matches, requiring a local title filter to preserve the game's no-artist-browsing rule. Filtering cannot recover a recording absent from the fetched page.

## Follow-up probes

Adding King Gizzard to the iTunes query and increasing the limit to 50 still did not find the exact studio Robot Stop or title track Phantom Island. Their absence from these results does not establish absence from the entire service.

Deezer's `track:"Robot Stop"` query returned the studio recording first. However, applying the same query form to Hey Jude, Strange Fruit, and Sense also produced unrelated results containing the word "track". `strict=on` did not resolve this inconsistency. A production adapter should not assume this syntax reliably enforces title-only matching. Deezer's official developer documentation redirected to login in this environment, so its current documented quotas and access conditions were not verified.

## Identity bridge

Read-only Deezer track lookups returned ISRCs. Three MusicBrainz ISRC lookups completed in 0.64–1.42 seconds including the consumer lookup and local rate pacing:

- Robot Stop: USATO1600102 → one matching studio recording, 322 seconds.
- Avril 14th: GBBPW0100148 → one matching recording, 125 seconds.
- Hey Jude (Remastered 2015): GBUM71505902 → one matching **2015 stereo mix**, not the original mono studio mix.

See `recording-bridge-2026-09-13.json`. An ISRC establishes a recording/mix identity; it does not by itself establish the original performance's release year. We must explicitly define how later mixes relate to the original recording for decade grading. Do not substitute a performance merely because its title and artist match.

## Access and limits

- Public iTunes API: approximately 20 calls/minute, subject to change; Apple recommends caching. Lower public throughput than MusicBrainz, so not a scaling solution by itself. [Apple docs](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html)
- MusicBrainz: one request/second per application, shared across players in our implementation. Still needed for verification. [API docs](https://musicbrainz.org/doc/MusicBrainz_API)
- Full Apple Music API: requires Apple Developer Program membership and a signed MusicKit developer token; supports ISRC metadata. Not tested without credentials. Apple documents 429 throttling without a fixed numeric allowance on the token-generation page. [Token docs](https://developer.apple.com/documentation/AppleMusicAPI/generating-developer-tokens), [MusicKit](https://developer.apple.com/musickit/)
- Spotify: not live-tested without credentials. Public-app suitability needs review of current quota-mode eligibility; extended quota applications are limited to organizations. July 2026 changes pool development quota per developer account. [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [July update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)

## Next release gate

Test full Apple Music with the same cases plus artist narrowing and cover/live controls. Only choose a default after verifying required first results and safe MusicBrainz matching. Preserve artist narrowing and explicit unverified/no-guess-used behavior. Resolve metadata on submission, cache identity links, and retain existing MusicBrainz IDs for old guesses. No provider switch has been deployed from this evaluation.
