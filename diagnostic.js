/* HomeLink — Remote Work Abroad Readiness Assessment
   Drives the 15-question quiz. Questions first → gate (NELP) → submit → /results.
   Score is computed authoritatively on the server; client just collects answers. */

(function () {
  'use strict';

  var API_BASE = '/api';

  // ── Question schema ─────────────────────────────────────────────
  // Each yes/sometimes/no question has 3 options. The middle option's value
  // is always 'sometimes' on the wire (so server-side scoring is unchanged),
  // but the display label varies per-question via `middleLabel`. Defaults to
  // "Sometimes" if omitted. This makes "I'm not sure" / "Some of them" /
  // "Once or twice" fit binary fact questions without breaking scoring.
  var QUESTIONS = [
    { id: 1,  type: 'yns', text: 'Do you use a personal device when working abroad, rather than a company-issued one?', correct: 'yes' },
    { id: 2,  type: 'yns', text: 'Does your company use Microsoft 365 or Google Workspace for work accounts?', correct: 'no',  middleLabel: "I'm not sure" },
    { id: 3,  type: 'yns', text: 'Have you ever received a security verification prompt when logging in from a new location?', correct: 'no' },
    { id: 4,  type: 'yns', text: 'Do you know what IP address your work accounts see when you log in?', correct: 'yes', middleLabel: "I'm not sure" },
    { id: 5,  type: 'yns', text: 'Does your company require you to connect to a corporate VPN?', correct: 'no' },
    { id: 6,  type: 'yns', text: 'Have you ever manually changed your device timezone when traveling abroad?', correct: 'yes' },
    { id: 7,  type: 'yns', text: 'Do you use Slack, Jira, Notion, or similar tools for work communication?', correct: 'no',  middleLabel: 'Some of them' },
    { id: 8,  type: 'yns', text: 'Does your company have any software installed on your work device to manage it remotely?', correct: 'no',  middleLabel: "I'm not sure" },
    { id: 9,  type: 'yns', text: 'Have you ever been questioned by IT or HR about your location while working remotely?', correct: 'no',  middleLabel: 'Once or twice' },
    { id: 10, type: 'yns', text: 'Do you currently use any tool to route your internet traffic through your home IP?', correct: 'yes', middleLabel: "I'm not sure" },
    { id: 11, type: 'single', text: 'Which best describes your current situation?', options: [
        'I want to work abroad but haven’t tried yet',
        'I’m working abroad now and hoping nobody notices',
        'I’ve been caught or flagged before',
        'I work abroad with my employer’s full knowledge',
    ]},
    { id: 12, type: 'single', text: 'What outcome are you looking for?', options: [
        'Work abroad for a few weeks without IT flagging me',
        'Live abroad long-term while keeping my US-based job',
        'Travel freely without banking or streaming restrictions',
        'All of the above',
    ]},
    { id: 13, type: 'multi', text: 'What have you already tried that hasn’t fully worked?', options: [
        'Consumer VPN — too slow or got flagged',
        'DIY WireGuard setup — too technical',
        'Just hoping nobody checks — too stressful',
        'Nothing yet — still researching',
    ]},
    { id: 14, type: 'single', text: 'Which would best suit your needs?', options: [
        'A plug-and-play hardware kit that handles everything automatically',
        'A software-only solution I configure myself',
        'I need someone to walk me through my specific setup first',
    ]},
    { id: 15, type: 'text', text: 'Is there anything else about your situation you’d like us to know?', optional: true },
  ];

  var YNS_OPTS = [
    { value: 'yes',       label: 'Yes' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'no',        label: 'No' },
  ];

  // ── State ────────────────────────────────────────────────────────
  // currentStep: 1..15 = questions, 'nelp' = final gate
  var state = {
    nelp: null,
    answers: {},
    currentStep: 1,
    submitting: false,
  };

  // ── Drop-off tracking ───────────────────────────────────────────
  // Per-tab session id + cheap beacon to /api/diagnostic/event so we
  // can see exactly where users abandon the 15-question flow.
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
  var lastStepSeen = 0;
  var abandonFired = false;

  function fireEvent(eventType, step, meta) {
    if (!SID) return;
    var body = JSON.stringify({
      session_id: SID,
      event_type: eventType,
      step: step,
      meta: meta || null,
    });
    if (eventType === 'abandon' && navigator.sendBeacon) {
      try {
        navigator.sendBeacon('/api/diagnostic/event',
          new Blob([body], { type: 'application/json' }));
      } catch (e) { /* swallow */ }
      return;
    }
    try {
      fetch('/api/diagnostic/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {});
    } catch (e) { /* swallow */ }
  }

  function fireAbandon() {
    if (abandonFired) return;
    abandonFired = true;
    var step = state.currentStep === 'nelp' ? 16 : (lastStepSeen || state.currentStep || 0);
    fireEvent('abandon', step);
  }
  // Submit success unlocks the next session — clears the abandon-fired flag
  // so a same-tab return that re-runs the quiz starts fresh.
  function clearAbandonGuard() { abandonFired = false; }

  window.addEventListener('pagehide', fireAbandon);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') fireAbandon();
  });

  // ── DOM ──────────────────────────────────────────────────────────
  var els = {
    progress:     document.getElementById('progress'),
    questionHost: document.getElementById('question-host'),
    nelpStep:     document.querySelector('.hl-quiz__step[data-step="nelp"]'),
    nelpForm:     document.getElementById('nelp-form'),
    nelpSubmit:   document.getElementById('nelp-submit'),
    nelpBack:     document.getElementById('nelp-back'),
  };

  // ── Progress bar — 15 question segments. Filled to current step ─
  function buildProgress() {
    els.progress.innerHTML = '';
    for (var i = 0; i < QUESTIONS.length; i++) {
      var bar = document.createElement('div');
      bar.className = 'bar';
      els.progress.appendChild(bar);
    }
    updateProgress();
  }
  function updateProgress() {
    var bars = els.progress.children;
    var filledThrough = state.currentStep === 'nelp' ? QUESTIONS.length : state.currentStep - 1;
    var currentIdx    = state.currentStep === 'nelp' ? -1 : state.currentStep - 1;
    for (var i = 0; i < bars.length; i++) {
      bars[i].className = 'bar';
      if (i < filledThrough)    bars[i].classList.add('filled');
      else if (i === currentIdx) bars[i].classList.add('current');
    }
    if (state.currentStep === 'nelp') {
      // Mark all filled when on the gate
      for (var j = 0; j < bars.length; j++) bars[j].classList.add('filled');
    }
  }

  // ── Render a question step ───────────────────────────────────────
  function renderStep(stepNum) {
    var q = QUESTIONS[stepNum - 1];
    if (!q) return;

    var wrap = document.createElement('section');
    wrap.className = 'hl-quiz__step active';
    wrap.dataset.step = String(stepNum);

    var meta = document.createElement('div');
    meta.className = 'qmeta';
    meta.textContent = 'Question ' + stepNum + ' of 15';
    wrap.appendChild(meta);

    var heading = document.createElement('h2');
    heading.textContent = q.text;
    wrap.appendChild(heading);

    if (q.type === 'yns' || q.type === 'single' || q.type === 'multi') {
      var opts;
      if (q.type === 'yns') {
        opts = YNS_OPTS.map(function (o) {
          var label = o.label;
          if (o.value === 'sometimes' && q.middleLabel) label = q.middleLabel;
          return { value: o.value, label: label };
        });
      } else {
        opts = q.options.map(function (label) { return { value: label, label: label }; });
      }
      var grid = document.createElement('div');
      grid.className = 'hl-options';
      if (q.type === 'multi') grid.dataset.multi = 'true';

      // Restore prior selections if revisiting a step via Back
      var prior = state.answers[q.id];
      opts.forEach(function (opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hl-option';
        btn.dataset.value = opt.value;
        var preselected = (q.type === 'multi')
          ? (Array.isArray(prior) && prior.indexOf(opt.value) !== -1)
          : (prior === opt.value);
        if (preselected) btn.classList.add('selected');
        btn.innerHTML = '<span class="hl-option__check"></span><span>' + escapeHtml(opt.label) + '</span>';
        btn.addEventListener('click', function () { onOptionClick(q, btn, grid); });
        grid.appendChild(btn);
      });
      wrap.appendChild(grid);
    } else if (q.type === 'text') {
      var ta = document.createElement('textarea');
      ta.id = 'q-' + q.id + '-text';
      ta.rows = 4;
      ta.maxLength = 1500;
      ta.placeholder = 'Optional — anything we should know?';
      ta.style.resize = 'vertical';
      ta.style.minHeight = '120px';
      ta.style.padding = '12px 14px';
      ta.style.background = 'var(--card)';
      ta.style.border = '1.5px solid var(--border)';
      ta.style.borderRadius = '8px';
      ta.style.fontFamily = 'inherit';
      ta.style.fontSize = '1rem';
      ta.style.width = '100%';
      ta.style.boxSizing = 'border-box';
      if (typeof state.answers[q.id] === 'string') ta.value = state.answers[q.id];
      wrap.appendChild(ta);
    }

    var navRow = document.createElement('div');
    navRow.className = 'hl-quiz__nav';
    var back = document.createElement('button');
    back.type = 'button'; back.className = 'hl-quiz__back'; back.textContent = '← Back';
    if (stepNum === 1) back.style.visibility = 'hidden';
    back.addEventListener('click', function () {
      if (stepNum > 1) advanceTo(stepNum - 1);
    });
    navRow.appendChild(back);

    var next = document.createElement('button');
    next.type = 'button'; next.className = 'hl-btn hl-quiz__next';
    var isLast = stepNum === QUESTIONS.length;
    next.textContent = isLast ? 'Continue →' : 'Next →';
    if (q.type === 'multi' || q.type === 'text') {
      // Manual advance for multi-select and text
    } else {
      // Single-select auto-advances after a short delay; hide next initially
      next.style.visibility = 'hidden';
    }
    next.addEventListener('click', function () {
      var ans = collectAnswer(q, wrap);
      if (ans === null) {
        if (!q.optional) { alert('Please answer to continue.'); return; }
      }
      state.answers[q.id] = ans;
      if (isLast) goToPreviewResults();
      else advanceTo(stepNum + 1);
    });
    navRow.appendChild(next);
    wrap.appendChild(navRow);

    els.questionHost.innerHTML = '';
    els.questionHost.appendChild(wrap);

    if (stepNum > lastStepSeen) lastStepSeen = stepNum;
    fireEvent('question_view', stepNum);
  }

  function onOptionClick(q, btn, grid) {
    if (q.type === 'multi') {
      btn.classList.toggle('selected');
      return;
    }
    // single-select (yns or single) — auto-advance
    var all = grid.querySelectorAll('.hl-option');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('selected');
    btn.classList.add('selected');
    setTimeout(function () {
      var step = parseInt(btn.closest('.hl-quiz__step').dataset.step, 10);
      var ans = btn.dataset.value;
      state.answers[q.id] = ans;
      var isLast = step === QUESTIONS.length;
      if (isLast) goToPreviewResults();
      else advanceTo(step + 1);
    }, 280);
  }

  function collectAnswer(q, wrap) {
    if (q.type === 'multi') {
      var selected = Array.prototype.map.call(
        wrap.querySelectorAll('.hl-option.selected'),
        function (el) { return el.dataset.value; }
      );
      return selected.length ? selected : null;
    }
    if (q.type === 'text') {
      var ta = wrap.querySelector('textarea');
      var v = ta ? ta.value.trim() : '';
      return v || null;
    }
    var sel = wrap.querySelector('.hl-option.selected');
    return sel ? sel.dataset.value : null;
  }

  // ── Step navigation ──────────────────────────────────────────────
  function advanceTo(stepNum) {
    state.currentStep = stepNum;
    els.nelpStep.classList.remove('active');
    renderStep(stepNum);
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Score-first flow: at end of Q15 we save answers to sessionStorage
  // and navigate to /results, which renders preview content (score +
  // identified issues) and shows an inline email gate beneath it. The
  // OLD gate (NELP form below) remains as a fallback when sessionStorage
  // is unavailable (private browsing edge cases).
  function goToPreviewResults() {
    try {
      sessionStorage.setItem('hl_diag_preview', JSON.stringify({
        answers: state.answers,
        sid: SID,
        v: 1,
      }));
    } catch (e) {
      // sessionStorage failed — fall back to the original gate flow
      goToGate();
      return;
    }
    // Successful navigation isn't abandonment — suppress the beacon
    abandonFired = true;
    window.location.href = '/results';
  }

  function goToGate() {
    state.currentStep = 'nelp';
    lastStepSeen = 16;
    els.questionHost.innerHTML = '';
    els.nelpStep.classList.add('active');
    hydrateGatePreview();
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () {
      var nameInput = document.getElementById('f-name');
      if (nameInput) nameInput.focus();
    }, 100);
    fireEvent('gate_view', 16);
  }

  // Mirror of the server-side scoring (see internal/handlers/diagnostic.go
  // scoreAssessment). Used only for the blurred preview at the gate; the
  // authoritative score still comes back from /api/diagnostic/submit.
  var CORRECT_ANSWERS = {
    1: 'yes', 2: 'no', 3: 'no', 4: 'yes', 5: 'no',
    6: 'yes', 7: 'no', 8: 'no', 9: 'no', 10: 'yes',
  };
  function computePreviewScore(answers) {
    var s = 0;
    for (var qid in CORRECT_ANSWERS) {
      var got = answers[qid];
      if (got === CORRECT_ANSWERS[qid]) s += 8;
      else if (got === 'sometimes') s += 4;
    }
    if (answers[1] === 'yes') s += 10;
    if (answers[8] === 'no')  s += 10;
    if (answers[5] === 'no')  s += 5;
    if (answers[10] === 'yes') s += 15;
    var q11 = answers[11] || '';
    if (q11.indexOf("I work abroad with my employer") === 0) s += 20;
    else if (q11.indexOf("I’ve been caught") === 0 || q11.indexOf("I've been caught") === 0) s -= 10;
    if (s < 0) s = 0;
    if (s > 100) s = 100;
    return s;
  }
  function previewBand(score) {
    if (score <= 40) return { key: 'high',     label: 'High risk' };
    if (score <= 70) return { key: 'moderate', label: 'Moderate risk' };
    return { key: 'low', label: 'Low risk' };
  }
  function hydrateGatePreview() {
    var preview = document.getElementById('gate-preview');
    if (!preview) return;
    var score = computePreviewScore(state.answers);
    var band  = previewBand(score);
    var num = document.getElementById('gate-preview-score');
    var bandEl = document.getElementById('gate-preview-band');
    if (num) num.textContent = String(score);
    if (bandEl) bandEl.textContent = band.label;
    preview.classList.remove('hl-gate-preview--high', 'hl-gate-preview--moderate', 'hl-gate-preview--low');
    preview.classList.add('hl-gate-preview--' + band.key);
  }

  // ── NELP form (final gate) ───────────────────────────────────────
  els.nelpForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.submitting) return;
    var name       = els.nelpForm.querySelector('#f-name').value.trim();
    var email      = els.nelpForm.querySelector('#f-email').value.trim();
    var location   = els.nelpForm.querySelector('#f-location').value.trim();
    var profession = els.nelpForm.querySelector('#f-profession').value.trim();
    var honeypot   = els.nelpForm.querySelector('#f-website').value;
    if (honeypot) return; // silent for bots
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Please enter a valid name and email.');
      return;
    }
    state.nelp = { name: name, email: email, location: location, profession: profession };
    submitAssessment();
  });

  els.nelpBack.addEventListener('click', function () {
    advanceTo(QUESTIONS.length); // Back to Q15
  });

  // ── Submit ───────────────────────────────────────────────────────
  function submitAssessment() {
    if (state.submitting) return;
    state.submitting = true;
    els.nelpSubmit.disabled = true;
    els.nelpSubmit.innerHTML = '<span class="hl-spinner"></span> Calculating...';
    fireEvent('submit_click', 16);

    var body = {
      name:       state.nelp.name,
      email:      state.nelp.email,
      location:   state.nelp.location || '',
      profession: state.nelp.profession || '',
      answers:    state.answers,
      source:     'diagnostic-quiz',
      consent:    true,
      website:    '',
    };
    fetch(API_BASE + '/diagnostic/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (b) { return { status: r.status, body: b }; });
      })
      .then(function (resp) {
        if (resp.status >= 200 && resp.status < 300 && resp.body && resp.body.token) {
          // Successful submit isn't an abandonment — suppress the beacon
          // that the imminent navigation would otherwise fire.
          abandonFired = true;
          window.location.href = '/results?t=' + encodeURIComponent(resp.body.token);
        } else {
          state.submitting = false;
          els.nelpSubmit.disabled = false;
          els.nelpSubmit.textContent = 'See my results →';
          alert((resp.body && resp.body.error) || 'Something went wrong submitting your answers. Try again?');
        }
      })
      .catch(function () {
        state.submitting = false;
        els.nelpSubmit.disabled = false;
        els.nelpSubmit.textContent = 'See my results →';
        alert('Network error — try again?');
      });
  }

  // ── Utilities ────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ── Init: drop straight into Q1, no intro screen ────────────────
  buildProgress();
  renderStep(1);
})();
