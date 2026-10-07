import { describe, expect, it } from "vitest";
import { buildConsent, CONSENT_COOKIE, DEFAULT_CONSENT, gtagInitScript, parseConsent } from "./consent";

const cookie = (v: object) => `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(v))}`;

describe("parseConsent", () => {
  it("czyta zapisana decyzje sposrod innych ciasteczek", () => {
    const c = parseConsent(`a=1; ${cookie({ ...buildConsent(true), version: 2 })}; b=2`);
    expect(c?.analytics_storage).toBe("granted");
  });

  it("brak albo uszkodzone ciasteczko to brak decyzji", () => {
    expect(parseConsent("a=1")).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=%7Bzepsute`)).toBeNull();
  });
});

describe("buildConsent", () => {
  it("reklamy zawsze denied, analityka wedlug wyboru", () => {
    for (const on of [true, false]) {
      const c = buildConsent(on);
      expect(c.ad_storage).toBe("denied");
      expect(c.ad_user_data).toBe("denied");
      expect(c.analytics_storage).toBe(on ? "granted" : "denied");
    }
  });
});

describe("gtagInitScript", () => {
  const js = gtagInitScript("G-ABC123");

  it("consent default denied idzie przed jakimkolwiek config i ladowaniem gtag.js", () => {
    const def = js.indexOf("'consent','default'");
    expect(def).toBeGreaterThan(-1);
    expect(def).toBeLessThan(js.indexOf("'config'"));
    expect(def).toBeLessThan(js.indexOf("googletagmanager.com/gtag/js"));
    expect(js).toContain(JSON.stringify(DEFAULT_CONSENT));
  });

  it("bez zgody na analityke wychodzi przed zaladowaniem gtag.js", () => {
    // Uruchamiamy skrypt na atrapie przegladarki i patrzymy, czy dodal <script>.
    const run = (cookieStr: string) => {
      const added: unknown[] = [];
      const win: Record<string, unknown> = {};
      const doc = { cookie: cookieStr, createElement: () => ({}), head: { appendChild: (s: unknown) => added.push(s) } };
      new Function("window", "document", "dataLayer", js.replace(/dataLayer\.push/g, "window.dataLayer.push"))(win, doc, undefined);
      return { added, dataLayer: win.dataLayer as IArguments[] };
    };
    expect(run("").added).toHaveLength(0);
    expect(run(cookie({ ...DEFAULT_CONSENT, version: 2 })).added).toHaveLength(0);
    const granted = run(cookie({ ...buildConsent(true), version: 2 }));
    expect(granted.added).toHaveLength(1);
    expect([...granted.dataLayer[1]].slice(0, 2)).toEqual(["consent", "update"]);
  });
});
