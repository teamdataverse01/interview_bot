"use client";

import { useEffect, useState } from "react";

// OneTrust / FIFA-style cookie consent: a bottom banner with three actions, plus a full
// Privacy Preference Center modal with per-category toggles. Choice is stored in localStorage.

const STORAGE_KEY = "dv_cookie_consent";

type Prefs = { necessary: true; functional: boolean; performance: boolean; targeting: boolean };

const CATEGORIES: { key: keyof Prefs; name: string; always?: boolean; body: string }[] = [
  {
    key: "necessary",
    name: "Strictly Necessary Cookies",
    always: true,
    body:
      "These cookies are necessary for the website to function and cannot be switched off in our systems. " +
      "They are usually only set in response to actions made by you which amount to a request for services, " +
      "such as setting your privacy preferences, logging in, or filling in forms.",
  },
  {
    key: "functional",
    name: "Functional Cookies",
    body:
      "These cookies enable the website to provide enhanced functionality and personalisation. They may be set " +
      "by us or by third-party providers whose services we have added to our pages. If you do not allow these " +
      "cookies then some or all of these services may not function properly.",
  },
  {
    key: "performance",
    name: "Performance Cookies",
    body:
      "These cookies allow us to count visits and traffic sources so we can measure and improve the performance " +
      "of our site. They help us to know which pages are the most and least popular and see how visitors move " +
      "around the site. All information these cookies collect is aggregated and therefore anonymous. If you do " +
      "not allow these cookies we will not know when you have visited our site, and will not be able to monitor " +
      "its performance.",
  },
  {
    key: "targeting",
    name: "Targeting Cookies",
    body:
      "These cookies may be set through our site by our advertising partners. They may be used by those companies " +
      "to build a profile of your interests and show you relevant adverts on other sites. They do not store " +
      "directly personal information, but are based on uniquely identifying your browser and internet device.",
  },
];

const INTRO =
  "When you visit any website, it may store or retrieve information on your browser, mostly in the form of cookies. " +
  "This information might be about you, your preferences, or your device and is mostly used to make the site work as " +
  "you expect it to. The information does not usually directly identify you, but it can give you a more personalized " +
  "web experience. Because we respect your right to privacy, you can choose not to allow some types of cookies. " +
  "Blocking some types may impact your experience of the site and the services we can offer.";

export function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [active, setActive] = useState<string>("your-privacy");
  const [prefs, setPrefs] = useState<Prefs>({
    necessary: true, functional: false, performance: false, targeting: false,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPrefs({ ...JSON.parse(saved), necessary: true });
      else setShowBanner(true);
    } catch {
      setShowBanner(true);
    }
    setReady(true);
  }, []);

  function persist(p: Prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, ts: Date.now() })); } catch { /* noop */ }
    setPrefs(p);
    setShowBanner(false);
    setShowPrefs(false);
  }

  const acceptAll = () => persist({ necessary: true, functional: true, performance: true, targeting: true });
  const rejectAll = () => persist({ necessary: true, functional: false, performance: false, targeting: false });
  const confirmChoices = () => persist(prefs);

  if (!ready || (!showBanner && !showPrefs)) return null;

  return (
    <>
      {/* Bottom banner */}
      {showBanner && !showPrefs && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-violet-200 shadow-[0_-8px_30px_rgba(76,29,149,0.10)]">
          <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">We value your privacy 🍪</p>
              <p className="mt-0.5">
                We use cookies to make the site work, analyze traffic, and improve your experience. Choose
                which cookies you&apos;re happy for us to use.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button onClick={() => { setShowPrefs(true); }}
                className="px-4 py-2 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 text-sm font-medium">
                Preference Center
              </button>
              <button onClick={rejectAll}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium">
                Reject All
              </button>
              <button onClick={acceptAll}
                className="px-4 py-2 rounded-lg btn-brand text-sm font-semibold">
                I&apos;m OK with that
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preference Center modal */}
      {showPrefs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <span className="text-violet-600 font-bold tracking-wide">DATAVERSE</span>
              <button onClick={() => setShowPrefs(false)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="px-6 pt-4">
              <h2 className="text-lg font-bold text-slate-800">Privacy Preference Center</h2>
            </div>

            {/* body: left nav + right detail */}
            <div className="flex-1 overflow-y-auto scroll-thin grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-0">
              <nav className="border-r border-slate-100 p-3 space-y-1">
                <NavItem id="your-privacy" label="Your Privacy" active={active} onClick={setActive} />
                {CATEGORIES.map((c) => (
                  <NavItem key={c.key} id={c.key} label={c.name} active={active} onClick={setActive} />
                ))}
              </nav>

              <div className="p-5 text-sm">
                {active === "your-privacy" ? (
                  <>
                    <h3 className="font-semibold text-slate-800">Your Privacy</h3>
                    <p className="mt-2 text-slate-600 leading-relaxed">{INTRO}</p>
                  </>
                ) : (
                  (() => {
                    const cat = CATEGORIES.find((c) => c.key === active)!;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-800">{cat.name}</h3>
                          {cat.always ? (
                            <span className="text-emerald-600 font-semibold text-xs">Always Active</span>
                          ) : (
                            <Toggle
                              on={prefs[cat.key] as boolean}
                              onChange={(v) => setPrefs((p) => ({ ...p, [cat.key]: v }))}
                            />
                          )}
                        </div>
                        <p className="mt-3 text-slate-600 leading-relaxed">{cat.body}</p>
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* footer */}
            <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button onClick={rejectAll}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium">
                Reject All
              </button>
              <button onClick={confirmChoices}
                className="px-4 py-2 rounded-lg btn-brand text-sm font-semibold">
                Confirm My Choices
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavItem({ id, label, active, onClick }: { id: string; label: string; active: string; onClick: (id: string) => void }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
        active === id ? "bg-violet-50 text-violet-700 font-medium" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition ${on ? "bg-violet-600" : "bg-slate-300"}`}
      aria-pressed={on}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}
