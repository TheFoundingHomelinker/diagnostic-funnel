/* HomeLink — Personalized risk-fix plan
   Loads the persisted assessment from /api/diagnostic/results, ranks the
   user's exposures by leverage based on their actual answers, and renders
   a print-friendly fix plan. Save-as-PDF via the browser print dialog
   produces the deliverable promised in the email-bundle on the landing
   page. */

(function () {
  'use strict';

  var API_BASE = '/api';

  // ── Risk catalog ──────────────────────────────────────────────────
  // For each yes/no question (1–10), the leverage weight (mirrors the
  // scoring formula's bonuses), a title, what IT actually sees, and the
  // user-specific fix language depending on their answer. Q3 and Q9 are
  // risk indicators — surfaced informationally, not as direct fixes.
  var RISK_CATALOG = {
    10: {
      weight: 23,
      correct: 'yes',
      title: 'Network egress (your IP layer)',
      risk: 'Your IP geolocation is the most reliable signal IT has. Every login record includes the IP. MaxMind / IP2Location resolves any new range to a country within minutes — and Microsoft 365, Google Workspace, and Okta all flag foreign-IP logins on the very first authentication.',
      whenWrong: {
        'no':        'You\'re not currently routing your traffic through your home IP. This is the single highest-leverage gap on this list — every other fix is downstream of this one.',
        'sometimes': 'You\'re routing through home IP intermittently. Intermittent is worse than always: a clean home IP for two weeks followed by a Lisbon IP for a day is a more recognizable pattern than steady-state foreign traffic.',
      },
      fix: 'Route every device through your home IP, full-time. The HomeLink router kit handles this for laptop, phone, tablet, smart TV — anything you connect to it shows your home IP from anywhere in the world. No apps to forget.',
    },
    1: {
      weight: 18,
      correct: 'yes',
      title: 'Company-issued device',
      risk: 'Company laptops typically run with MDM, location services enabled by default, and IT has remote inventory access. They can see what they\'re looking for whenever they want.',
      whenWrong: {
        'no':        'You\'re using a company-issued device when working abroad. This means location services are likely on by default, IT can see device geolocation in their MDM console, and any apps installed by IT can phone home with location and timezone.',
        'sometimes': 'You\'re mixing company and personal devices. The company device is the riskier of the two — focus risk-mitigation effort there. Anything done on a personal device is far less visible to IT regardless of network.',
      },
      fix: 'Where possible, do non-essential work (email triage, calendar review) from a personal device. For company-device-only work, turn off location services in System Settings, disable Bluetooth, and verify what shows in your MDM company portal as your last-checked-in location.',
    },
    8: {
      weight: 18,
      correct: 'no',
      title: 'MDM / device management software',
      risk: 'Software like Jamf, Intune, Workspace ONE, Kandji, and Mosyle reports device location, install state, and timezone back to IT continuously. It\'s the most direct surveillance vector — and it operates at a layer below the IP fix.',
      whenWrong: {
        'yes':       'You confirmed there\'s management software installed on your work device. That software phones home with location and timezone every check-in — usually every few hours. The IP layer alone won\'t hide this.',
        'sometimes': 'You\'re unsure whether MDM is installed. Check System Settings → Privacy & Security → Profiles (Mac) or Settings → Accounts → Access work or school (Windows). If anything corporate-managed is listed, assume it sees your location.',
      },
      fix: 'You can\'t remove MDM yourself. Mitigations: keep the device on your travel router\'s network so the MDM check-in egress IP looks like home, disable location services in System Settings, and accept the device timezone will leak unless you manually override it.',
    },
    5: {
      weight: 13,
      correct: 'no',
      title: 'Corporate VPN',
      risk: 'Corporate VPNs reveal your real client IP to the VPN gateway during the handshake. Routing your downstream traffic through home doesn\'t help if the corporate VPN tunnel sees the destination IP.',
      whenWrong: {
        'yes':       'Your company requires you to connect to a corporate VPN. The VPN gateway logs the IP your client connects from — even when HomeLink is in front of it, the corporate VPN sees the home IP. The good news: that\'s consistent with what your IdP sees.',
        'sometimes': 'You connect to corporate VPN intermittently. Behavior matters: VPN gateway logs showing home IP for three weeks followed by a Lisbon IP for a day is the kind of anomaly that gets flagged.',
      },
      fix: 'Connect to the corporate VPN only after your travel router is up and routing through home. Avoid disconnecting and reconnecting from the destination network mid-day — that creates two distinct IPs in the VPN gateway log.',
    },
    2: {
      weight: 8,
      correct: 'no',
      title: 'Microsoft 365 / Google Workspace',
      risk: 'Both M365 and Google Workspace flag foreign-IP logins immediately, by default, with no admin configuration required. Conditional Access in M365 and Suspicious Activity in GWS run continuously.',
      whenWrong: {
        'yes':       'Your company uses M365 or GWS. Every login from a foreign IP appears in the admin console within minutes. Don\'t open Outlook, Teams, Gmail, or Drive until your IP layer is verified routed through home.',
        'sometimes': 'You\'re unsure which platform your company uses. Look at the email domain in your work account: M365 typically uses outlook.com infrastructure, GWS uses Gmail. Either way, treat the first login from a new location as the riskiest one.',
      },
      fix: 'Verify your IP is routing through home before logging into any M365 or GWS app. The first login from a new location is the riskiest one — get it right, and the rest of the trip\'s logs blend in.',
    },
    6: {
      weight: 8,
      correct: 'yes',
      title: 'Device timezone',
      risk: 'Timezone is embedded in every calendar invite, Slack message, Jira ticket, and commit timestamp — invisible to most people, including most IT, until someone audits. When that day comes, it\'s decisive.',
      whenWrong: {
        'no':        'You\'ve never manually changed your device timezone for travel. Auto-timezone is the most common silent leak — your phone or laptop flips to local time at the destination, and every meeting you create from that point embeds the destination zone in metadata that lives forever.',
        'sometimes': 'You sometimes change timezone manually. Inconsistency creates artifacts: a calendar invite created at 3pm WEST followed by one at 10am EST is the kind of thing that gets noticed in a forensic audit.',
      },
      fix: 'Before every trip: System Settings → Date & Time → uncheck "Set automatically" → manually pin to your home zone. Do this for laptop AND phone. 30 seconds, removes the most-overlooked tell.',
    },
    7: {
      weight: 8,
      correct: 'no',
      title: 'Collaboration tool metadata',
      risk: 'Slack, Jira, Notion, Linear, and similar tools embed timezone in user profiles and message metadata. Some show profile timezone publicly to coworkers — a coworker glance at your profile is the cheapest possible audit.',
      whenWrong: {
        'yes':       'You use Slack/Jira/Notion-style tools. Profile timezone is the obvious leak — set it to home in each tool\'s preferences. Less obvious: every message timestamp is stored in UTC but renders to viewer\'s local timezone, so a coworker investigating you might also see metadata that looks off.',
        'sometimes': 'You use some collaboration tools. Profile timezone is the consistent setting to verify across all of them — wherever you have an account, set the timezone to home.',
      },
      fix: 'Audit every collaboration tool — set profile timezone to home. Slack: Profile → Edit → Timezone. Jira: Account Settings → Profile → Timezone. Notion: Settings → Account → Time zone. Linear: Settings → Time zone.',
    },
    4: {
      weight: 8,
      correct: 'yes',
      title: 'Awareness of your work IP',
      risk: 'Not knowing what IP your work accounts see means you can\'t verify whether your IP layer is actually working. The fix step for every other risk depends on this baseline.',
      whenWrong: {
        'no':        'You don\'t know what IP your work accounts see. Without this baseline, you can\'t verify whether HomeLink, a VPN, or any other routing approach is actually doing its job.',
        'sometimes': 'You\'re partially aware. Make this concrete — verify both your home IP and the IP your IdP shows on your last login.',
      },
      fix: 'On home WiFi: browse to whatismyip.com and note your IP. Then open your IdP\'s recent-activity page (Okta dashboard, Google account.activity, M365 account.live.com) and confirm the IP they\'ve recorded for your last login matches. Save a screenshot before any trip.',
    },
    3: {
      weight: 6,
      correct: 'no',
      title: 'Past verification prompts (risk indicator)',
      risk: 'A pattern of verification prompts on past logins suggests your IdP\'s adaptive-auth engine is already alert to your account.',
      whenWrong: {
        'yes':       'You\'ve had verification prompts on past logins. This is informational rather than a leak — it means your IdP\'s adaptive auth is already paying attention to your sign-in pattern. Be cleaner on every other axis to avoid escalation.',
        'sometimes': 'Occasional prompts are normal. Frequent prompts mean the model is uncertain about you — which can be either good (adversarial fixes work) or bad (something\'s still leaking).',
      },
      fix: 'No direct fix — this is a risk indicator. Take it as a signal to be impeccable on the high-leverage items above (IP, MDM, timezone). The cleaner those are, the faster the adaptive-auth model relaxes.',
    },
    9: {
      weight: 6,
      correct: 'no',
      title: 'Past flags from IT or HR (risk indicator)',
      risk: 'If IT or HR has questioned your location before, you\'re on someone\'s mental list. The threshold for a second inquiry is much lower than the first.',
      whenWrong: {
        'yes':       'You\'ve been questioned before. Even if it was resolved, your name is now associated with "remote-from-where" thinking in someone\'s head. Be more cautious than baseline.',
        'sometimes': 'One or two prior conversations is normal in the lifecycle of any remote worker. Three or more, and you\'re on a mental list.',
      },
      fix: 'No direct fix — this is a risk indicator. Mitigations: be impeccable on the IP layer, the timezone layer, and the device layer. Read the "If IT pings you" emergency playbook in your bundle and bookmark it now while it\'s not urgent.',
    },
  };

  // Question 11 contributes to scoring but isn't a "fix" item — it's a
  // statement of current situation. Q12–Q15 inform tone but aren't risks.

  // ── URL → token ───────────────────────────────────────────────────
  function getToken() {
    var p = new URLSearchParams(window.location.search);
    return p.get('t') || '';
  }

  // ── Fetch ─────────────────────────────────────────────────────────
  function loadAssessment(token) {
    return fetch(API_BASE + '/diagnostic/results?token=' + encodeURIComponent(token))
      .then(function (r) {
        if (!r.ok) throw new Error('not found');
        return r.json();
      });
  }

  // ── Ordering ──────────────────────────────────────────────────────
  // Returns the user's "wrong" answers, ranked by weight desc.
  function rankExposures(answers) {
    var rows = [];
    Object.keys(RISK_CATALOG).forEach(function (qid) {
      var spec = RISK_CATALOG[qid];
      var got = answers[qid];
      if (!got) return;
      if (got === spec.correct) return; // not a gap
      rows.push({ qid: qid, spec: spec, got: got });
    });
    rows.sort(function (a, b) { return b.spec.weight - a.spec.weight; });
    return rows;
  }

  // ── Render ────────────────────────────────────────────────────────
  function bandStyle(band) {
    if (band === 'high')     return { color: '#ef4444', label: 'High risk' };
    if (band === 'moderate') return { color: '#f59e0b', label: 'Moderate risk' };
    return { color: '#10b981', label: 'Low risk' };
  }

  function firstName(name) {
    var n = (name || '').trim();
    if (!n) return 'there';
    var i = n.indexOf(' ');
    return i > 0 ? n.slice(0, i) : n;
  }

  function paragraphFor(band, exposureCount) {
    if (band === 'high') {
      return 'Your assessment surfaced ' + exposureCount + ' exposures that, in combination, mean your current setup will give you away within hours of any login from abroad. The good news: most of them collapse to a single fix at the network layer — every other item gets dramatically easier once your IP routes through home. This document orders them by leverage, so the first item closes the most ground.';
    }
    if (band === 'moderate') {
      return 'You\'re close. The assessment surfaced ' + exposureCount + ' exposures, but most of them are downstream of one or two upstream fixes. Work through this list in order — the first items have the most leverage, and you\'ll find the last few become trivial or unnecessary once the top ones are handled.';
    }
    return 'You\'re in good shape — your assessment surfaced ' + exposureCount + ' minor exposure' + (exposureCount === 1 ? '' : 's') + ' worth tightening before your next trip. None of these are urgent. Knock them out at your own pace.';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function statusFor(qid, answers) {
    var spec = RISK_CATALOG[qid];
    var got = answers[qid];
    if (!got)              return { label: '—',         tone: 'neutral' };
    if (got === spec.correct) return { label: 'Clean',  tone: 'good' };
    if (got === 'sometimes')  return { label: 'Partial',tone: 'mid' };
    return { label: 'Gap', tone: 'bad' };
  }

  function renderTable(answers) {
    var rows = '';
    var orderedQids = ['10', '1', '8', '5', '6', '2', '7', '4', '3', '9'];
    orderedQids.forEach(function (qid) {
      var spec = RISK_CATALOG[qid];
      var st = statusFor(qid, answers);
      rows += '<tr>' +
        '<td>' + escapeHtml(spec.title) + '</td>' +
        '<td><span class="rf-status rf-status--' + st.tone + '">' + escapeHtml(st.label) + '</span></td>' +
        '<td>' + spec.weight + '</td>' +
        '</tr>';
    });
    return '<table class="rf-overview">' +
      '<thead><tr><th>Risk area</th><th>Status</th><th>Leverage</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>';
  }

  function renderExposures(exposures) {
    if (exposures.length === 0) {
      return '<div class="rf-callout rf-callout--good">' +
        '<strong>You came in clean across all 10 risk areas.</strong> ' +
        'There\'s nothing to fix on this page. Read the Travel Day Playbook and Return-Trip Cleanup Checklist anyway — they cover the operational side that the assessment doesn\'t evaluate.' +
        '</div>';
    }
    var html = '';
    exposures.forEach(function (e, i) {
      var spec = e.spec;
      var situation = (spec.whenWrong && spec.whenWrong[e.got]) || '';
      html += '<div class="rf-exposure">' +
        '<div class="rf-exposure__rank">#' + (i + 1) + '</div>' +
        '<div class="rf-exposure__body">' +
          '<h3>' + escapeHtml(spec.title) + '</h3>' +
          '<p class="rf-exposure__situation"><strong>Your situation:</strong> ' + escapeHtml(situation) + '</p>' +
          '<p class="rf-exposure__risk"><strong>What IT sees:</strong> ' + escapeHtml(spec.risk) + '</p>' +
          '<p class="rf-exposure__fix"><strong>Fix:</strong> ' + escapeHtml(spec.fix) + '</p>' +
        '</div>' +
        '</div>';
    });
    return html;
  }

  // Three-phase overview: before, during, after. Sits between the score
  // and the at-a-glance table to elevate the page from "list of fixes" to
  // "phased plan" — matches the work-from-abroad blueprint framing.
  function renderPhases() {
    return '<section class="rf-phases">' +
      '<h2>Your three phases</h2>' +
      '<p>This blueprint covers the full arc — what to handle before you go, what to maintain while you\'re there, and what to clean up when you\'re back. Each phase points to the specific guidance you need at that moment.</p>' +
      '<div class="rf-phases__grid">' +
        '<div class="rf-phase">' +
          '<div class="rf-phase__num">01</div>' +
          '<h3>Before you go</h3>' +
          '<p>Close your top exposures (listed below), lock device timezone to home, pull a baseline IdP audit log. Most leaks are sealed in this phase.</p>' +
          '<div class="rf-phase__links">' +
            '<a href="#rf-exposures">Your top exposures ↓</a>' +
            '<a href="/guides/travel-day">The Travel Day playbook →</a>' +
          '</div>' +
        '</div>' +
        '<div class="rf-phase">' +
          '<div class="rf-phase__num">02</div>' +
          '<h3>While you\'re there</h3>' +
          '<p>Steady-state. Daily audit-log check through day three, then weekly. If anything looks wrong, stop and fix it before continuing — string of bad logins is worse than one.</p>' +
          '<div class="rf-phase__links">' +
            '<a href="/guides/travel-day">The Travel Day playbook →</a>' +
            '<a href="/guides/if-it-pings-you">"If IT pings you" →</a>' +
          '</div>' +
        '</div>' +
        '<div class="rf-phase">' +
          '<div class="rf-phase__num">03</div>' +
          '<h3>Coming home</h3>' +
          '<p>Bleed back gradually — don\'t flip your IP overnight. Save trailing-30-day audit logs before they roll off. Resume normal activity quietly. Plan the next trip the day you\'re home.</p>' +
          '<div class="rf-phase__links">' +
            '<a href="/guides/return-trip-cleanup">Return-Trip Cleanup checklist →</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function renderActionPlan(exposures) {
    if (exposures.length === 0) return '';
    // Take top 3 leverage items, frame as a sequenced plan.
    var top = exposures.slice(0, 3);
    var items = '';
    top.forEach(function (e, i) {
      items += '<li><strong>Step ' + (i + 1) + ':</strong> ' + escapeHtml(e.spec.title) + ' — ' + escapeHtml(e.spec.fix) + '</li>';
    });
    return '<div class="rf-actionplan">' +
      '<h2>Sequenced action plan</h2>' +
      '<p>If you only do three things from this document, do these — in this order. Each is upstream of the next.</p>' +
      '<ol>' + items + '</ol>' +
      '</div>';
  }

  function render(data) {
    var name = firstName(data && data.name);
    var score = (data && typeof data.score === 'number') ? data.score : 0;
    var band = (data && data.band) || 'moderate';
    var answers = (data && data.answers) || {};
    var location = (data && data.location) || '';
    var bs = bandStyle(band);

    var exposures = rankExposures(answers);

    var locationLine = '';
    if (location) {
      locationLine = '<p class="rf__destination">Destination on file: <strong>' + escapeHtml(location) + '</strong> — pair this plan with your destination brief for country-specific guidance.</p>';
    }

    var html =
      '<header class="rf__header">' +
        '<div class="rf__eyebrow">Your work-from-abroad blueprint · HomeLink</div>' +
        '<h1>Hey ' + escapeHtml(name) + ', here\'s your blueprint.</h1>' +
        '<p class="rf__lede">' + escapeHtml(paragraphFor(band, exposures.length)) + '</p>' +
        locationLine +
      '</header>' +
      '<section class="rf-score">' +
        '<div class="rf-score__num" style="color:' + bs.color + ';">' + score + ' / 100</div>' +
        '<div class="rf-score__band">' + bs.label + '</div>' +
      '</section>' +
      renderPhases() +
      '<section class="rf-section">' +
        '<h2>At a glance</h2>' +
        '<p>The full picture across all 10 risk areas, with the leverage weight that determines fix priority. <strong>Status</strong> is your specific result; <strong>leverage</strong> is the relative impact of fixing this item versus the others.</p>' +
        renderTable(answers) +
      '</section>' +
      '<section class="rf-section" id="rf-exposures">' +
        '<h2>Your top exposures, ranked</h2>' +
        '<p>Each item below is a gap your assessment surfaced. They\'re ordered by leverage — the first item has the largest effect on your overall risk, the last item has the smallest. Work through them in order; don\'t skip ahead.</p>' +
        renderExposures(exposures) +
      '</section>' +
      renderActionPlan(exposures) +
      '<section class="rf-section rf-bundle">' +
        '<h2>Pair this plan with the rest of your bundle</h2>' +
        '<p>This document tells you <em>what</em> to fix. The companion guides in your email tell you <em>when</em> and <em>how</em> in the live moment of a trip:</p>' +
        '<ul>' +
          '<li><strong><a href="/guides/travel-day">The Travel Day Playbook</a></strong> — hour-by-hour from T-7 days through day 3 abroad.</li>' +
          '<li><strong><a href="/guides/return-trip-cleanup">Return-Trip Cleanup Checklist</a></strong> — six things to do around your return so the trailing 30 days look ordinary.</li>' +
          '<li><strong><a href="/guides/if-it-pings-you">If IT Pings You — emergency playbook</a></strong> — read this once now, before you go. Starts with whether the alarm is even real.</li>' +
        '</ul>' +
      '</section>' +
      '<section class="rf-cta">' +
        '<h2>The IP layer is the only step that\'s not optional.</h2>' +
        '<p>Most of the items on this list collapse to a single fix at the network layer. HomeLink is a paired router kit that tunnels every device through your home internet — laptop, phone, tablet, all showing your home IP from anywhere. No apps to forget.</p>' +
        '<a href="https://homelinkrouters.us" class="rf-cta__btn">Start your 30-day free trial →</a>' +
      '</section>' +
      '<footer class="rf__footer">' +
        '<p>Questions about your specific setup? Reply to your results email — Chris (the founder) reads every one and responds within 24h.</p>' +
        '<p class="rf__footer__meta">Generated for ' + escapeHtml(name) + ' · ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + '</p>' +
      '</footer>';

    document.getElementById('rf-root').innerHTML = html;
  }

  function renderError() {
    document.getElementById('rf-root').innerHTML =
      '<div class="rf__error">' +
        '<h1>We couldn\'t load your blueprint.</h1>' +
        '<p>The link may have expired or is missing the token. Check your email for the latest results link, or <a href="/quiz">retake the assessment</a>.</p>' +
      '</div>';
  }

  // ── Init ──────────────────────────────────────────────────────────
  var token = getToken();
  if (!token) {
    renderError();
  } else {
    loadAssessment(token).then(render).catch(renderError);
  }

  // Print button — also used by the email's "Save as PDF" button.
  document.getElementById('rf-print').addEventListener('click', function () {
    window.print();
  });

  // If this page was opened from /results, the link in the actions bar is
  // back to that token; rewrite to preserve it.
  var resLink = document.getElementById('rf-results-link');
  if (resLink && token) resLink.href = '/results?t=' + encodeURIComponent(token);

})();
