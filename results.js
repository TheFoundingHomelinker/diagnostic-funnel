/* Results page renderer — fetches stored assessment by token, populates
   speedometer + insight cards + risk table + next-steps from the brief. */

(function () {
  'use strict';

  var API_BASE = '/api';

  // Read token from URL
  var params = new URLSearchParams(window.location.search);
  var token = params.get('t') || '';
  if (!token) {
    window.location.href = '/';
    return;
  }

  // Fetch the stored assessment
  fetch(API_BASE + '/diagnostic/results?token=' + encodeURIComponent(token))
    .then(function (r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(render)
    .catch(function () { window.location.href = '/'; });

  // ── Render ───────────────────────────────────────────────────────
  function render(data) {
    var score   = data.score;
    var band    = data.band;       // "high" | "moderate" | "low"
    var answers = data.answers || {};

    // Section 1: ring + score number + band label
    document.getElementById('band-label').textContent = bandLabel(band);
    animateScore(score, band);

    // Section 2: insight cards
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

    // Section 3: risk table — only render rows whose visibility rule matches
    var rowsHost = document.getElementById('risk-rows');
    RISK_ROWS.forEach(function (row) {
      if (!row.visible(answers)) return;
      var risk = row.risk(answers);   // "high" | "medium" | "low"
      var copy = row.copy[risk];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td data-label="Detection method">' + escapeHtml(row.method) + '</td>' +
        '<td data-label="Your risk"><span class="risk-pill ' + risk + '">' + riskLabel(risk) + '</span></td>' +
        '<td data-label="What to do">' + escapeHtml(copy) + '</td>';
      rowsHost.appendChild(tr);
    });

    // Section 4: next steps
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
    // Tiny RAF gap so the transition kicks in cleanly after the class swap
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (ring) ring.setAttribute('stroke-dashoffset', String(100 - clamped));
      });
    });

    // Number: count up from 0 → score over the same window the ring fills.
    var numEl = document.getElementById('score-value');
    if (!numEl) return;
    var duration = 1500;
    var startTs  = null;
    function step(ts) {
      if (!startTs) startTs = ts;
      var t = Math.min(1, (ts - startTs) / duration);
      var eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
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
  // Helpers for reading answer values
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
      method: 'Corporate VPN source IP',
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
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
})();
