# Issue: Akamai Bot Manager blocks kmart.com.au and target.com.au (#67)

> **Status: investigation, not a fix. No code was changed.**
>
> Everything below was measured on 2026-09-22 from a single Swiss residential
> connection. Section 6 proposes code changes; none of them have been written,
> and each is a separate piece of work.
>
> **It overturns the working model the issue has been running on**, and three
> separate things turned out to be going on where the issue assumed one.
>
> 1. **The denial is a score, not a rule.** It follows the client, not the
>    route, degrades with request volume and recovers with silence. Three
>    consecutive requests 800 ms apart were served the full product page; the
>    fourth was denied (§3.4). The issue's `/p/*`-is-blocked conclusion does not
>    hold — a category page never requested before was denied in the same
>    minute the homepage returned 200 (§3.5).
> 2. **Headless Chromium is scored down, and most of that is its own
>    User-Agent.** Headless Chrome announcing `HeadlessChrome/153` was denied 6
>    times out of 6. With the User-Agent overridden it recovered to 3 of 6.
>    Headful Chrome, interleaved in the same window, was 9 of 9 (§4.1). The
>    configured browser path only sends a User-Agent when the retailer has an
>    override, so these retailers may be announcing headless Chromium by name
>    — subject to one check nobody has run (§4.1).
> 3. **One of Akamai's two block pages is invisible to PriceStalker.** The
>    behavioural-challenge interstitial arrives with HTTP 200, no `<title>` and
>    2,728 bytes, and matches **none** of the patterns in `detection.ts`. It is
>    currently scraped as a product page that happens to have no price (§4.2).
>
> Section 6 ranks what to do about each, cheapest-first.

---

## 1. What this changes

| the issue believed | the measurements say |
|---|---|
| Akamai Bot Manager is applied to `/p/*` and not to `/` | The denial follows the **client**, not the route. `/c/toys` — never requested before in the session — was denied in the same minute `/` returned 200 (§3.5). |
| The block survives everything because it scores the browser environment — renderer, GPU, canvas/WebGL | Partly right, for the wrong reason. Headless Chromium *is* scored down (§4.1), but `--disable-gpu` makes no difference in either direction, and most of the effect is the `HeadlessChrome` User-Agent token rather than anything about the renderer. |
| The stack cannot reach these retailers | The stack's own transport **can and does** reach them, at low request rates. §3.4 shows three consecutive clean product-page fetches from a cold client. |
| The next lever is a residential proxy | Still unmeasured, and no longer the obvious next step. Three cheaper levers with measurements behind them come first (§7). |
| Every hypothesis produced a byte-identical failure, so none of them mattered | They produced byte-identical *Access Denied* pages. There is a second block page — 200, 2,728 bytes, no title — that nothing in the stack recognises (§4.2). |

None of the six hypotheses eliminated on the issue were eliminated wrongly.
Headers, cookie jars, cold browsers, warmed browsers and referers all failed as
reported. What changes is the conclusion drawn from them: they failed because
by the time each was tested the client had already been scored down, and none
of them addresses a reputation score.

---

## 2. Which path these retailers take through the scraper

`acquireHtml()` in `backend/src/services/scraper/acquisition/index.ts` has three
attempts, and which one a retailer gets depends on one flag.

```
use_browser_scraper = true   → Attempt 1: remote Puppeteer (scraper/)
                               ↓ only if it returns NOTHING
use_browser_scraper = false  → Attempt 2: axios over Node HTTP
                               ↓ only if challenged AND no retailer_configs row
                               Attempt 3: remote Puppeteer fallback
```

Three properties of this matter for Akamai, and all three are visible in the
source rather than inferred:

**A single attempt is made, and a 403 is never retried.**
`acquireStandardHtml()` wraps the request in `withRetry(..., { maxRetries: 1 })`,
but `withRetry`'s `retryCondition`
(`backend/src/utils/system/retry.ts`) returns `true` only for 429, 500, 502,
503, 504 and network errors. A 403 fails the condition and is rethrown on the
first attempt. It then becomes `BotChallengeError` → `challengeReason` → a
terminal failure for that scrape.

Not retrying immediately is the right call — §3.4 shows back-to-back retries are
exactly what burns the budget. But nothing retries *later* either, and that is
the gap.

**A challenged browser response ends the scrape with no second path.**
When `use_browser_scraper = true` and the remote scraper returns the Akamai
Access Denied page, `html` is non-empty, so Attempt 2 is skipped; and
`usedRemoteFallback` is already `true`, so Attempt 3 is skipped. The challenge
HTML goes to extraction as if it were a product page. This is already
registered as audit item **A-3** ("Challenged Remote HTML Prevents Attempt 3
With No Recovery") in `docs/SCRAPER_AUDIT.md`; this investigation confirms it
is live, and that it is exactly the path a retailer with
`use_browser_scraper = true` takes on an Akamai denial.

**One denial flags the whole retailer BLOCKED.**
`handleRetailerMaintenance()` → `flagBlockedRetailer()`
(`backend/src/services/scraper/retailer-maintenance.ts`) writes
`status = 'BLOCKED'` on a single challenge, and `restoreRetailerStatus()`
writes it back to `OK` on a single success. Against a probabilistic denial —
see §3.6, where success and denial alternate minute by minute — this flaps.

---

## 3. What the stack presents, and what Akamai does with it

### 3.1 The denial is real, is Akamai's, and is detected correctly

Captured live, plain HTTP, `www.target.com.au/p/star-wars-zero-company-playstation-5/73359609`:

```
HTTP/2 403
server: AkamaiGHost
content-length: 448
set-cookie: t_geo_country=CH; t_geo_region=ZH; t_geo_city=ZURICH
server-timing: ak_p; desc="1790060470729_34901661_..."
```

```html
<TITLE>Access Denied</TITLE>
<H1>Access Denied</H1>
Reference&#32;&#35;18&#46;9d8e1402&#46;1790060470&#46;f9bd044
https&#58;&#47;&#47;errors&#46;edgesuite&#46;net&#47;18&#46;...
```

`detectBotChallenge()` matches this twice over — `AKAMAI_TITLE` on
`Access Denied` and `AKAMAI_BODY` on both `Reference #18.` and
`errors.edgesuite.net`. Detection is not the problem and has not been since
#149.

It also settles audit item **A-14** ("Akamai `Reference #18.` pattern too
specific"). The concern is real in principle — `AKAMAI_BODY` still only matches
the `#18.` prefix — but it costs nothing here, because the same alternation
matches `errors.edgesuite.net`, which carries no reference number and appeared
on every denial captured, from both retailers. A-14 can be downgraded to
cosmetic unless a denial turns up with neither marker.

### 3.2 The transport fingerprint matters — but not in the direction assumed

Same machine, same IP, same URL, within three minutes of each other. The
variable of interest is which TLS stack sent the ClientHello.

| client | TLS stack | HTTP | `/` | `/p/star-wars-...` |
|---|---|---|---|---|
| `curl 8.7.1` | LibreSSL 3.3.6 / SecureTransport | h2 | **403, 373 B** | **403, 448 B** |
| `curl 8.7.1 --http1.1` | LibreSSL 3.3.6 / SecureTransport | 1.1 | — | **403, 450 B** |
| `curl 8.7.1 --no-alpn` | LibreSSL 3.3.6 / SecureTransport | 1.1 | — | **403, 448 B** |
| `node 26 https` | OpenSSL 3 | 1.1, no ALPN | **200, 411,707 B** | **200, 387,478 B** |

curl is denied cold, on its very first request of the session, on every route,
at both HTTP versions and with ALPN disabled. So the HTTP/2 fingerprint is not
what is deciding it — curl's TLS ClientHello is simply on a deny list, which is
what Akamai's known-client-fingerprint feature does.

Node is not on that list today, and Node's fingerprint is not remotely
browser-like: OpenSSL cipher ordering, no ALPN negotiated at all, HTTP/1.1
against a host that offers h2. A Chrome-claiming User-Agent over a connection
that never even offered h2 is about as inconsistent as a request can be, and it
was served the product page anyway.

**The practical reading:** Akamai is not requiring a browser-grade fingerprint
on these properties. It is denying specific known-bad ones and otherwise
scoring by behaviour. PriceStalker's axios transport sits on the permitted side
of that line — for now, and at low volume.

One loose end in the table above, closed in §4.2: the first curl run sent
`User-Agent`, `Accept` and `Accept-Language` only, where the Node run sent the
full header set `getHeaders()` builds, client hints included. §4.2 repeats the
comparison with byte-identical headers on both sides.

### 3.3 The JavaScript sensor is not the gate

Every successful response set `_abck`, and every one of them looked like this:

```
_abck=DC9B0A72...~-1~YAAQFxYVAuQG...~-1~-1~-1~-1~-1
         ^^^^ sensor state: not validated
```

The `-1` is Akamai Bot Manager's "sensor has not posted back" state — the same
state the issue correctly identified as the reason a plain-HTTP cookie jar
cannot help. It is still `-1` on the requests that **succeeded**. Full product
pages were served to a client that never executed the sensor.

That matters because it removes the main argument for the browser path on these
retailers. Running a real browser so the sensor can validate `_abck` is not
buying access here, because access is not conditioned on a validated `_abck`.

### 3.4 Denial is probabilistic and volume-scored

Ten requests to the same Target product URL, 800 ms apart, from a client that
had been quiet for several minutes:

| # | status | bytes | title |
|---|---|---|---|
| 1 | 200 | 387,479 | Star Wars Zero Company - PlayStation 5 \| Target Australia |
| 2 | 200 | 387,727 | Star Wars Zero Company - PlayStation 5 \| Target Australia |
| 3 | 200 | 387,479 | Star Wars Zero Company - PlayStation 5 \| Target Australia |
| 4 | **403** | 605 | Access Denied |
| 5 | 200 | 387,479 | Star Wars Zero Company - PlayStation 5 \| Target Australia |
| 6–10 | **403** ×5 | 603–605 | Access Denied |

Three clean product pages, then a hard turn. This is the shape of a score
crossing a threshold, not of a rule matching a route. It also explains the
whole history of the issue: every hypothesis after the first few probes was
tested against an already-degraded client, so every hypothesis failed
identically, and byte-for-byte, because they were all receiving the same cached
denial page.

### 3.5 Denial follows the client, not the route

Immediately after the burst above, from the same client:

| URL | status | note |
|---|---|---|
| `target.com.au/` | 200, 411,707 B | edge-cached, served throughout |
| `target.com.au/c/toys` | **403, 538 B** | never requested before in this session |
| `kmart.com.au/` | 200, 2,825,356 B | different property, still fine |
| `kmart.com.au/product/nintendo-switch-2-console-black-89116968/` | **403, 600 B** | first request to any Kmart product route |

`/c/toys` is the one that settles it. It had never been touched, and it was
denied in the same minute that `/` returned 200. The block is not attached to
`/p/*`; it is attached to the client, and `/` keeps answering because it is
served from the edge cache (`server-timing: cdn-cache; desc=HIT` appears on
both the 200s and the denials).

The Kmart result is worth separating out: that was a cold route on a property
we had barely touched, and it was denied on the first request. Either Kmart's
policy is tuned tighter than Target's, or Akamai's cross-customer client
reputation had already carried the score over from the Target burst. This
investigation cannot tell those apart.

### 3.6 Recovery is slow, and probing prevents it

Same URL, one request per minute, starting from the denied state:

```
07:04  403      07:10  403
07:05  200      07:11  403
07:06  403      07:12  200
07:07  403      07:13  403
07:08  403      07:14  200
07:09  403      07:15  403
```

Three successes in twelve minutes, scattered, with no pattern to them — and
note that all three of the later ones came back slightly smaller (375–376 KB
against 387 KB cold), so even the successful responses are not identical to
what an unscored client gets. A request per minute is evidently enough to keep
the score pinned down, which is the mechanism behind the maintainer's
observation that the page came back after three days of silence.

The scatter is itself the finding. There is no clean "blocked" and "unblocked"
state to detect; there is a score that sometimes clears the bar. Any code that
reasons about this in binary terms — `status = 'BLOCKED'`, restore on one
success — is modelling something that does not exist.

For a price tracker this is the encouraging half of the finding. A product on a
6- or 12-hour schedule makes two requests a day. The measurements say a client
that has been quiet gets served. What it does not get served is a client that
asks four times in three seconds — and §5 shows that is what the scheduler
currently does.

### 3.7 A real Chrome was denied while raw Node HTTP succeeded

Google Chrome 153.0.8010.53 — the genuine article, not Puppeteer's Chromium,
with a fresh profile and no automation framework — `--headless=new`, against
the Kmart product URL:

```html
<title>Access Denied</title>
<h1>Access Denied</h1>
Reference #18.56f90a17.1790060699.f9f5b6
```

340 bytes of DOM. A real Chrome TLS fingerprint, a real HTTP/2 SETTINGS frame,
a real renderer — and it was denied, in a session where a Node script with no
browser at all had been pulling full product pages.

The obvious reading of that is that making the browser more convincing cannot
help, since a genuine browser is denied too. **That reading is wrong, and §4
shows why.** Headless Chrome announces itself in its own User-Agent, and this
run did not override it. Run it headful, or override the string, and the result
changes. §4 takes it apart.

---

## 4. The controlled comparisons

§3 left two confounds: the browser arms were measured on an already-scored
client, and the curl/Node comparison did not use identical headers. Both were
re-run. The browser comparison is the one that changed the conclusion.

Every run below launched a real Google Chrome 153.0.8010.53 with a fresh,
empty profile, torn down afterwards, navigating to the same Target product URL,
and read the page title back over the DevTools protocol. Arms were interleaved
minute by minute so that all of them see the same client score.

### 4.1 Headless is the discriminator, and most of it is the User-Agent

| arm | OK | denied | window |
|---|---|---|---|
| **headful**, default UA | **9** | 0 | 07:31–07:42 |
| **headless** (`--headless=new`), default UA | 0 | **5** | 07:32–07:38 |
| **headless**, UA overridden to `Chrome/146.0.0.0` | 3 | 3 | 07:37–07:42 |
| plain Node HTTP, same window, for scale | 1 | 5 | 07:28–07:41 |

Two separate effects, and they need separating carefully:

**Effect one — the `HeadlessChrome` token, and it is decisive.** Chrome's
`/json/version` on this build reports:

```
headless : Mozilla/5.0 (Macintosh; …) HeadlessChrome/153.0.0.0 Safari/537.36
headful  : Mozilla/5.0 (Macintosh; …) Chrome/153.0.0.0 Safari/537.36
```

Headless Chrome announces itself, in the User-Agent, by name. Every one of the
five denials in the second row was a browser that said `HeadlessChrome` on the
way in. 0 for 5 on Target, plus the Kmart run in §3.7, is 0 for 6. Nothing
subtle is happening there.

**Effect two — headless is still worse once the string is fixed, but this is
suggestive rather than established.** With `--user-agent` set to the Chrome 146
string `getHeaders()` uses, headless recovered to 3 of 6, against headful's 9
of 9 measured in the same interleaved window. That gap is real enough to act
on and thin enough not to overstate: six samples, on a scored client, against
a denial that is probabilistic to begin with (§3.4). It is consistent with
Akamai scoring something else about headless Chromium, and it is also
consistent with noise.

**`--disable-gpu` is not involved.** It was isolated, because
`scraper/src/core/SessionManager.ts` passes it and software rendering is a
plausible WebGL tell:

| arm | result |
|---|---|
| headful **with** `--disable-gpu` | product page |
| headful **without** | product page |
| headless **with** `--disable-gpu` | Access Denied |
| headless **without** | Access Denied |

The flag makes no difference in either direction. Whatever is being scored, it
is not the GPU.

**Why this matters for `acquisition/remote.ts`.** The configured browser path
sets the User-Agent only when the retailer has an override:

```ts
if (domainConfig?.user_agent) {
  remoteOptions.userAgent = domainConfig.user_agent;
}
```

There is no fall-through to `resolveUserAgent()`, which is what
`acquisition/fallback.ts` does. So a retailer with `use_browser_scraper = true`
and no per-retailer User-Agent — the state kmart.com.au and target.com.au would
be in — sends no UA to the scraper service, which passes no
`--user-agent` to Chromium, which then announces whatever it announces.

**Whether that is a live bug depends on one thing this investigation could not
check:** `puppeteer-extra-plugin-stealth`'s `user-agent-override` evasion
normally strips the `Headless` token, and `scraper/` loads the full stealth
plugin set. If it does strip it, the configured browser path behaves like the
3-of-6 row rather than the 0-of-6 row, and the fix is worth less. The package
is not installed in this working tree, so this is stated as a thing to verify
first, not as a defect to go and fix. **Verify before building** — it decides
whether option 5d in §6 is worth anything.

### 4.2 curl vs Node with byte-identical headers, and a page nothing detects

Repeating §3.2's comparison with the full `getHeaders()` header set on both
sides, back to back:

| client | result |
|---|---|
| node A | 403, 603 B, Access Denied |
| curl `--http2`, full headers | **200, 2,728 B** |
| curl `--http1.1`, full headers | 403, 448 B, Access Denied |
| node B | 403, 605 B, Access Denied |

The 200 is not a product page. It is Akamai Bot Manager's **behavioural
challenge interstitial**, and it is the most consequential thing found in this
investigation after §3.4:

```html
<!DOCTYPE html><html><body>
<script type="text/javascript" src="/GMhXa/m/x0/MOFy/…?v=8083001e-…&t=330639649"></script>
<div id="sec-if-cpt-container" role="main" style="display: none">
  <div class="behavioral-content">
    <div id="sec-bc-text-container"></div>
    <div id="sec-bc-tile-parent">…</div>
    <div class="behavioral-button progress-btn-disabled">…</div>
    <div class="scf-akamai-logo-sec-abc">
      <p class="scf-akamai-protected-by">Powered and protected …
<noscript><img src="https://www.target.com.au/akam/13/pixel_5f33a13e?a=…"></noscript>
```

**`detectBotChallenge()` does not catch it.** Every pattern was tested against
the captured file and every one returns zero matches:

| pattern | matches |
|---|---|
| `AKAMAI_TITLE` /access denied/ | 0 — **the page has no `<title>` element at all** |
| `AKAMAI_BODY` /Reference #18.\|errors.edgesuite.net/ | 0 |
| `GENERIC_BODY` /captcha\|prove you are human\|are you a robot\|unusual traffic\|automated access/ | 0 |
| every Cloudflare / DataDome / Incapsula / PerimeterX pattern | 0 |

So this page — 2,728 bytes, HTTP 200, no title, no price — flows straight
through acquisition as though it were a product page. Extraction finds nothing.
`challengeReason` stays `null`, so the browser fallback never fires and the
retailer is never flagged. Auto-mapping runs on challenge HTML, generates
nothing usable and is rejected. The user is told *"No price could be found on
this page. If the price is rendered by JavaScript, enable the Browser
Scraper"* — advice that will not help, for a page that was in fact a bot
challenge.

This is the same class of bug as #149, on a page #149 did not have a sample of.
The markers are distinctive and stable: `sec-if-cpt-container`,
`scf-akamai-logo`, the `behavioral-content` / `sec-bc-*` cluster, and the
`/akam/<n>/pixel_` sensor image in the `<noscript>`. Any one of them is
specific enough to match on; the `/akam/…/pixel_` path is the one that
generalises across Akamai Bot Manager deployments rather than being specific to
this interstitial's markup.

It also means the six eliminations on the issue may have been measuring more
than one thing. A 2.7 KB 200 and an 8.3 KB Access Denied are different
responses from different parts of Bot Manager, and only one of them was ever
recognised as a block.

---

## 5. Where PriceStalker spends its budget

If the constraint is request volume per client, then the question is what
PriceStalker's request pattern looks like to Akamai. It looks worse than it
needs to.

**`PriceCheckTask.ts` paces globally, not per domain.**

```ts
const limit = pLimit(3);
const tasks = products.map(product => limit(async () => {
  await productRefreshService.refreshProduct(product);
  const delay = 1000 + Math.floor(Math.random() * 2000);   // 1–3 s
  await new Promise((resolve) => setTimeout(resolve, delay));
}));
```

`findDueForRefresh()` (`product-lookup.repository.ts`) has no `ORDER BY` at
all, and the concurrency limit and the jitter are both global. A user tracking
eight items at target.com.au gets three simultaneous requests to
target.com.au, then three more one to three seconds later. That is the §3.4
burst almost exactly — and §3.4 says the fourth request is where it turns.

It is worse than random ordering would suggest. Products added in one sitting
share a retailer, sit adjacent in the heap, and carry the same default refresh
interval, so they come due in the same sweep and Postgres hands them back
together. The scheduler then fires them as a block.

Note what this means for diagnosis: the *first* product a user adds at one of
these retailers will often work, and the failure appears once a few are
tracked. That matches the issue's original report of not being able to add
products only loosely, and it is worth checking against a real instance's logs.

**Nothing re-attempts a denied scrape later.** A denial is terminal for that
scrape, and the next attempt is a full refresh interval away.

**On a scheduled refresh, an Akamai denial is recorded nowhere.** This one is
worth spelling out, because the code reads as though it is handled and it is
not.

`UnavailableReason` (`backend/src/types/availability.ts`) declares
`'bot_or_challenge'` in its transient group, and both
`backend/src/types/availability.ts` and `frontend/src/utils/availability.ts`
carry the user-facing text for it: *"The retailer served a bot check instead of
the product page"*. **Nothing ever assigns it.** A grep across `backend/src`
and `frontend/src` returns the type declaration and the two descriptions, and
no assignment.

The reason is structural. `result.unavailableReason` is only set in
`scrapeProductWithVoting`'s `catch` block — from `PageNotAvailableError.reason`,
or from `classifyTransportError()`, which knows about DNS, timeouts and refused
connections and not about challenges. But a bot challenge never reaches that
`catch`: `acquireHtml()` catches `BotChallengeError` and converts it to a
`challengeReason` string, which becomes `failureReason = 'bot_challenge'` on a
normal return.

So in `ProductRefreshService.refreshProduct()`, `scrapedData.unavailableReason`
is `undefined` for a denied scrape. `isTransient` is false, `isDefinitive` is
false, and the `else if (!reason)` branch runs — which *clears* the failure
state. A retailer can deny every scheduled refresh indefinitely and the failure
counter stays at zero, `notifyNotAvailable` never fires, and the product's page
shows nothing. The comment directly above that branch names "a bot challenge"
as one of the transient failures it counts. It does not.

This is @stevene1919's front-end-feedback point, and it survived the #149 fix:
#115 and #149 made the *add* path explain itself, and the add path reads
`failureReason`. The *refresh* path reads `unavailableReason`, which is the one
nothing sets.

**The dynamic fallback never uses the proxy.**
`handleAcquisitionFallback()` in `acquisition/fallback.ts` builds its
`remoteOptions` with `productId`, `isDiscovery`, `userAgent` and `referrer` —
and no proxy, even when the retailer has `use_proxy = true`. The configured
browser path (`acquisition/remote.ts`) does pass it. So the one path that runs
*because* the client has just been blocked is the one path that cannot use the
proxy that might unblock it.

**Per-retailer proxy config is half-built already.** `use_proxy` is a per-
retailer boolean on `retailer_configs`; `scraper_proxy` is a single global URL
in `system_settings` (`SettingsCache.getScraperProxy()`). The per-retailer
*decision* exists; only the per-retailer *endpoint* is missing. That is one
nullable column and a settings-resolution change, not the rebuild the issue
assumed.

---

## 6. Options, ranked by cost against measured likelihood

| # | option | cost | evidence it would help | verdict |
|---|---|---|---|---|
| 1 | **Per-domain request spacing in the scheduler** | Low — group `findDueForRefresh()` results by domain, serialise within a domain, add a per-domain minimum gap. | Direct. §3.4: three requests at 800 ms succeed, the fourth does not. §3.6: a quiet client gets served. | **Do this.** |
| 2 | **Delayed re-attempt on challenge** | Low–moderate — on `bot_challenge`, schedule one retry minutes later rather than failing the scrape. | Direct. §3.6 recorded a 200 between 403s at one-minute spacing. | **Do this.** |
| 3 | **Stop flagging BLOCKED on a single denial** | Low — require N consecutive challenges, mirroring the existing `PAGE_GONE_THRESHOLD` streak. | Direct. §3.4/§3.6 show denial alternating with success. | **Do this.** |
| 4 | **Let a challenged browser response fall through to HTTP** | Low — in `acquireHtml`, treat challenge HTML from Attempt 1 as "no HTML" for the purposes of Attempts 2 and 3. | Indirect: audit item A-3 is a plain logic bug regardless, and §3.2 shows the HTTP path does reach these retailers. | **Do this.** Already an open audit item. |
| 5 | **Pass the proxy through the dynamic fallback** | Trivial — three lines. | It is a plain defect; whether it helps depends on the proxy. | **Do this** regardless of #67. |
| 5b | **Set `unavailableReason = 'bot_or_challenge'` on a denial** | Trivial — the value, the strings and the frontend rendering all exist already; only the assignment is missing. | Direct. §5 shows a denied refresh currently clears the failure state and tells the user nothing. | **Do this.** It is the remaining half of @stevene1919's feedback point. |
| 5c | **Detect the Akamai behavioural interstitial** | Trivial — one pattern in `detection.ts`, matching `sec-if-cpt-container`, `scf-akamai-logo` or `/akam/\d+/pixel_`, plus a test with the captured sample. | Direct, and this is the strongest single finding after §3.4. §4.2: a 200-status bot challenge with no `<title>` passes every existing pattern and is scraped as a product page. | **Do this first.** |
| 5d | **Always resolve a User-Agent on the configured browser path** | Trivial — `acquisition/remote.ts` should call `resolveUserAgent()` the way `fallback.ts` already does, instead of only using a per-retailer override. | Strong, conditional. §4.1: headless with the default UA is 0/6; with a UA it is 3/6. Conditional on stealth not already stripping the token — **verify that first** (§4.1). | **Verify, then do.** Cheapest thing on this list with a measured effect behind it. |
| 6 | **Per-retailer proxy URL** | Moderate — one nullable `retailer_configs` column, a migration, resolution order, admin UI. Useless without a paid residential proxy. | Untested. @stevene1919's test is still the only thing that would answer it, and §3 now says to baseline it without the proxy first and space the requests. | **Build when someone has a proxy to point at it**, not before. |
| 7 | **Headful Chromium under Xvfb in `scraper/`** | Moderate–high — Xvfb in the image, `headless: false`, larger container. Not `--disable-gpu`: §4.1 rules that out. | §4.1: headful 9/9 against headless 3/6 with the UA corrected, and 0/6 without. The strongest arm measured. | **Worth doing** — after 5d, which is far cheaper and may capture most of the gain. |
| 8 | **A different stealth library** (rebrowser-puppeteer, patchright, camoufox) | High — swap the core of `scraper/`, re-validate every working retailer. | None directly. §3.3 shows the JS sensor is not the gate. §4.1's residual headless gap is what such a library would target, but option 7 targets it more directly. | **No**, or at least not before 7. |
| 9 | **A commercial unblocking API** | Low to build, ongoing money, external dependency in a self-hosted tracker. | Would work; that is what these services sell. | **Product decision, not a bug fix.** Keep on the table, do not build first. |
| 10 | **Close as unsupported** | Free. | Contradicted: §3.2 shows the stack fetching the page it is said not to be able to fetch. | **No.** |

---

## 7. Recommendation

**Do options 5c, 5d, 1, 2, 3, 5 and 5b, in that order. Then reassess before
spending anything on 6, 7 or 9.**

The order is deliberate, and it is not the order of expected impact — it is
cheapest-first among the things that have a measurement behind them.

1. **5c — detect the interstitial.** One pattern and one test. Until this
   lands, a bot challenge is being scraped as a product page and the user is
   given advice that cannot work (§4.2). Everything else is easier to reason
   about once blocks are visible as blocks.
2. **5d — always resolve a User-Agent on the browser path.** Verify first that
   stealth is not already stripping the `Headless` token. If it is not, this is
   a three-line change against a 0-of-6 versus 3-of-6 result (§4.1).
3. **1, 2, 3 — pace, retry late, stop flapping.** The denial is a score that
   degrades with volume and recovers with silence (§3.4, §3.6), and the
   scheduler currently spends the whole budget in the first three seconds of a
   sweep (§5). These change PriceStalker from "burst, then declare the retailer
   blocked" to "ask rarely, wait when refused, try again later" — which is the
   behaviour that was being served product pages all morning.
4. **5, 5b — two plain defects** found on the way through: the fallback cannot
   use the proxy, and a denied refresh is recorded nowhere.

Then stop and measure again, because the picture changed twice during one
morning's testing and it is likely to change again.

**On the browser.** §4.1 is the one place where "run a better browser" has real
evidence behind it: headful was 9 for 9 where headless with a corrected UA was
3 for 6. If option 5d does not close that gap, option 7 — Xvfb and a headful
Chromium in the `scraper/` image — is justified, and it is the only thing on
this list that touches `scraper/`. Do not reach for a different stealth library
(option 8): §3.3 shows the JS sensor is not the gate, and option 7 addresses
the same gap more directly and more cheaply.

**On the proxy.** Still unmeasured, still the only thing nobody has tried. But
it is no longer the obvious next step it looked like, and §3.4 means any proxy
test must take a no-proxy baseline first and space its requests out, or it will
measure the burn rather than the proxy.

**On the user-facing message.** #115's failure text is the right shape, but its
advice — "Enable the Browser Scraper for this retailer" — points at the path
§4.1 shows is *worse* than plain HTTP unless it is run headful. Worth a
separate branch for an Akamai challenge that says the retailer is rate-limiting
and the product will be retried, rather than suggesting a setting that will not
help.

---

## 8. What could not be determined from here

Stated plainly, because the issue has already cost several rounds of confident
conclusions:

- **Whether this reproduces from Australia.** Everything here is one Swiss
  residential IP. Target set `t_geo_country=CH` on every request. The original
  reporter is in Australia and no measurement in this document is from there.
  The question the maintainer asked twice on the issue — does the URL load in a
  normal browser in Australia — is still unanswered and is still cheap.
- **Whether Kmart and Target are tuned differently, or share a score.** Kmart
  denied a cold product route; Target allowed three. This ran after the Target
  burst, so cross-customer reputation carry-over cannot be ruled out. A clean
  test needs Kmart probed first, from a rested client.
- **What the actual thresholds are.** "Three at 800 ms is fine, four is not" is
  one observation of one property on one day. The minimum safe gap for option 1
  is not known; start conservative (one request per domain per minute, or
  slower) and tune from logs.
- **How long recovery takes.** Observed: partial, scattered recovery within
  twelve minutes while being probed once a minute, never clean. Reported on the
  issue: three days of silence was enough. Everything between is unmeasured,
  and no measurement here separates "time elapsed" from "requests not made".
- **Whether `puppeteer-extra-plugin-stealth` already strips the `Headless`
  token from the User-Agent.** This is the most important open question in the
  document, because it decides whether option 5d is a three-line fix with a
  0-of-6 result behind it or a change to code that is already correct. The
  package is not installed in this working tree. Checking it is a one-line
  experiment against the running scraper container: request any page and look
  at what arrives.
- **What the residual headless gap actually is.** §4.1's 3-of-6 against
  headful's 9-of-9 is suggestive and no more. Whether it is a real signal, and
  if so whether it is `navigator.webdriver`, window dimensions, the absence of
  a compositor, or something else, was not investigated. `--disable-gpu` was
  ruled out and nothing else was ruled in.
- **Whether the plain Chromium in the `scraper/` image behaves like the Google
  Chrome used here.** Every browser measurement used Chrome 153 on macOS. The
  scraper runs Debian's `chromium` package in a container. Same engine,
  different build, different platform, and stealth loaded on top.
- **Whether axios differs materially from raw `node:https`.** The §3.2 Node
  measurements use `node:https` directly, which is the same TLS stack and the
  same HTTP/1.1 agent axios sits on, with the headers `getHeaders()` produces.
  It is a faithful stand-in, not the literal code path. Re-running §3.2 from
  inside the backend container would close that gap.
- **Anything about a proxy.** No proxy was used or available for any
  measurement in this document.

---

## 9. Reproducing this

No repository code is needed.

**The HTTP probe** is a dozen lines: `https.request` with the headers
`getHeaders()` builds, printing status, byte count and `<title>`. Three runs:

1. **Cold single request** — one product URL after several minutes of silence.
   Expect 200 and a real title.
2. **Burst** — ten requests, 800 ms apart. Expect the turn somewhere around
   the third or fourth.
3. **Recovery** — one request per minute afterwards. Expect mostly 403,
   scattered with the occasional 200.

**The browser comparison** needs no Puppeteer. Launch Chrome with
`--remote-debugging-port`, a fresh `--user-data-dir` and the product URL as its
last argument; wait twenty seconds; read the page title from
`http://127.0.0.1:<port>/json/list`, picking the target whose `type` is `page`
and whose `url` matches the retailer. `"Access Denied"` or the product name is
the whole result. Vary one flag at a time — `--headless=new`, `--user-agent`,
`--disable-gpu` — and **interleave the arms**, one run each in rotation, never
all of one arm and then all of the other.

**The interstitial** is easiest to provoke with `curl --http2` and the full
header set on a scored client. It is the 200 response of about 2.7 KB; keep the
body, because it is the sample `detection.ts` needs a test against.

Always take the cold baseline first, and never compare two arms measured more
than a minute apart. A burst leaves the client scored down for long enough to
invalidate anything measured after it — which is how five successive hypotheses
on this issue all produced byte-identical failures, and how this investigation
reached the wrong conclusion about headless Chrome in §3.7 before §4.1
corrected it.
