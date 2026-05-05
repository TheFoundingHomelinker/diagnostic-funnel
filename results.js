/* Results page renderer — runs in two modes:

   FULL mode:    URL has ?t=<token>. Fetches stored assessment, renders
                 every section including bundle reminder, destination
                 teaser, and testimonial.

   PREVIEW mode: No token. Reads quiz answers from sessionStorage (set
                 by diagnostic.js at end of Q15). Computes score
                 client-side and renders score + insights + projection
                 + risk table. Hides the bundle reminder, destination
                 teaser, and testimonial. Shows an inline email gate
                 between the risk table and those hidden sections.
                 On gate submit, transitions to full mode in-place.

   This delivers the score-first / gate-second flow: real users see
   their number and identified issues before being asked for an email. */

(function () {
  'use strict';

  var API_BASE = '/api';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('t') || '';

  // Per-tab session id — match how diagnostic.js sets it up so funnel
  // events fired here can be tied back to the same quiz session.
  var SID = (function () {
    try {
      var k = 'hl_diag_sid';
      var id = sessionStorage.getItem(k);
      if (!id) {
        id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (Math.random() * 16) | 0;
                return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
              });
        sessionStorage.setItem(k, id);
      }
      return id;
    } catch (e) { return ''; }
  })();

  function fireEvent(eventType, step, meta) {
    if (!SID) return;
    try {
      fetch(API_BASE + '/diagnostic/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: SID,
          event_type: eventType,
          step: step || 0,
          meta: meta || null,
        }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // ── Boot: pick mode based on token / sessionStorage ─────────────
  var previewState = null;
  if (!token) {
    try {
      var raw = sessionStorage.getItem('hl_diag_preview');
      if (raw) previewState = JSON.parse(raw);
    } catch (e) {}
  }

  // Defer the boot to a microtask so the var declarations at the bottom
  // of this IIFE (INSIGHTS, RISK_ROWS, NEXT_STEPS) are assigned before
  // render() runs. The full-mode flow worked accidentally because
  // fetch().then() is naturally async; preview mode would otherwise run
  // synchronously and hit those vars while still undefined.
  Promise.resolve().then(function () {
    if (token) {
      document.body.classList.add('hl-mode-full');
      fetch(API_BASE + '/diagnostic/results?token=' + encodeURIComponent(token))
        .then(function (r) {
          if (!r.ok) throw new Error('not found');
          return r.json();
        })
        .then(function (data) { render(data, 'full'); })
        .catch(function () { window.location.href = '/'; });
    } else if (previewState && previewState.answers) {
      document.body.classList.add('hl-mode-preview');
      var pscore = scoreWithAnswers(previewState.answers);
      var pband = bandFor(pscore);
      var pdata = {
        score:         pscore,
        band:          pband,
        answers:       previewState.answers,
        name:          '',
        location:      '',
        profession:    '',
        brief_slug:    '',
        brief_display: '',
      };
      render(pdata, 'preview');
      setupInlineGate(pdata);
      fireEvent('preview_view', 0);
    } else {
      window.location.href = '/';
    }
  });

  // ── Mirror of server-side scoring for preview-mode score reveal ───
  var CORRECT_ANSWERS = {
    1: 'yes', 2: 'no', 3: 'no', 4: 'yes', 5: 'no',
    6: 'yes', 7: 'no', 8: 'no', 9: 'no', 10: 'yes',
  };
  function scoreWithAnswers(a) {
    var s = 0;
    for (var qid in CORRECT_ANSWERS) {
      var got = a[qid];
      if (got === CORRECT_ANSWERS[qid]) s += 8;
      else if (got === 'sometimes') s += 4;
    }
    if (a[1]  === 'yes') s += 10;
    if (a[8]  === 'no')  s += 10;
    if (a[5]  === 'no')  s += 5;
    if (a[10] === 'yes') s += 15;
    var q11 = a[11] || '';
    if (q11.indexOf('I work abroad with my employer') === 0) s += 20;
    else if (q11.indexOf('caught') > -1) s -= 10;
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    return s;
  }
  function bandFor(score) {
    if (score <= 40) return 'high';
    if (score <= 70) return 'moderate';
    return 'low';
  }

  // ── Inline email gate (preview mode) ─────────────────────────────
  function setupInlineGate(pdata) {
    var host = document.getElementById('inline-gate');
    if (!host) return;
    host.innerHTML =
      '<div class="hl-inline-gate__inner">' +
        '<div class="hl-inline-gate__form-block">' +
          '<h2>Don\'t get on the plane without these.</h2>' +
          '<p>Every gap above gets a fix step — exact instructions, time required, cost — in your personalized blueprint. Plus the Travel Day playbook, the Return-Trip Cleanup checklist, and the "If IT pings you" emergency playbook for if anything goes sideways. All emailed the moment you submit.</p>' +
          '<form id="inline-gate-form" novalidate>' +
            '<div class="hl-inline-gate__row">' +
              '<input type="text" id="ig-name" placeholder="Name or alias" required autocomplete="given-name">' +
              '<input type="email" id="ig-email" placeholder="Email address" required autocomplete="email">' +
            '</div>' +
            '<input type="text" id="ig-location" placeholder="Where are you headed? (optional)" autocomplete="off">' +
            '<input type="text" id="ig-website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;">' +
            '<button type="submit" class="hl-btn hl-btn--big" id="ig-submit">Email me the fix plan →</button>' +
            '<p class="hl-inline-gate__fud">✓ Free  ·  ✓ Instant  ·  ✓ No card</p>' +
          '</form>' +
        '</div>' +
        '<div class="hl-inline-gate__success" id="ig-success" style="display:none;">' +
          '<div class="hl-inline-gate__success__icon">✓</div>' +
          '<h3>Sent — check your inbox.</h3>' +
          '<p>Your full work-from-abroad blueprint and the rest of the bundle are on their way. Scroll down for the in-page version.</p>' +
        '</div>' +
      '</div>';

    // Fire gate-view event when the gate scrolls into view
    var seen = false;
    var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !seen) {
          seen = true;
          fireEvent('preview_gate_view', 0);
        }
      });
    }, { threshold: 0.4 }) : null;
    if (io) io.observe(host);
    else fireEvent('preview_gate_view', 0);

    document.getElementById('inline-gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      handleInlineGateSubmit(pdata);
    });
  }

  function handleInlineGateSubmit(pdata) {
    var name     = document.getElementById('ig-name').value.trim();
    var email    = document.getElementById('ig-email').value.trim();
    var location = document.getElementById('ig-location').value.trim();
    var honeypot = document.getElementById('ig-website').value;
    if (honeypot) return;
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid name and email.');
      return;
    }
    var btn = document.getElementById('ig-submit');
    btn.disabled = true;
    btn.innerHTML = '<span class="hl-spinner"></span> Sending...';
    fireEvent('preview_submit', 0);

    fetch(API_BASE + '/diagnostic/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:       name,
        email:      email,
        location:   location,
        profession: '',
        answers:    pdata.answers,
        source:     'diagnostic-quiz',
        consent:    true,
        website:    '',
      }),
    })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (b) {
          return { status: r.status, body: b };
        });
      })
      .then(function (resp) {
        if (resp.status >= 200 && resp.status < 300 && resp.body && resp.body.token) {
          // Persist nothing — wipe sessionStorage preview state
          try { sessionStorage.removeItem('hl_diag_preview'); } catch (e) {}
          // Update URL silently to the token form
          try {
            history.replaceState(null, '', '/results?t=' + encodeURIComponent(resp.body.token));
          } catch (e) {}
          // Transition to full mode in place
          transitionToFullMode(name, location, resp.body);
        } else {
          btn.disabled = false;
          btn.textContent = 'Send me the bundle →';
          alert((resp.body && resp.body.error) || 'Something went wrong submitting. Try again?');
        }
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'Send me the bundle →';
        alert('Network error — try again?');
      });
  }

  function transitionToFullMode(name, location, submitResp) {
    document.body.classList.remove('hl-mode-preview');
    document.body.classList.add('hl-mode-full');
    // Show success state inside the gate
    document.getElementById('inline-gate-form').style.display = 'none';
    document.getElementById('ig-success').style.display = 'block';
    // Render the previously-hidden sections
    var slug = submitResp.brief_slug || '';
    var display = submitResp.brief_display || '';
    renderBundleCard(name, location, '', slug, display);
    renderDestTeaser(slug, display);
    // Use band that's already on the page
    var band = bandFor(submitResp.score);
    renderTestimonial(band);
    // Smooth scroll to the success message
    document.getElementById('inline-gate').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Render ───────────────────────────────────────────────────────
  function render(data, mode) {
    var score      = data.score;
    var band       = data.band;       // "high" | "moderate" | "low"
    var answers    = data.answers || {};
    var name       = data.name || '';
    var location   = data.location || '';
    var profession = data.profession || '';
    var briefSlug  = data.brief_slug || '';
    var briefName  = data.brief_display || '';
    var isPreview  = (mode === 'preview');

    // 1. Ring + score number + band label
    document.getElementById('band-label').textContent = bandLabel(band);
    animateScore(score, band);

    // 2. Bundle reminder card — full mode only. In preview mode, the
    //    section is hidden by CSS and rendered on gate-submit transition.
    if (!isPreview) {
      renderBundleCard(name, location, profession, briefSlug, briefName);
    }

    // 3. Insights — both modes
    var insightHost = document.getElementById('insights');
    INSIGHTS[band].forEach(function (it) {
      var card = document.createElement('div');
      card.className = 'hl-insight';
      card.innerHTML =
        '<div class="hl-insight__icon">' + escapeHtml(it.icon) + '</div>' +
        '<h3>' + escapeHtml(it.title) + '</h3>' +
        '<p>' + escapeHtml(it.body) + '</p>';
      insightHost.appendChild(card);
    });

    // 4. Score projection — both modes
    renderProjection(answers, score);

    // 5. Risk breakdown table — both modes. In preview mode, the
    //    "What to do" cell is wrapped in .hl-risk-locked so CSS can blur
    //    it (the prescription is gated until email submit). On gate
    //    submit, body switches to .hl-mode-full and the blur clears.
    var rowsHost = document.getElementById('risk-rows');
    RISK_ROWS.forEach(function (row) {
      if (!row.visible(answers)) return;
      var risk = row.risk(answers);
      var copy = row.copy[risk];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td data-label="Detection method">' + escapeHtml(row.method) + '</td>' +
        '<td data-label="Your risk"><span class="risk-pill ' + risk + '">' + riskLabel(risk) + '</span></td>' +
        '<td data-label="What to do" class="hl-risk-todo-cell"><span class="hl-risk-locked">' + escapeHtml(copy) + '</span></td>';
      rowsHost.appendChild(tr);
    });

    // 6. Destination brief teaser — full mode only.
    if (!isPreview) {
      renderDestTeaser(briefSlug, briefName);
    }

    // 7. Score-band testimonial — full mode only.
    if (!isPreview) {
      renderTestimonial(band);
    }

    // 8. Next steps (existing)
    var nextHost = document.getElementById('next-steps');
    var n = NEXT_STEPS[band];
    var stepsHtml = '<ol>' + n.steps.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ol>';
    var fudHtml = n.fud.length
      ? '<div class="hl-fud" style="margin-top:14px;">' + n.fud.map(function (f) { return '<span>' + escapeHtml(f) + '</span>'; }).join('') + '</div>'
      : '';
    nextHost.innerHTML =
      '<h2>' + escapeHtml(n.headline) + '</h2>' +
      stepsHtml +
      '<a href="' + n.ctaHref + '" class="hl-btn">' + escapeHtml(n.ctaText) + '</a>' +
      fudHtml;
  }

  // ── Bundle reminder card (NEW) ──────────────────────────────────
  function renderBundleCard(name, location, profession, briefSlug, briefName) {
    var host = document.getElementById('bundle-card');
    if (!host) return;
    var firstName = (function () {
      var n = (name || '').trim();
      if (!n) return 'there';
      var i = n.indexOf(' ');
      return i > 0 ? n.slice(0, i) : n;
    })();

    // Personal context line — uses location + profession when present.
    var contextLine = '';
    if (location && profession) {
      contextLine = '<p class="hl-bundle-card__context">For a <strong>' + escapeHtml(profession) + '</strong> headed to <strong>' + escapeHtml(location) + '</strong>, here\'s exactly what applies.</p>';
    } else if (location) {
      contextLine = '<p class="hl-bundle-card__context">For someone headed to <strong>' + escapeHtml(location) + '</strong>, here\'s exactly what applies.</p>';
    } else if (profession) {
      contextLine = '<p class="hl-bundle-card__context">For a <strong>' + escapeHtml(profession) + '</strong>, here\'s exactly what applies.</p>';
    }

    var briefRow = '';
    if (briefSlug) {
      briefRow = '<li><strong>Your ' + escapeHtml(briefName || briefSlug) + ' destination brief</strong> — country-specific gotchas most people miss</li>';
    }

    host.innerHTML =
      '<h2>Hey ' + escapeHtml(firstName) + ', here\'s what\'s already in your inbox.</h2>' +
      contextLine +
      '<ul class="hl-bundle-card__list">' +
        '<li><strong>Your work-from-abroad blueprint</strong> — top exposures + exact fixes, ranked by impact</li>' +
        '<li><strong>The Travel Day playbook</strong> — hour-by-hour from T-7 through Day 3 abroad</li>' +
        '<li><strong>Return-Trip Cleanup checklist</strong> — six items to handle around your return</li>' +
        '<li><strong>"If IT pings you" emergency playbook</strong> — what to do in the next 24 hours</li>' +
        briefRow +
      '</ul>' +
      '<a href="/risk-fix?t=' + encodeURIComponent(token) + '" class="hl-btn hl-btn--big">Open your blueprint →</a>' +
      '<p class="hl-bundle-card__hint">Or check your inbox — same content delivered there.</p>';
  }

  // ── Score projection (NEW) ──────────────────────────────────────
  // Mirror of server-side scoring (internal/handlers/diagnostic.go).
  // Used to compute hypothetical scores after user-applied fixes.
  var CORRECT_ANSWERS = {
    1: 'yes', 2: 'no', 3: 'no', 4: 'yes', 5: 'no',
    6: 'yes', 7: 'no', 8: 'no', 9: 'no', 10: 'yes',
  };

  function scoreWithAnswers(a) {
    var s = 0;
    for (var qid in CORRECT_ANSWERS) {
      var got = a[qid];
      if (got === CORRECT_ANSWERS[qid]) s += 8;
      else if (got === 'sometimes') s += 4;
    }
    if (a[1] === 'yes')  s += 10;
    if (a[8] === 'no')   s += 10;
    if (a[5] === 'no')   s += 5;
    if (a[10] === 'yes') s += 15;
    var q11 = a[11] || '';
    if (q11.indexOf('I work abroad with my employer') === 0) s += 20;
    else if (q11.indexOf('caught') > -1) s -= 10;
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    return s;
  }

  function bandFor(score) {
    if (score <= 40) return 'high';
    if (score <= 70) return 'moderate';
    return 'low';
  }
  function bandShort(b) {
    return b === 'high' ? 'HIGH' : b === 'moderate' ? 'MODERATE' : 'LOW';
  }

  // Only show fixes the user can actually take action on. Q2 (M365/GWS),
  // Q3 (verification history), Q5 (corp VPN required), Q8 (MDM installed),
  // Q9 (past flags) are facts, not actions — surfaced in the risk table
  // for awareness but excluded from the projection.
  var ACTIONABLE_FIXES = [
    { qid: 10, correct: 'yes', label: 'Route every device through your home IP', time: '~15 min', cost: '30-day free trial' },
    { qid: 1,  correct: 'yes', label: 'Switch to a personal device for travel work', time: 'ongoing', cost: 'Free' },
    { qid: 6,  correct: 'yes', label: 'Lock your device timezone to home', time: '30 seconds', cost: 'Free' },
    { qid: 7,  correct: 'no',  label: 'Set timezone to home in Slack, Jira, Notion', time: '5 min', cost: 'Free' },
    { qid: 4,  correct: 'yes', label: 'Pull a baseline IdP audit log', time: '5 min', cost: 'Free' },
  ];

  function renderProjection(answers, currentScore) {
    var host = document.getElementById('projection');
    if (!host) return;

    // Identify actionable fixes the user hasn't already done, ranked by leverage.
    var simAnswers = Object.assign({}, answers);
    var fixes = [];
    ACTIONABLE_FIXES.forEach(function (fix) {
      var got = answers[fix.qid];
      if (got === fix.correct) return; // already handled
      var copy = Object.assign({}, simAnswers);
      copy[fix.qid] = fix.correct;
      var newScore = scoreWithAnswers(copy);
      var delta = newScore - currentScore;
      if (delta > 0) fixes.push(Object.assign({ delta: delta }, fix));
    });
    fixes.sort(function (a, b) { return b.delta - a.delta; });
    fixes = fixes.slice(0, 3);

    if (fixes.length === 0) {
      host.innerHTML =
        '<h2>You\'re already where most people are trying to get to.</h2>' +
        '<p>No actionable fixes were surfaced — your assessment shows you\'re handling the high-leverage items already. Keep doing what you\'re doing.</p>';
      return;
    }

    // Walk the projection step by step.
    var steps = [{ score: currentScore, band: bandFor(currentScore), label: 'Today' }];
    var walking = Object.assign({}, answers);
    var totalMinutes = 0;
    fixes.forEach(function (fix, i) {
      walking[fix.qid] = fix.correct;
      var s = scoreWithAnswers(walking);
      steps.push({
        score: s, band: bandFor(s),
        label: 'After fix #' + (i + 1),
        fix: fix,
      });
      var m = parseTimeToMinutes(fix.time);
      if (m > 0) totalMinutes += m;
    });

    var stepsHtml = steps.map(function (st, i) {
      var fixHtml = '';
      if (st.fix) {
        fixHtml =
          '<div class="hl-projection__fix">' +
            '<div class="hl-projection__fix__delta">+' + st.fix.delta + '</div>' +
            '<div class="hl-projection__fix__body">' +
              '<div class="hl-projection__fix__label">' + escapeHtml(st.fix.label) + '</div>' +
              '<div class="hl-projection__fix__meta">' + escapeHtml(st.fix.time) + ' · ' + escapeHtml(st.fix.cost) + '</div>' +
            '</div>' +
          '</div>';
      }
      var stepClass = 'hl-projection__step hl-projection__step--' + st.band;
      if (i === 0) stepClass += ' hl-projection__step--current';
      if (i === steps.length - 1 && i > 0) stepClass += ' hl-projection__step--final';
      return fixHtml +
        '<div class="' + stepClass + '">' +
          '<div class="hl-projection__score">' + st.score + ' / 100</div>' +
          '<div class="hl-projection__label">' + escapeHtml(st.label) + ' · ' + bandShort(st.band) + '</div>' +
        '</div>';
    }).join('');

    var total = '';
    if (totalMinutes > 0) {
      total = '<p class="hl-projection__total">Total time: ~' + totalMinutes + ' minutes. All before your next trip.</p>';
    }

    host.innerHTML =
      '<h2>Where you could be by next week.</h2>' +
      '<p>Each fix below is yours to make. Most are free.</p>' +
      '<div class="hl-projection__steps">' + stepsHtml + '</div>' +
      total;
  }

  // Rough parser: "~15 min", "30 seconds", "5 min", "ongoing"
  function parseTimeToMinutes(t) {
    if (!t) return 0;
    if (/second/.test(t)) return 1;
    var m = t.match(/(\d+)\s*min/);
    if (m) return parseInt(m[1], 10);
    return 0;
  }

  // ── Destination brief teaser (NEW) ──────────────────────────────
  function renderDestTeaser(slug, displayName) {
    var host = document.getElementById('dest-teaser');
    if (!host) return;
    if (!slug) { host.style.display = 'none'; return; }
    var country = displayName || slug;
    host.innerHTML =
      '<h2>Your destination: ' + escapeHtml(country) + '</h2>' +
      '<p>Your full brief covers exactly what your IT can see from ' + escapeHtml(country) + ', the country-specific gotchas most people miss, and the things to handle before you go — banking, streaming, timezone overlap, all of it.</p>' +
      '<a href="/briefs/' + encodeURIComponent(slug) + '" class="hl-dest-teaser__cta">Read the full ' + escapeHtml(country) + ' brief →</a>';
  }

  // ── Score-band testimonial (NEW) ────────────────────────────────
  var TESTIMONIALS = {
    high: {
      quote: "I'm pursuing Portuguese citizenship — two years of physical residency required — but my US tech job is the only thing making it possible financially. I took the quiz expecting to feel worse, and instead I got a clear picture of what was actually leaking and what wasn't. My score was a 41, the blueprint flagged my MFA push location as the gap I'd missed entirely, and the Portugal destination brief was worth the email by itself. I knew exactly what to fix before I bought the plane ticket.",
      name: 'Kayla S.',
      role: 'Software engineer · Pursuing residency in Portugal',
      when: 'Took the assessment Feb 2026',
    },
    moderate: {
      quote: "I just wanted to stay in San Juan four extra days after a long weekend. Not burn PTO, not drag a giant project home. Took the quiz that morning thinking it'd be paranoid overkill — and the assessment surfaced exactly two things I needed to lock down before I opened my laptop Tuesday: my device timezone and my MFA push location. Done in 10 minutes. No PTO, no panic, no IT ping. The blueprint paid for itself in skipped vacation days.",
      name: 'Richard P.',
      role: 'Account exec · Remote-extended a Puerto Rico weekend',
      when: 'Took the assessment Mar 2026',
    },
    low: {
      quote: "I just wanted to stay in San Juan four extra days after a long weekend. Not burn PTO, not drag a giant project home. Took the quiz that morning thinking it'd be paranoid overkill — and the assessment surfaced exactly two things I needed to lock down before I opened my laptop Tuesday: my device timezone and my MFA push location. Done in 10 minutes. No PTO, no panic, no IT ping. The blueprint paid for itself in skipped vacation days.",
      name: 'Richard P.',
      role: 'Account exec · Remote-extended a Puerto Rico weekend',
      when: 'Took the assessment Mar 2026',
    },
  };
  function renderTestimonial(band) {
    var host = document.getElementById('testimonial-band');
    if (!host) return;
    var t = TESTIMONIALS[band] || TESTIMONIALS.moderate;
    var heading = band === 'high'
      ? 'Someone else who started where you are.'
      : band === 'moderate'
        ? 'Someone close to your starting point.'
        : 'Someone who took the quiz before a quick trip.';
    host.innerHTML =
      '<h2>' + escapeHtml(heading) + '</h2>' +
      '<figure>' +
        '<blockquote>"' + escapeHtml(t.quote) + '"</blockquote>' +
        '<figcaption>' +
          '<strong>' + escapeHtml(t.name) + '</strong>' +
          '<span>' + escapeHtml(t.role) + '</span>' +
          '<span>' + escapeHtml(t.when) + '</span>' +
        '</figcaption>' +
      '</figure>';
  }

  function bandLabel(band) {
    if (band === 'high')     return "Your setup will give you away before you land.";
    if (band === 'moderate') return "You have real gaps. A few targeted fixes change everything.";
    return "You're in good shape. One layer left to handle.";
  }
  function riskLabel(risk) {
    return risk === 'high' ? 'High' : risk === 'medium' ? 'Medium' : 'Low';
  }

  function animateScore(score, band) {
    var clamped = Math.max(0, Math.min(100, score));

    // Ring: drive stroke-dashoffset (pathLength=100, so this = % empty)
    var wrap = document.querySelector('.hl-ring-wrap');
    if (wrap) {
      var modifier = band === 'high' ? 'high' : band === 'moderate' ? 'mod' : 'low';
      wrap.classList.add('hl-ring--' + modifier);
    }
    var ring = document.getElementById('score-ring');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (ring) ring.setAttribute('stroke-dashoffset', String(100 - clamped));
      });
    });

    var numEl = document.getElementById('score-value');
    if (!numEl) return;
    var duration = 1500;
    var startTs  = null;
    function step(ts) {
      if (!startTs) startTs = ts;
      var t = Math.min(1, (ts - startTs) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      numEl.textContent = String(Math.round(clamped * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Insight cards by band (per brief) ────────────────────────────
  var INSIGHTS = {
    high: [
      { icon: '🔴', title: 'Your IP address is your biggest exposure',
        body: 'Every login from abroad is logged and mapped to a city. A foreign city triggers automatic alerts at companies running Microsoft 365 or Google Workspace.' },
      { icon: '🔴', title: 'Your authentication app is confirming your location',
        body: 'Every login approval shows the city it came from. Your IT team can pull that log at any time without you knowing.' },
      { icon: '🔴', title: 'Your corporate VPN may be working against you',
        body: 'If your company VPN is always-on, it sees your source IP before the tunnel — meaning it knows you’re abroad even before you authenticate.' },
    ],
    moderate: [
      { icon: '🟡', title: 'Your network layer is exposed but your device is clean',
        body: 'No MDM software removes a major detection vector. But your IP address is still broadcasting your location on every login.' },
      { icon: '🟡', title: 'Your timezone metadata is a quiet giveaway',
        body: 'Calendar invites, Slack messages, and Jira tickets all embed your device timezone automatically. A Budapest timezone on a Tampa-based employee’s calendar raises questions.' },
      { icon: '🟡', title: 'One fix closes your remaining gap',
        body: 'Based on your answers, your main exposure is network-level. Everything else is manageable. The IP layer is the one fix that ties it all together.' },
    ],
    low: [
      { icon: '🟢', title: 'Your device is clean — no MDM means no GPS or WiFi reporting',
        body: 'Without an MDM agent on your device, your employer has no visibility into your physical location or the networks you connect to.' },
      { icon: '🟢', title: 'Your work arrangement gives you the most protection',
        body: 'The safest way to work abroad is with employer knowledge. You’ve already handled the highest-risk exposure.' },
      { icon: '🟢', title: 'Your remaining exposure is network-level only',
        body: 'IP geolocation and authentication location are the two items left. Both are solvable at the network layer without touching your device or accounts.' },
    ],
  };

  // ── Risk table rows: visibility + risk + copy by risk ───────────
  function ans(answers, qid) { return answers[qid] || answers[String(qid)]; }
  function isYes(v) { return v === 'yes'; }
  function isNo(v)  { return v === 'no'; }

  var RISK_ROWS = [
    {
      method: 'IP geolocation',
      visible: function (a) { return isNo(ans(a, 10)); },
      risk:    function ()  { return 'high'; },
      copy: {
        high:   'Route all traffic through your home IP. HomeLink does this automatically for every connected device.',
        medium: 'Consider a home IP routing solution before your next trip.',
        low:    "You're already handling this.",
      },
    },
    {
      method: 'Authentication location',
      visible: function (a) { return isNo(ans(a, 10)); },
      risk:    function ()  { return 'high'; },
      copy: {
        high:   'Handled automatically when your IP is routed through home — authentication follows the IP.',
        medium: 'Fixing your IP layer fixes this simultaneously.',
        low:    "You're covered.",
      },
    },
    {
      method: 'Corporate VPN sees your real IP',
      visible: function (a) { return isYes(ans(a, 5)); },
      risk:    function ()  { return 'high'; },
      copy: {
        high:   "Connect HomeLink before your corporate VPN. HomeLink's tunnel runs underneath — your VPN sees your home IP as the source.",
        medium: 'Layer order matters — HomeLink goes first.',
        low:    "No corporate VPN detected — you're clear.",
      },
    },
    {
      method: 'Timezone metadata',
      visible: function (a) { return isNo(ans(a, 6)); },
      risk:    function ()  { return 'medium'; },
      copy: {
        high:   'Manually set your device timezone to your home timezone before you travel. Takes 30 seconds.',
        medium: 'Quick fix — do this before your next trip.',
        low:    'Your timezone matches home — no action needed.',
      },
    },
    {
      method: 'WiFi SSID logging',
      visible: function (a) { return isYes(ans(a, 8)); },
      risk:    function ()  { return 'medium'; },
      copy: {
        high:   "MDM detected on your device. Your IT team may be logging the WiFi network names you connect to. Use a travel router as a personal hotspot — the MDM sees the router's network, not the hotel's.",
        medium: 'Some MDM agents log this, some don’t. Worth checking your policy.',
        low:    "No MDM detected — you're clear.",
      },
    },
    {
      method: 'MDM GPS reporting',
      visible: function (a) { return isYes(ans(a, 8)); },
      risk:    function ()  { return 'high'; },
      copy: {
        high:   'MDM detected. Some agents report GPS location to IT. Check your MDM policy or use a personal device for travel.',
        medium: 'Depends on your specific MDM configuration.',
        low:    'No MDM detected — no GPS reporting risk.',
      },
    },
    {
      method: 'Browser fingerprinting',
      visible: function ()  { return true; },
      risk:    function ()  { return 'low'; },
      copy: {
        high:   "Low priority. Very few employers check this actively. Not worth optimizing unless you're in a high-security role.",
        medium: 'Low priority.',
        low:    "You're clear.",
      },
    },
  ];

  // ── Next steps by band ──────────────────────────────────────────
  var NEXT_STEPS = {
    high: {
      headline: 'Your four highest-risk items all have the same fix.',
      steps: [
        'Handle the IP layer — fixes IP geolocation and authentication location simultaneously.',
        'Manually set your device timezone to your home timezone before you travel.',
        'Check whether your corporate VPN is always-on or connect-on-demand — connect HomeLink first.',
      ],
      ctaText: 'Start your 30-day free trial →',
      ctaHref: 'https://homelinkrouters.us',
      fud: ['✓ 30-day free trial', '✓ Ships preconfigured', '✓ Cancel anytime'],
    },
    moderate: {
      headline: "One gap left. Here's how to close it.",
      steps: [
        'Handle the IP layer — your only remaining high-risk item.',
        'Set your device timezone to home before your next trip.',
        "You're good to go.",
      ],
      ctaText: 'See how HomeLink handles the network layer →',
      ctaHref: 'https://landing.homelinkrouters.us',
      fud: ['✓ 30-day free trial', '✓ Ships preconfigured', '✓ Cancel anytime'],
    },
    low: {
      headline: "You're in good shape. One optional layer remains.",
      steps: [
        'Read the full IT detection guide for the complete picture.',
        'Consider the network layer if you want full coverage regardless of employer arrangement.',
        "You're ready to travel.",
      ],
      ctaText: 'Read the full guide →',
      ctaHref: 'https://resources.homelinkrouters.us',
      fud: [],
    },
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
