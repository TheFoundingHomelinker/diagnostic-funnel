#!/usr/bin/env python3
"""Template-generate the 10 new HomeLink destination briefs.

Each brief follows the same shape as the original 5 (portugal/spain/mexico/japan/thailand):
   - eyebrow + h1 + lede
   - 6-cell quick-facts grid
   - "What your IT actually sees" (3 bullets + callout)
   - "Working hours overlap"
   - "Banking & streaming gotchas"
   - "<Country>-specific things most people miss"
   - Action plan (5 numbered)
   - Bottom CTA
"""
from html import escape

OUT_DIR = "/root/.hermes/diagnostic/briefs"

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Working remotely from {country} — HomeLink destination brief</title>
  <meta name="description" content="A 2-page risk brief for remote workers heading to {country}. What your IT actually sees, common gotchas, and what to handle before you go.">
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/diagnostic.css">
  <style>
    .brief {{ max-width: 760px; margin: 0 auto; padding: 56px 24px 48px; }}
    .brief__eyebrow {{ font-family: 'DM Mono', monospace; font-size: 0.78rem; color: var(--blue); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 10px; }}
    .brief__h1 {{ font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 700; color: var(--navy); line-height: 1.18; letter-spacing: -0.02em; margin-bottom: 14px; }}
    .brief__lede {{ font-size: 1.05rem; color: var(--muted); line-height: 1.55; margin-bottom: 32px; max-width: 600px; }}
    .brief__quickfacts {{ background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px 26px; margin-bottom: 36px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 28px; }}
    @media (max-width: 600px) {{ .brief__quickfacts {{ grid-template-columns: 1fr; }} }}
    .qf__row {{ display: flex; flex-direction: column; }}
    .qf__label {{ font-size: 0.78rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }}
    .qf__value {{ font-size: 0.96rem; color: #1a1a18; font-weight: 500; }}
    .brief h2 {{ font-size: 1.35rem; color: var(--navy); margin: 32px 0 14px; font-weight: 700; }}
    .brief p {{ font-size: 1rem; color: #1a1a18; line-height: 1.65; margin-bottom: 14px; }}
    .brief ul {{ padding-left: 22px; margin-bottom: 18px; }}
    .brief ul li {{ margin-bottom: 8px; line-height: 1.6; }}
    .brief strong {{ color: var(--navy); }}
    .brief .callout {{ background: var(--card); border-left: 3px solid var(--blue); border-radius: 0 10px 10px 0; padding: 16px 20px; margin: 18px 0; font-size: 0.95rem; line-height: 1.6; }}
    .brief .actions {{ background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 24px 28px; margin-top: 32px; }}
    .brief .actions h2 {{ margin-top: 0; }}
    .brief .actions ol {{ padding-left: 22px; margin: 0; }}
    .brief .actions ol li {{ margin-bottom: 12px; line-height: 1.55; }}
    .brief__cta {{ background: var(--navy); color: #fff; border-radius: 14px; padding: 32px 30px; margin-top: 40px; text-align: center; }}
    .brief__cta h2 {{ color: #fff; margin: 0 0 10px; font-size: 1.3rem; }}
    .brief__cta p {{ color: rgba(255,255,255,0.78); max-width: 520px; margin: 0 auto 20px; }}
    .brief__cta a {{ display: inline-block; background: #fff; color: var(--navy); padding: 14px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 1rem; }}
    .brief__cta a:hover {{ background: var(--bg); }}
    .brief__footer {{ margin-top: 36px; text-align: center; font-size: 0.85rem; color: var(--muted); }}
  </style>
</head>
<body>

  <article class="brief">
    <div class="brief__eyebrow">Destination brief</div>
    <h1 class="brief__h1">Working remotely from {country}</h1>
    <p class="brief__lede">{lede}</p>

    <div class="brief__quickfacts">
{quickfacts}
    </div>

    <h2>What your IT actually sees from {country}</h2>
    <ul>
{it_bullets}
    </ul>

    <div class="callout">
      <strong>{callout_strong}</strong> {callout_body}
    </div>

    <h2>Working hours overlap</h2>
{hours_html}

    <h2>Banking & streaming gotchas</h2>
{banking_html}

    <h2>The "{country}-specific" things most people miss</h2>
    <ul>
{country_specific_bullets}
    </ul>

    <div class="actions">
      <h2>Action plan before you fly</h2>
      <ol>
{action_items}
      </ol>
    </div>

    <div class="brief__cta">
      <h2>Make sure your IP shows home before you go.</h2>
      <p>HomeLink is a paired router kit that tunnels every device through your home internet — your laptop, phone, and tablet all show your home IP from anywhere. No apps to forget. Plug in and go.</p>
      <a href="https://homelinkrouters.us">Start your 30-day free trial →</a>
    </div>

    <p class="brief__footer">Questions about your specific setup? Reply to your results email — Chris (the founder) reads every one and responds within 24h.</p>
  </article>

</body>
</html>
"""


def quickfacts_html(facts):
    return "\n".join(
        f'      <div class="qf__row"><div class="qf__label">{escape(k)}</div><div class="qf__value">{v}</div></div>'
        for k, v in facts.items()
    )


def bullets_html(bullets, indent=6):
    pad = " " * indent
    return "\n".join(f"{pad}<li>{b}</li>" for b in bullets)


def numbered_html(items, indent=8):
    pad = " " * indent
    return "\n".join(f"{pad}<li>{x}</li>" for x in items)


def paragraphs_html(paras):
    return "\n".join(f"    <p>{p}</p>" for p in paras)


COUNTRIES = {
    # ───────────────────────────────────────────────────────────────────
    "costa-rica": dict(
        country="Costa Rica",
        lede="Costa Rica's been the LatAm nomad darling for a decade — Pura Vida visa, US-friendly time zones, beaches you can work from. Here's what your IT actually sees and what to handle before you go.",
        quickfacts={
            "Timezone": "CST (UTC−6) — no DST",
            "US business-hour overlap": "Excellent — same as US Central year-round",
            "Common ISPs": "Kölbi (ICE), Tigo, Liberty (Cabletica)",
            "Banking risk": "Low — US banks handle it cleanly",
            "Network restrictions": "None — fully open",
            "HomeLink-friendly": "Yes — fiber in main areas, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Kölbi and Tigo IPs resolve to \"Costa Rica\" with high confidence in MaxMind / IP2Location. M365 and Google Workspace flag the country on first login. Okta logs city + ASN per session.",
            "<strong>MFA push location.</strong> A push approved from a phone on Kölbi or Liberty mobile = a second Costa Rica signal. Two foreign signals on the same login event are very hard to pass off.",
            "<strong>Calendar timezone.</strong> Costa Rica is on Central time (UTC−6) year-round — but doesn't observe DST. Half the year you match US Central exactly; the other half you're an hour off. Anyone watching offsets across the DST changeover dates can spot the shift.",
        ],
        callout_strong="Costa Rica-specific gotcha:",
        callout_body="the no-DST behavior means your apparent offset to US colleagues SHIFTS twice a year even though you didn't move. The November shift is the one most likely to be noticed in calendar systems.",
        hours_paras=[
            "Costa Rica is on US Central (UTC−6) but skips daylight saving. So:",
        ],
        hours_bullets=[
            "<strong>Central Time people:</strong> identical match Nov–Mar. Mar–Nov, you're an hour behind your US Central colleagues.",
            "<strong>East Coast people:</strong> 9am ET = 8am San José (Nov–Mar) or 7am (Mar–Nov). Easy either way.",
            "<strong>West Coast people:</strong> 9am PT = 11am San José (Nov–Mar) or 10am (Mar–Nov). Comfortable.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> US banks treat Costa Rica as low-fraud — set a travel notice anyway. ATM fees vary; BAC San José and Banco Nacional ATMs are common. Most accept US Visa/MC; Discover less so.",
            "<strong>Streaming:</strong> Netflix swaps to CR library. Hulu blocks. ESPN+ blocked. Apple TV+ works. HBO Max works. If your IP shows home, US libraries stay intact.",
            "<strong>Phone:</strong> Most US plans include limited Costa Rica usage but charge per-MB after a few hours. Cheaper to grab a Kölbi prepaid SIM ($5-10).",
        ],
        country_specific_bullets=[
            "<strong>Internet outside cities is unreliable.</strong> San José, Santa Teresa, Tamarindo, Manuel Antonio: solid fiber. Remote Pacific or Caribbean coast: mobile-only often. Always test before booking.",
            "<strong>Dry season vs rainy season power.</strong> The grid is reliable in dry season (Dec–Apr); rainier months bring brief outages especially in mountain/jungle areas. UPS for your home router is worth it.",
            "<strong>Tax residency triggers at 183 days.</strong> Short stays (under 6 months) are clean — no Costa Rican tax obligations from working remotely.",
            "<strong>The Pura Vida visa</strong> is for long-term stays. Visa status doesn't affect what your US employer's IT sees — those are independent systems.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone. CST + no-DST means timestamps will mismatch your US calendar mid-year.",
            "<strong>Travel-notice your bank(s)</strong> covering arrival and departure.",
            "<strong>Test the rental's internet</strong> before committing — fiber speeds in CR can be misleading on listings.",
            "<strong>Handle the IP layer</strong> — Costa Rica IPs are unmistakable. The IP fix is what flips you from \"clearly abroad\" to \"looks like home.\"",
            "<strong>Have a Kölbi SIM as backup.</strong> Mobile data is solid even where fiber isn't.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "colombia": dict(
        country="Colombia",
        lede="Medellín is the Latin American nomad capital. Affordable, US-time-friendly, fast fiber in the city, and a massive expat scene. Here's what your IT sees from Colombia and what to handle.",
        quickfacts={
            "Timezone": "COT (UTC−5) — no DST",
            "US business-hour overlap": "Excellent — same as US Eastern most of year",
            "Common ISPs": "Claro, Movistar, Tigo, ETB, EPM",
            "Banking risk": "Moderate — fraud teams flag SA",
            "Network restrictions": "None on consumer ISPs",
            "HomeLink-friendly": "Yes — solid fiber in Medellín / Bogotá / Cartagena",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Claro and EPM (the dominant Medellín ISP) resolve to \"Colombia\" cleanly in MaxMind / IP2Location. M365 + Google Workspace flag city + country on first login.",
            "<strong>MFA push location.</strong> Push approved from a Claro / Movistar SIM also pings Colombia. Two foreign signals on the same login event are obvious.",
            "<strong>Working-hour mismatch is minimal here.</strong> Colombia is COT (UTC−5), same as US Eastern most of the year (Colombia doesn't observe DST). So if you're East Coast US, your timestamps look normal — leaving the IP as the main tell.",
        ],
        callout_strong="Colombia-specific gotcha:",
        callout_body="some US corporate security tools rate Colombian IPs as \"high-fraud\" by default and trigger stricter alerts than for European logins. Test from a mobile hotspot the day you arrive — spot a possible auto-lock before it cascades.",
        hours_paras=[
            "Colombia = COT (UTC−5). No DST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people (winter):</strong> identical to NYC. 9am ET = 9am Medellín. Perfect match.",
            "<strong>East Coast people (summer):</strong> Colombia is 1 hour BEHIND NYC (since US is on EDT, Colombia stays on COT). 9am EDT = 8am Medellín. Still very workable.",
            "<strong>West Coast people:</strong> 9am PT = 11am or 12pm Medellín depending on DST. Comfortable.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Colombia is in the higher-friction tier for US bank fraud detection. Travel notice MANDATORY. Capital One and Schwab handle it well. Davivienda and Bancolombia ATMs are reliable for cash.",
            "<strong>Streaming:</strong> Netflix swaps to CO library. Hulu blocks. ESPN+ blocked. HBO Max works. Apple TV+ works. With your IP showing home, US libraries persist.",
            "<strong>Cards:</strong> Cash is common but most Medellín establishments accept cards. Smaller pueblos = cash-only.",
        ],
        country_specific_bullets=[
            "<strong>Medellín vs Bogotá vs Cartagena.</strong> Medellín has the strongest expat infrastructure (El Poblado, Laureles). Bogotá is corporate/business-trip friendly. Cartagena is touristy but slower internet.",
            "<strong>Internet quality is bimodal.</strong> El Poblado fiber is among the fastest in LatAm. Outside major neighborhoods = unreliable.",
            "<strong>Power.</strong> Reliable in cities, occasional brownouts in coastal regions.",
            "<strong>Tax residency triggers at 183 days</strong> in any 365-day window. Short stays = clean.",
            "<strong>The Colombia digital nomad visa</strong> exists but is a personal-government concern; doesn't affect what your US employer sees.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you go.",
            "<strong>Travel-notice your bank(s)</strong> — Colombia is higher-friction than Europe for US fraud alerts.",
            "<strong>Pull your IdP login history NOW</strong> so you can spot the first Colombian login when it appears.",
            "<strong>Handle the IP layer</strong> — Colombian IPs look unmistakably South American to commercial geo databases.",
            "<strong>Get a Claro or Tigo SIM</strong> at a corner OXXO for backup — under $10 for a month.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "argentina": dict(
        country="Argentina",
        lede="Buenos Aires has become the under-the-radar nomad pick — incredible food, affordable since the peso slid, and a single-time-zone country that maps cleanly to US Eastern. Here's the IT-side reality.",
        quickfacts={
            "Timezone": "ART (UTC−3) — no DST",
            "US business-hour overlap": "Workable — 1-2 hr ahead of ET",
            "Common ISPs": "Telecentro, Fibertel, Movistar AR, Personal",
            "Banking risk": "Moderate — currency controls + fraud flags",
            "Network restrictions": "None — fully open",
            "HomeLink-friendly": "Yes — fiber in BA, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Telecentro and Fibertel IPs resolve cleanly to \"Argentina\" in MaxMind / IP2Location. M365 + Google Workspace flag the country instantly.",
            "<strong>MFA push location.</strong> A push approved from Personal or Movistar AR adds an Argentina geolocation tag to the auth event.",
            "<strong>Calendar timezone.</strong> ART is UTC−3, no DST. East Coast US in summer = 1 hr ahead of ET; in winter = 2 hr. Calendar metadata will show ART regardless of your activity hours.",
        ],
        callout_strong="Argentina-specific gotcha:",
        callout_body="the peso's volatility means the official exchange rate and the \"blue dollar\" rate diverge significantly. Use Western Union for transfers (you'll get the blue rate); avoid using your US debit at ATMs (you'll get the worse official rate).",
        hours_paras=[
            "Argentina is UTC−3, no DST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people (summer):</strong> 9am ET (EDT, UTC−4) = 10am Buenos Aires. Easy.",
            "<strong>East Coast people (winter):</strong> 9am ET (EST, UTC−5) = 11am Buenos Aires. Still easy.",
            "<strong>West Coast people:</strong> 9am PT = 1pm BA. Manageable.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> US bank ATMs in Argentina give you the official rate (~half of the real value of dollars). Use Western Union to send dollars to yourself for the blue-rate exchange. Notify your bank before going. Capital One and Schwab work; Discover sometimes blocked.",
            "<strong>Streaming:</strong> Netflix swaps to AR library. Hulu blocks. ESPN+ blocked. Apple TV+ works. With IP showing home, US libraries persist.",
            "<strong>Cards:</strong> Most BA restaurants and shops accept Visa/MC. Cash is still king for small purchases — and the cash advantage is huge when you have blue-rate dollars.",
        ],
        country_specific_bullets=[
            "<strong>Buenos Aires vs the rest of the country.</strong> BA has fast fiber and dense expat infrastructure. Mendoza and Bariloche are scenic but more rural internet. Cordoba is decent.",
            "<strong>Inflation messes with subscription pricing.</strong> If you sign up for Argentine local services (mobile, gym, etc.), prices update aggressively.",
            "<strong>Power.</strong> Reliable in Buenos Aires, occasional summer brownouts in heat waves.",
            "<strong>Tax residency triggers at 6 months</strong> in a 12-month window. Short stays = clean. Long stays = real tax exposure under Argentine law.",
            "<strong>SIM cards</strong> require DNI (Argentine ID) for full prepaid plans. Tourist SIMs are available at airport but more limited.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you go.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Bring USD cash</strong> for the blue rate (or set up Western Union for self-transfers). Don't rely on ATM withdrawals — you'll lose half your value.",
            "<strong>Handle the IP layer</strong> — Argentine IPs are unmistakable in geo databases.",
            "<strong>Plan internet backup</strong> — BA fiber is reliable but power flickers. UPS for the home router is cheap insurance.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "vietnam": dict(
        country="Vietnam",
        lede="Vietnam (especially Da Nang and Ho Chi Minh City) has surged as a nomad destination — cheap, fast fiber, and a growing expat infrastructure. Here's the IT-side reality.",
        quickfacts={
            "Timezone": "ICT (UTC+7) — no DST",
            "US business-hour overlap": "Hard — flip schedule",
            "Common ISPs": "VNPT, Viettel, FPT Telecom",
            "Banking risk": "Moderate — SE Asia fraud-flagged",
            "Network restrictions": "Light — some sites blocked, no DPI on consumer",
            "HomeLink-friendly": "Yes — excellent fiber, low cost",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> VNPT, Viettel, and FPT IPs resolve to \"Vietnam\" in commercial geo databases. M365 + Google Workspace flag country + city on first login. Some corporate security tools rate Vietnam as elevated risk and may auto-alert your IT team.",
            "<strong>MFA push location.</strong> Push approved from a Viettel / Mobifone / Vinaphone SIM adds Vietnam to the auth event. Two foreign signals = obvious story.",
            "<strong>Working-hour mismatch.</strong> Vietnam is 11–14 hours ahead of the US. Activity timestamps cluster at unusual US times — observable in any reporting dashboard.",
        ],
        callout_strong="Vietnam-specific gotcha:",
        callout_body="some US corporate security tools auto-block first-time Vietnamese logins — even before your IT team sees the alert. Test from a mobile hotspot the moment you land, before you do any real work.",
        hours_paras=[
            "Vietnam = ICT (UTC+7), no DST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9pm Vietnam = 9am ET (winter) or 10am ET (summer). Best window for US-business meetings = your evening.",
            "<strong>West Coast people:</strong> midnight Vietnam = 9am PT (winter) or 10am PT (summer). Brutal — late-night calls.",
            "<strong>Pattern most nomads adopt:</strong> 8pm-midnight = real-time meetings, day = async work. Da Nang has lots of late-open cafés with great wifi.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Vietnam is in the moderate-fraud-risk tier. Travel notice MANDATORY — expect at least one card freeze without it. Capital One and Schwab work cleanly. Vietnamese ATMs charge fees per withdrawal; Citibank Vietnam (limited locations) has the best rates.",
            "<strong>Streaming:</strong> Netflix swaps to VN library. Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. With IP at home, US libraries stay intact.",
            "<strong>Phone:</strong> US plans don't include Vietnam. Buy a Viettel or Mobifone tourist SIM at the airport — under $10 for a month.",
        ],
        country_specific_bullets=[
            "<strong>Internet quality is excellent.</strong> Da Nang and HCMC have widespread 1Gbps fiber for ~$15/mo. Hanoi too. Latency to US East ~200ms; West Coast ~150ms. Video calls work but feel slightly lagged.",
            "<strong>Some sites blocked.</strong> Vietnam blocks Facebook intermittently (tolerated but disrupted around political events) and a few news outlets. Doesn't usually affect work tools.",
            "<strong>Power outages</strong> are common in Hanoi summer (hot-weather grid stress). Less so in Da Nang and HCMC. UPS recommended for long stays.",
            "<strong>Tax residency triggers at 183 days.</strong> Short stays clean.",
            "<strong>Coworking is cheap and abundant.</strong> Da Nang has dozens of dedicated nomad spots — Hub Hoi An, Toong, Dreamplex.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you fly. ICT will be obvious in metadata.",
            "<strong>Travel-notice your bank(s)</strong> — SE Asia is in higher-friction fraud-detection tier.",
            "<strong>Pull your IdP login history NOW</strong> for clean baseline.",
            "<strong>Handle the IP layer first.</strong> Some corporate tools auto-lock on first Vietnamese login. Better to never trigger that than to recover from it.",
            "<strong>Get a Viettel or Mobifone SIM</strong> at the airport — backup connectivity for when fiber drops.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "indonesia": dict(
        country="Indonesia (Bali)",
        lede="Bali — specifically Canggu and Ubud — is the global nomad mecca. The infrastructure follows the demand: solid fiber in expat areas, dense coworking. Your IT, however, sees a clear Indonesian IP. Here's what to handle.",
        quickfacts={
            "Timezone": "WITA (UTC+8) for Bali — no DST",
            "US business-hour overlap": "Hard — flip schedule",
            "Common ISPs": "BizNet, Telkom IndiHome, MyRepublic",
            "Banking risk": "Moderate — SE Asia flagged",
            "Network restrictions": "Light — Reddit / some adult sites blocked",
            "HomeLink-friendly": "Yes — strong fiber in Canggu / Ubud / Sanur",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Indonesian residential IPs resolve to \"Indonesia\" in MaxMind / IP2Location. M365 + Google Workspace flag the country on first login. Some corporate security policies treat Indonesia as elevated risk.",
            "<strong>MFA push location.</strong> Telkomsel, XL Axiata, Indosat SIMs all geolocate the push to Indonesia. Two foreign signals on the same login = obvious.",
            "<strong>Working-hour mismatch.</strong> Bali is UTC+8, 11–15 hours ahead of the US. Activity timestamp pattern will be unusual to a manager glancing at logs.",
        ],
        callout_strong="Bali-specific gotcha:",
        callout_body="Reddit is blocked in Indonesia at the ISP level (intermittent enforcement). If you visit Reddit during work, your traffic will fail-quiet — which doesn't show up to IT but may surprise you.",
        hours_paras=[
            "Bali = WITA (UTC+8), no DST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9pm Bali = 9am ET (winter) or 10am ET (summer). Best window = your evening.",
            "<strong>West Coast people:</strong> midnight Bali = 9am PT (winter). Brutal — overnight Zooms.",
            "<strong>Pattern most nomads use:</strong> 8pm-midnight real-time work, mornings free for the beach / yoga. Canggu has many late-open cafés with good wifi (Crate, Quince, etc.).",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Indonesia is in moderate-fraud-risk tier for US banks. Travel notice mandatory. BCA and Mandiri ATMs are reliable. Some smaller ATMs only accept Visa or Mastercard, not both.",
            "<strong>Streaming:</strong> Netflix swaps to ID library. Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. With IP at home, all US libraries stay intact.",
            "<strong>Phone:</strong> US plans don't include Indonesia. Telkomsel tourist SIM at airport ~$15/mo.",
        ],
        country_specific_bullets=[
            "<strong>Bali fiber is concentrated in expat areas.</strong> Canggu, Ubud, Sanur, Seminyak — fast (50-200 Mbps) fiber widely available. Outside those areas = unreliable mobile.",
            "<strong>Coworking is everywhere.</strong> Outpost, Tropical Nomad, Dojo, Karya — dedicated nomad spots with great wifi.",
            "<strong>Power outages are real.</strong> Bali has frequent brief outages — every hotel and serious workspace has a backup. Personal UPS for your home router is worth it.",
            "<strong>Indonesian visa policy</strong> changes — current B211 visit visa allows up to 180 days. Tax residency triggers at 183 days like most countries.",
            "<strong>The Bali volcano + earthquake risk</strong> is real but rarely affects daily work. Worth knowing for emergency planning.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you fly.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Test rental wifi before booking</strong> — \"WiFi included\" can mean anything in Bali. Look for actual speed numbers.",
            "<strong>Handle the IP layer</strong> — Indonesian IPs are unmistakable to commercial geo databases.",
            "<strong>Get a Telkomsel SIM</strong> at the airport for backup connectivity. Power drops are common.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "united-kingdom": dict(
        country="United Kingdom",
        lede="The UK is the safest cultural fit for US remote workers — same language, similar work culture, broadly familiar systems. The IT-side challenge is unchanged: your IP is unmistakably UK.",
        quickfacts={
            "Timezone": "GMT (UTC+0) / BST (UTC+1, Mar–Oct)",
            "US business-hour overlap": "Workable — 5h ahead of ET",
            "Common ISPs": "BT, Sky, Virgin Media, Vodafone UK, TalkTalk",
            "Banking risk": "Low — US banks treat as low-fraud",
            "Network restrictions": "Light — some adult/gambling DNS blocks",
            "HomeLink-friendly": "Yes — fast widespread fiber, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> UK residential IPs (BT, Virgin, Sky) resolve to \"United Kingdom\" with high confidence. M365 + Google Workspace flag the country on first login. Okta logs city + ASN.",
            "<strong>MFA push location.</strong> A push approved from a UK SIM (EE, O2, Vodafone) adds UK geolocation. Two foreign signals on one login = obvious story.",
            "<strong>Calendar timezone.</strong> GMT/BST stamps every meeting invite, Slack message, Jira comment. Your colleagues will see UK timezone in metadata even if your activity hours look normal.",
        ],
        callout_strong="UK-specific gotcha:",
        callout_body="the BST↔GMT switch (last Sunday of October / March) doesn't align with US DST changeovers. There are 2 weeks per year when your offset to US colleagues is OFF by 1 hour from normal. Common source of \"wait, when's our standup?\" confusion.",
        hours_paras=[
            "UK = GMT (winter) or BST (summer). 5–8 hours ahead of US:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9am ET = 2pm London. Comfortable workday.",
            "<strong>Central Time people:</strong> 9am CT = 3pm London. Comfortable.",
            "<strong>West Coast people:</strong> 9am PT = 5pm London. You're starting at the end of the UK day. Tougher.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> US banks treat UK as low-fraud — minimal friction. Set a travel notice anyway. Most US debit cards work at UK ATMs without issue. Capital One 360 and Schwab Investor Checking have no foreign-transaction fees.",
            "<strong>Streaming:</strong> Netflix swaps to UK library. Hulu blocks. ESPN+ blocked. HBO Max (now \"Max\") works in UK with separate account; otherwise blocked. Apple TV+ works. With your IP at home, all US libraries stay intact.",
            "<strong>BBC iPlayer</strong> is freely accessible from UK IPs (no payment needed) — a perk if you want to actually consume British TV while there.",
        ],
        country_specific_bullets=[
            "<strong>The IR35 / employment regulations</strong> only matter if your UK stay overlaps employment-status questions — short stays don't trigger this. Don't let employer-side IT confuse residency vs presence.",
            "<strong>Adult / gambling sites are DNS-filtered</strong> by most UK ISPs by default (you can opt out). Doesn't affect work tools.",
            "<strong>Coworking</strong> is dense in London (WeWork, Second Home, etc.) but pricier than mainland Europe.",
            "<strong>UK power is 230V/50Hz</strong> with type G plugs. US chargers work but need adapters; some appliances won't.",
            "<strong>UK fiber speeds vary widely.</strong> London inner-city = 1 Gbps available. Smaller towns = ADSL still common (15-50 Mbps).",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone — BST/GMT will be obvious in metadata.",
            "<strong>Travel-notice your bank(s)</strong> — low priority but cheap insurance.",
            "<strong>Plan around the BST↔GMT switch</strong> if your stay crosses late October or late March. Your apparent offset will shift.",
            "<strong>Handle the IP layer</strong> — UK IPs are unmistakable.",
            "<strong>Note your camera background.</strong> Visible UK power outlets, light switches, and street signs are subtle but real tells if a colleague spots them on a call.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "italy": dict(
        country="Italy",
        lede="Italy combines the European nomad infrastructure with culture that pulls people back year after year. Your IT, however, sees a clear Italian IP from the moment you connect. Here's the rundown.",
        quickfacts={
            "Timezone": "CET (UTC+1) / CEST (UTC+2, Mar–Oct)",
            "US business-hour overlap": "Workable — 6-9h ahead of US",
            "Common ISPs": "TIM, Vodafone IT, Fastweb, WindTre",
            "Banking risk": "Low — EU treaty, low-fraud",
            "Network restrictions": "None on consumer ISPs",
            "HomeLink-friendly": "Yes — fiber in major cities, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Italian residential IPs (TIM Fibra especially) resolve to \"Italy\" cleanly. M365 + Google Workspace flag the country on first login. Okta logs city + ASN per session.",
            "<strong>MFA push location.</strong> Push approved from TIM, Vodafone IT, or WindTre SIMs adds Italy to the auth event.",
            "<strong>Calendar timezone.</strong> CET/CEST stamps everything. Italian working hours (9-7 with long lunch) ARE different from US 9-5, so unusual times in your activity logs may compound the IP signal.",
        ],
        callout_strong="Italy-specific gotcha:",
        callout_body="Italian internet has historically been slower than the rest of Western Europe. Fiber rollout has accelerated, but if you're booking outside major cities, verify the actual line speed (not the marketing claim).",
        hours_paras=[
            "Italy = CET / CEST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9am ET = 3pm Rome. Comfortable workday into Italian dinner hour.",
            "<strong>Central Time people:</strong> 9am CT = 4pm Rome. Late afternoon start.",
            "<strong>West Coast people:</strong> 9am PT = 6pm Rome. You're working through Italian evening — late dinners.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Major US banks handle Italy fine. Set a travel notice. Italian ATM acceptance varies by bank — Intesa Sanpaolo and UniCredit ATMs are reliable. Cash is more common in smaller cities than in the US.",
            "<strong>Streaming:</strong> Netflix swaps to IT library (English subtitles available). Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. RAI Play (Italian public TV) is free and works on Italian IP.",
            "<strong>Apple ID / iMessage:</strong> Tied to your account region, not IP. Both stay working.",
        ],
        country_specific_bullets=[
            "<strong>Internet quality varies massively by city.</strong> Milan, Rome, Bologna, Turin: fast fiber widely available. Smaller towns: ADSL still common, slow upload. Always verify the rental's actual speed.",
            "<strong>Italian summer (August)</strong> empties cities and slows everything — including ISP customer service. Plan around it.",
            "<strong>Coworking</strong> exists in Milan and Rome but isn't as dense as Berlin / Amsterdam.",
            "<strong>EU GDPR</strong> means some US SaaS tools treat Italian IPs as \"EU subject\" with consent banners. Doesn't break anything but creates traceable artifacts in audit logs.",
            "<strong>Tax residency triggers at 183 days</strong> in any 12-month window. Short stays clean.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you fly.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Verify rental fiber speeds</strong> before committing — Italy is hit-or-miss outside major cities.",
            "<strong>Handle the IP layer</strong> — Italian IPs are unmistakable in geo databases.",
            "<strong>Plan around August.</strong> If you'll be in Italy in August, expect slower everything (ISPs, banks, services).",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "france": dict(
        country="France",
        lede="France attracts a less-touristy remote-work crowd — Paris for business travelers, Provence and the south for longer stays. Here's what your IT actually sees from a French IP and what to handle.",
        quickfacts={
            "Timezone": "CET (UTC+1) / CEST (UTC+2, Mar–Oct)",
            "US business-hour overlap": "Workable — 6-9h ahead of US",
            "Common ISPs": "Orange, SFR, Bouygues Telecom, Free",
            "Banking risk": "Low — EU treaty, low-fraud",
            "Network restrictions": "None on consumer ISPs",
            "HomeLink-friendly": "Yes — strong fiber, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Orange, Free, SFR — all French residential ISPs resolve to \"France\" cleanly. M365 + Google Workspace flag country on first login.",
            "<strong>MFA push location.</strong> Push approved from a French SIM (Orange, Free Mobile, SFR, Bouygues) adds France to the auth event.",
            "<strong>Calendar timezone.</strong> CET/CEST is standard French metadata. Your meetings, Slack messages, Jira tickets all carry it.",
        ],
        callout_strong="France-specific gotcha:",
        callout_body="French fiber (\"Fibre\") is among the cheapest and fastest in the world — €30/mo for 1 Gbps symmetric is normal. Don't overpay for hotel wifi when an Airbnb with Fibre is right there.",
        hours_paras=[
            "France = CET (winter) / CEST (summer). So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9am ET = 3pm Paris. Workable through Parisian dinner.",
            "<strong>Central Time people:</strong> 9am CT = 4pm Paris. Late-afternoon start.",
            "<strong>West Coast people:</strong> 9am PT = 6pm Paris. Working through dinner.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> France is low-friction for US bank fraud detection. Travel notice anyway. Most US debit cards work at French ATMs (BNP Paribas, Société Générale, Crédit Agricole all common). Capital One and Schwab fee-free.",
            "<strong>Streaming:</strong> Netflix swaps to FR library. Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. With IP at home, US libraries persist.",
            "<strong>French equivalent:</strong> France Télévisions (free public TV), Canal+ (paid cable), MyTF1, M6 — all work on French IPs if you want to stream French content.",
        ],
        country_specific_bullets=[
            "<strong>Internet is exceptional and cheap.</strong> €30/mo for symmetric fiber is normal in cities. Even rural areas have decent ADSL.",
            "<strong>French banks are GDPR-strict.</strong> Some US SaaS payment integrations get extra friction with French billing addresses.",
            "<strong>EU GDPR</strong> creates the same audit-log artifacts as Italy — visible in some corporate logs.",
            "<strong>Tax residency at 183 days</strong> like most countries. Long stays trigger France's notoriously detailed tax system — talk to an accountant.",
            "<strong>August is a real thing.</strong> France pretty much shuts down. Bank customer service slow, mail slow, deliveries delayed.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you fly.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Look for \"Fibre\" listings</strong> when booking accommodation — French fiber is among the world's best, not all properties have it yet.",
            "<strong>Handle the IP layer</strong> — French IPs are unmistakable.",
            "<strong>Plan around August</strong> if your trip overlaps. Most French institutions slow down significantly.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "germany": dict(
        country="Germany",
        lede="Berlin is one of Europe's biggest remote-work hubs. Munich and Hamburg attract corporate transplants. Either way, your IT sees a German IP. Here's the rundown.",
        quickfacts={
            "Timezone": "CET (UTC+1) / CEST (UTC+2, Mar–Oct)",
            "US business-hour overlap": "Workable — 6-9h ahead of US",
            "Common ISPs": "Deutsche Telekom, Vodafone DE, 1&1, O2",
            "Banking risk": "Low — EU treaty",
            "Network restrictions": "None on consumer ISPs",
            "HomeLink-friendly": "Yes — fast widespread fiber, no DPI",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> Deutsche Telekom and Vodafone DE residential IPs resolve to \"Germany\" cleanly in MaxMind / IP2Location. M365 + Google Workspace flag country immediately.",
            "<strong>MFA push location.</strong> Push approved from a German SIM (T-Mobile DE, Vodafone DE, O2 DE) adds Germany to the auth event.",
            "<strong>Calendar timezone.</strong> CET/CEST in all metadata. Standard German business hours roughly match US East Coast lunch onwards — moderate mismatch.",
        ],
        callout_strong="Germany-specific gotcha:",
        callout_body="Germany is GDPR's birthplace. Some US SaaS tools you use at work will trigger differently for German-IP sessions — extra consent dialogs, EU-data-only storage routing, etc. Doesn't break anything but creates auditable footprints.",
        hours_paras=[
            "Germany = CET / CEST. So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9am ET = 3pm Berlin. Comfortable workday into Berlin evening.",
            "<strong>Central Time people:</strong> 9am CT = 4pm Berlin. Late-afternoon start.",
            "<strong>West Coast people:</strong> 9am PT = 6pm Berlin. Working through Berlin dinner.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Germany is low-friction. Travel notice anyway. Sparkasse and Deutsche Bank ATMs are everywhere; Capital One and Schwab fee-free. Cash is still common — small purchases often cash-only.",
            "<strong>Streaming:</strong> Netflix swaps to DE library. Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. ARD / ZDF / Mediathek (German public TV) free on German IPs. With IP at home, US libraries persist.",
            "<strong>Cards:</strong> Germany is a cash-leaning country compared to the rest of Europe. Many Berlin restaurants and bars are still cash-only. Carry euros.",
        ],
        country_specific_bullets=[
            "<strong>Internet quality varies sharply.</strong> Berlin and Munich have widespread fiber. Smaller towns and rural areas: still on slow DSL in many places. Always verify rental specs.",
            "<strong>Berlin coworking is dense and cheap.</strong> Factory Berlin, Mindspace, betahaus — €150-300/mo for premium spots.",
            "<strong>Strict shop hours.</strong> Sundays = nearly everything closed. Plan groceries.",
            "<strong>EU GDPR audit footprint</strong> — same as France/Italy.",
            "<strong>Tax residency at 183 days.</strong> Short stays clean.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone before you fly.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Carry cash.</strong> Germany is cash-friendly more than most EU countries.",
            "<strong>Handle the IP layer</strong> — German IPs are unmistakable.",
            "<strong>Verify rental internet</strong> if outside Berlin/Munich — fiber rollout is uneven.",
        ],
    ),
    # ───────────────────────────────────────────────────────────────────
    "greece": dict(
        country="Greece",
        lede="Greece's digital nomad visa and Mediterranean lifestyle make it an increasingly popular destination. Athens for city work, the islands for summer escapes. Here's the IT-side reality.",
        quickfacts={
            "Timezone": "EET (UTC+2) / EEST (UTC+3, Mar–Oct)",
            "US business-hour overlap": "Hard — 7-10h ahead of US",
            "Common ISPs": "OTE Cosmote, Vodafone GR, Wind",
            "Banking risk": "Low–moderate",
            "Network restrictions": "None on consumer ISPs",
            "HomeLink-friendly": "Yes — fiber in Athens / Thessaloniki, mobile elsewhere",
        },
        it_bullets=[
            "<strong>IP geolocation.</strong> OTE / Cosmote and Vodafone GR IPs resolve to \"Greece\" in MaxMind / IP2Location. M365 + Google Workspace flag country on first login.",
            "<strong>MFA push location.</strong> Push approved from a Greek SIM (Cosmote, Vodafone GR, Wind) adds Greece to the auth event.",
            "<strong>Calendar timezone.</strong> EET/EEST stamps your metadata. Greek business hours (9-5 + long lunch break) don't fully align with US 9-5; activity timestamps will look unusual.",
        ],
        callout_strong="Greece-specific gotcha:",
        callout_body="island internet quality varies wildly. A villa on Mykonos or Santorini sounds great but the fiber may be 20Mbps shared with the entire building. Athens has proper gigabit fiber.",
        hours_paras=[
            "Greece = EET (winter) / EEST (summer). So:",
        ],
        hours_bullets=[
            "<strong>East Coast people:</strong> 9am ET = 4pm Athens. Workable through Greek evening.",
            "<strong>Central Time people:</strong> 9am CT = 5pm Athens. Late-afternoon start.",
            "<strong>West Coast people:</strong> 9am PT = 7pm Athens. Working through dinner.",
        ],
        banking_paras=[
            "<strong>Banking:</strong> Greece is low-friction. Travel notice anyway. Greek ATMs charge €2-3 fees on top of US bank fees; Schwab Investor Checking reimburses these. Cash is common in smaller establishments.",
            "<strong>Streaming:</strong> Netflix swaps to GR library. Hulu blocks. ESPN+ blocked. HBO Max blocked. Apple TV+ works. ERT (Greek public TV) free on Greek IP. With IP at home, US libraries persist.",
            "<strong>Cards:</strong> Greek mainland cities (Athens, Thessaloniki) are card-friendly. Islands lean cash-heavier — carry euros for small islands.",
        ],
        country_specific_bullets=[
            "<strong>Athens is the only city with reliable urban fiber.</strong> Thessaloniki has it too but smaller coverage. Islands = mobile-data is often more reliable than the local fiber.",
            "<strong>The digital nomad visa</strong> exists since 2021 — great for long stays. Doesn't change what your US employer sees.",
            "<strong>August is when Greeks themselves vacation.</strong> Athens empties; islands fill. Service slows everywhere.",
            "<strong>EU GDPR</strong> creates the same audit footprint as Italy/France/Germany.",
            "<strong>Tax residency at 183 days.</strong> Short stays clean.",
        ],
        action_items=[
            "<strong>Lock your device timezone</strong> to your home time zone.",
            "<strong>Travel-notice your bank(s).</strong>",
            "<strong>Test island internet</strong> before booking — \"WiFi\" on small islands often means very slow shared connection.",
            "<strong>Handle the IP layer</strong> — Greek IPs are unmistakable.",
            "<strong>Greek SIM card</strong> for backup connectivity, especially if you'll be on islands. Cosmote has the best island coverage.",
        ],
    ),
}


# ── Generate ────────────────────────────────────────────────────────
import os
os.makedirs(OUT_DIR, exist_ok=True)

for slug, data in COUNTRIES.items():
    qf = quickfacts_html(data["quickfacts"])
    itb = bullets_html(data["it_bullets"])
    hours_html = paragraphs_html(data["hours_paras"]) + "\n    <ul>\n" + bullets_html(data["hours_bullets"]) + "\n    </ul>"
    banking_html = paragraphs_html(data["banking_paras"])
    csb = bullets_html(data["country_specific_bullets"])
    ai = numbered_html(data["action_items"])
    out = TEMPLATE.format(
        country=data["country"],
        lede=data["lede"],
        quickfacts=qf,
        it_bullets=itb,
        callout_strong=data["callout_strong"],
        callout_body=data["callout_body"],
        hours_html=hours_html,
        banking_html=banking_html,
        country_specific_bullets=csb,
        action_items=ai,
    )
    path = f"{OUT_DIR}/{slug}.html"
    with open(path, "w") as f:
        f.write(out)
    print(f"wrote {path} ({len(out)} bytes)")
