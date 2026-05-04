# diagnostic-funnel

Static frontend for the Remote Work Abroad Readiness Assessment at
**diagnostic.homelinkrouters.us**. Backend lives in `homelink-api`
(`internal/handlers/diagnostic.go`).

## Layout

```
.
├── index.html                Landing page (hero video + value prop + CTAs)
├── quiz.html                 Single-page 15-question quiz + email gate
├── results.html              Score ring + dynamic insight cards + risk table
├── diagnostic.css            Shared brand tokens + page-specific styles
├── diagnostic.js             Quiz state machine + drop-off event tracking
├── results.js                Results renderer + score-ring animation
├── briefs/                   15 destination-specific HTML briefs
├── guides/                   Static companion playbooks shipped in the
│                             email bundle (travel-day, return-trip-cleanup,
│                             if-it-pings-you)
└── scripts/
    └── gen-briefs.py         Templating helper that emits briefs/*.html
```

## Deploy

The site is served from `/var/www/diagnostic/` on the api server (138.197.110.14)
via the diagnostic vhost (`/etc/nginx/sites-available/diagnostic`). To push:

```bash
scp index.html quiz.html results.html diagnostic.css diagnostic.js results.js \
    api:/var/www/diagnostic/
scp briefs/*.html api:/var/www/diagnostic/briefs/
scp guides/*.html api:/var/www/diagnostic/guides/
```

No build step — pure static HTML/CSS/JS.

## Funnel architecture

1. **Landing page** (`/`) — hero video, value-prop block, founder cred,
   bottom CTA. Click → `/quiz`.
2. **Quiz** (`/quiz`) — 15 questions render in JS one screen at a time.
   Auto-advance on single-select; manual Next on multi-select / textarea.
   Final step is the email gate with blurred score preview.
3. **Submit** — POSTs to `/api/diagnostic/submit`. Server computes score
   authoritatively, persists, fires async results email, returns
   `{token, score, band}`.
4. **Results** (`/results?t=<token>`) — fetches the persisted assessment
   from `/api/diagnostic/results`, renders the animated score ring, three
   band-specific insight cards, a row-filtered risk-breakdown table, and
   score-band-specific next-steps CTA.

## Drop-off tracking

The quiz fires events to `/api/diagnostic/event` to identify exact abandon
points:

| Event | Step | When |
|---|---|---|
| `question_view` | 1–15 | Each time a question screen renders |
| `gate_view` | 16 | NELP gate appears after Q15 |
| `submit_click` | 16 | User hits "See my results" |
| `abandon` | last seen | `pagehide` / `visibilitychange:hidden` (sendBeacon) |

Per-tab `session_id` ties events together. No PII captured. See
`diagnostic_quiz_events` table.

## Destination briefs

15 country/region-specific 2-page risk briefs:

```
portugal · spain · mexico · japan · thailand
costa-rica · colombia · argentina · vietnam · indonesia
united-kingdom · italy · france · germany · greece
```

Conditional delivery — when a quiz-taker enters a recognized destination
in the optional "Where are you headed?" field, the results email includes
a link to the corresponding brief. Matching keywords + display-name map
live in `homelink-api/internal/handlers/diagnostic.go`.

To add or revise briefs, edit `scripts/gen-briefs.py` and rerun:

```bash
python3 scripts/gen-briefs.py
scp briefs/*.html api:/var/www/diagnostic/briefs/
```

The first 5 briefs (portugal, spain, mexico, japan, thailand) were
hand-written before the templater existed and don't go through it.

## Email-bundle companion guides

Three static playbooks in `guides/`, linked from the results email
alongside the destination brief:

- `travel-day.html` — T-7 days through day 3 abroad, hour-by-hour
- `return-trip-cleanup.html` — six things to do around your return so
  the trailing 30 days of audit logs look ordinary
- `if-it-pings-you.html` — emergency playbook for the first 24 hours
  after IT asks about your location, including a "step zero" check on
  whether the alarm is even real (stale VPN, mis-routed travel router,
  ISP geo-IP error, etc.)

Same brand styling as briefs, `noindex` so they don't surface in search.
The personalized risk-fix PDF (item 1 of the email-bundle promise on the
landing page) is generated server-side per assessment — see
`homelink-api/internal/handlers/diagnostic.go`.
