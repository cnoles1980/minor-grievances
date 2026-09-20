import { trackAction } from "./analytics";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MagnifyingGlass,
  Minus,
  Plus,
  X,
  LinkSimple,
  Flag,
  Check,
  Shuffle,
} from "@phosphor-icons/react";
import { api, previewMode } from "./api";
import { categories, colors } from "./seed";
const rotations = [-5, 2, -1, 5, -4, 2, -2, 3];
const fmt = (n) => n.toLocaleString("en-US").replaceAll(",", " ");
export default function App() {
  const [notes, setNotes] = useState([]),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recent"),
    [shuffleOrder, setShuffleOrder] = useState(null),
    [zoom, setZoom] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(""),
    [highlight, setHighlight] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [moreBusy, setMoreBusy] = useState(false);
  const [text, setText] = useState(""),
    [signature, setSignature] = useState(""),
    [color, setColor] = useState("yellow"),
    [kind, setKind] = useState("Misc"),
    [formError, setFormError] = useState("");
  const dialog = useRef(null),
    wall = useRef(null),
    drag = useRef(null),
    timer = useRef(null),
    pageVersion = useRef(0),
    sentinel = useRef(null),
    cursor = useRef(null),
    moreFailed = useRef(false);
  const announce = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4000);
  };
  const queryString = () =>
    `category=${encodeURIComponent(category)}&q=${encodeURIComponent(search)}&sort=${sort}`;
  async function refresh() {
    setShuffleOrder(null);
    const version = ++pageVersion.current;
    moreFailed.current = false;
    setLoading(true);
    try {
      const data = await api(`/notes?${queryString()}`);
      if (version !== pageVersion.current) return;
      setNotes(data);
      cursor.current = data.at(-1);
      setHasMore(data.length === 80);
      setError("");
      const id = new URLSearchParams(location.hash.slice(1)).get("note");
      if (id && category === "All" && !search) {
        const linked = await api(`/notes/${encodeURIComponent(id)}`);
        if (version !== pageVersion.current) return;
        setNotes((items) =>
          items.some((n) => n.id === id) ? items : [linked, ...items],
        );
        focusNote(id);
      }
    } catch (e) {
      if (version === pageVersion.current) setError(e.message);
    } finally {
      if (version === pageVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    const debounce = setTimeout(refresh, 180);
    return () => {
      clearTimeout(debounce);
      pageVersion.current++;
    };
  }, [category, search, sort]);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function more() {
    if (moreBusy || !hasMore) return;
    moreFailed.current = false;
    const version = pageVersion.current;
    setMoreBusy(true);
    try {
      const data = await api(
        `/notes?${queryString()}&before=${cursor.current?.created || 0}&beforeId=${encodeURIComponent(cursor.current?.id || "")}&beforeVotes=${cursor.current?.votes || 0}`,
      );
      if (version !== pageVersion.current) return;
      setNotes((items) => [
        ...items,
        ...data.filter((n) => !items.some((i) => i.id === n.id)),
      ]);
      cursor.current = data.at(-1);
      setHasMore(data.length === 80);
    } catch (e) {
      // Pause automatic retries after a network failure; the button still retries.
      moreFailed.current = true;
      announce(e.message);
    } finally {
      setMoreBusy(false);
    }
  }
  useEffect(() => {
    if (!sentinel.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !moreFailed.current) more();
      },
      { root: wall.current, rootMargin: "200px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, moreBusy, notes.length, category, search, sort]);
  function focusNote(id) {
    setHighlight(id);
    setTimeout(
      () =>
        document.getElementById(`note-${id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        }),
      80,
    );
  }
  useEffect(() => {
    const changed = () => refresh();
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [category, search, sort]);
  // Re-sort loaded notes when posting or endorsing changes their position.
  const compareNotes = (a, b) => {
    if (shuffleOrder)
      return (
        (shuffleOrder.get(a.id) ?? Infinity) -
        (shuffleOrder.get(b.id) ?? Infinity)
      );
    const tie =
      a.created - b.created || (a.id > b.id ? 1 : a.id < b.id ? -1 : 0);
    if (sort === "oldest") return tie;
    if (sort === "most") return b.votes - a.votes || -tie;
    if (sort === "least") return a.votes - b.votes || tie;
    return -tie;
  };
  const visible = [...notes]
    .sort(compareNotes)
    .filter(
      (n) =>
        (category === "All" || n.category === category) &&
        `${n.text} ${n.signature}`.toLowerCase().includes(search.toLowerCase()),
    );
  async function endorse(n) {
    if (busy || n.endorsed) return;
    setBusy(n.id);
    try {
      const result = await api(`/notes/${n.id}/endorse`, {});
      setNotes((items) =>
        items.map((item) => (item.id === n.id ? { ...item, ...result } : item)),
      );
      trackAction("grievance_endorsed");
      announce("Your irritation has been officially counted.");
    } catch (e) {
      announce(e.message);
    } finally {
      setBusy("");
    }
  }
  async function share(n) {
    const url = new URL(location.href);
    url.hash = `note=${n.id}`;
    try {
      await navigator.clipboard.writeText(url.href);
      announce("Complaint link copied. Spread the irritation.");
    } catch {
      location.hash = `note=${n.id}`;
      announce("The address bar now links to this complaint.");
    }
  }
  async function report(n) {
    setBusy(n.id);
    try {
      await api(`/notes/${n.id}/report`, {});
      announce("Flag received. This complaint is queued for review.");
    } catch (e) {
      announce(e.message);
    } finally {
      setBusy("");
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy("submit");
    setFormError("");
    try {
      const n = await api("/notes", { text, signature, category: kind, color });
      setNotes((items) => [n, ...items]);
      setCategory("All");
      setSearch("");
      setSort("recent");
      setShuffleOrder(null);
      dialog.current.close();
      setText("");
      setSignature("");
      focusNote(n.id);
      trackAction("grievance_filed");
      announce("OFFICIALLY NOTED. Nothing will be done.");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function random() {
    try {
      const n = await api(`/random?${queryString()}`);
      setNotes((items) =>
        items.some((item) => item.id === n.id) ? items : [...items, n],
      );
      focusNote(n.id);
    } catch (e) {
      announce(e.message);
    }
  }
  function shuffleGrievances() {
    const mixed = [...visible];
    for (let i = mixed.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }
    // Make every click visibly useful, even if chance returned the same order.
    if (mixed.length > 1 && mixed.every((note, i) => note.id === visible[i].id))
      mixed.push(mixed.shift());
    setShuffleOrder(new Map(mixed.map((note, i) => [note.id, i])));
    wall.current?.scrollTo(0, 0);
    announce("Loaded grievances shuffled. Same irritation, fresh order.");
  }
  return (
    <main>
      <header className="masthead">
        <div className="brand-aside">
          <img
            src={`${import.meta.env.BASE_URL}assets/annoyed-note.png`}
            alt="An unimpressed yellow sticky note"
          />
          <p>
            PETTY THOUGHTS.
            <br />
            BRIGHTER DAYS.
          </p>
        </div>
        <h1>
          THE BUREAU OF
          <br />
          MINOR GRIEVANCES
        </h1>
        <div className="header-action">
          <button
            className="file-button"
            disabled={previewMode}
            title={
              previewMode
                ? "Read-only preview. The shared wall is not connected yet."
                : undefined
            }
            onClick={() => dialog.current.showModal()}
          >
            {previewMode ? "FILING OPENS SOON" : "FILE A GRIEVANCE"}{" "}
            <ArrowRight size={21} />
          </button>
          <p>
            ANONYMOUS.
            <br />
            POINTLESS.
            <br />
            TOGETHER AT LAST.
          </p>
        </div>
      </header>
      <nav className="filters" aria-label="Filter grievances">
        <div className="tabs">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c);
                wall.current.scrollTo(0, 0);
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search">
          <MagnifyingGlass size={18} />
          <input
            aria-label="Search grievances"
            placeholder="Search grievances..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")}>
              <X />
            </button>
          )}
        </label>
      </nav>
      <div className="sort-row">
        <label htmlFor="sort-order">
          SORT BY
          <select
            id="sort-order"
            value={shuffleOrder ? "shuffled" : sort}
            onChange={(e) => {
              setShuffleOrder(null);
              setSort(e.target.value);
              trackAction("sort_changed");
              wall.current.scrollTo(0, 0);
            }}
          >
            {shuffleOrder && (
              <option value="shuffled" disabled>
                Shuffled
              </option>
            )}
            <option value="recent">Recent (new to old)</option>
            <option value="oldest">Old to new</option>
            <option value="most">Most +1s</option>
            <option value="least">Least +1s</option>
          </select>
        </label>
        <button
          className="shuffle-button"
          onClick={shuffleGrievances}
          disabled={loading || visible.length < 2}
          title="Shuffle the grievances currently loaded on the wall"
        >
          <Shuffle size={18} aria-hidden="true" /> Shuffle Grievances
        </button>
      </div>
      <section
        ref={wall}
        className="wall"
        aria-label="The grievance wall"
        tabIndex={0}
        onPointerDown={(e) => {
          if (e.target.closest("button,article")) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: wall.current.scrollLeft,
            top: wall.current.scrollTop,
          };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          wall.current.scrollLeft =
            drag.current.left - (e.clientX - drag.current.x);
          wall.current.scrollTop =
            drag.current.top - (e.clientY - drag.current.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <div className="notes" style={{ "--note-scale": zoom }}>
          {loading ? (
            <p className="empty">Opening the filing cabinet…</p>
          ) : error ? (
            <div className="empty" role="alert">
              <p>{error}</p>
              <button onClick={refresh}>Try again</button>
            </div>
          ) : !visible.length ? (
            <div className="empty">
              <h2>No grievances found.</h2>
              <p>A suspicious amount of peace and quiet.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Show all grievances
              </button>
            </div>
          ) : (
            visible.map((n, i) => (
              <article
                id={`note-${n.id}`}
                key={n.id}
                className={`note ${n.color} ${highlight === n.id ? "highlight" : ""}`}
                style={{ "--rotation": `${rotations[i % 8]}deg` }}
              >
                {i === 2 && (
                  <span className="stamp same-here" aria-hidden="true">
                    SAME HERE
                  </span>
                )}
                <p className="note-text">{n.text}</p>
                <p className="signature">— {n.signature || "Anonymous"}</p>
                <div className="note-footer">
                  <div className="note-tools" hidden={previewMode}>
                    <button
                      aria-label={`Copy link to complaint by ${n.signature}`}
                      onClick={() => share(n)}
                    >
                      <LinkSimple size={17} />
                    </button>
                    <button
                      aria-label={`Report complaint by ${n.signature}`}
                      disabled={busy === n.id}
                      onClick={() => report(n)}
                    >
                      <Flag size={16} />
                    </button>
                  </div>
                  <button
                    className="endorse"
                    aria-label={`Endorse: ${n.text}`}
                    aria-pressed={!!n.endorsed}
                    disabled={previewMode || busy === n.id || n.endorsed}
                    onClick={() => endorse(n)}
                  >
                    {n.endorsed ? <Check size={18} /> : <span>+1</span>}{" "}
                    <span>{fmt(n.votes)}</span>
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
        <div ref={sentinel} className="wall-end">
          {hasMore ? (
            <button onClick={more} disabled={moreBusy}>
              {moreBusy ? "OPENING ANOTHER FILING CABINET…" : "MORE GRIEVANCES"}
            </button>
          ) : visible.length > 8 ? (
            "YOU’VE REACHED THE END. FOR NOW."
          ) : null}
        </div>
      </section>
      <footer className="wall-controls">
        <span className="stamp collective">
          COLLECTIVE
          <br />
          EXHALE
        </span>
        <button className="random" onClick={random} disabled={!visible.length}>
          ANOTHER ONE, PLEASE <ArrowRight size={21} />
        </button>
        <div className="footer-right">
          <p>
            Different complaints.
            <br />
            Same energy.
          </p>
          <div className="zoom">
            <button
              aria-label="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              disabled={zoom <= 0.71}
            >
              <Minus size={20} />
            </button>
            <button
              aria-label="Zoom in"
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              disabled={zoom >= 1.39}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </footer>
      <div className="fineprint">
        <span>
          {previewMode
            ? "READ-ONLY PREVIEW · ILLUSTRATIVE CONTENT · SHARED FILING NOT CONNECTED"
            : notes.some((n) => n.demo)
              ? "PREVIEW WALL · INCLUDES ILLUSTRATIVE COMPLAINTS & COUNTS"
              : "YOUR COMPLAINT HAS BEEN RECEIVED. NOTHING WILL BE DONE."}
        </span>
        <span>NO ACCOUNTS. JUST SOLIDARITY.</span>
      </div>
      <div className="toast" role="status" aria-live="polite">
        {toast}
      </div>
      <dialog ref={dialog} aria-labelledby="form-title">
        <form onSubmit={submit}>
          <button
            className="close"
            type="button"
            aria-label="Close complaint form"
            onClick={() => dialog.current.close()}
          >
            <X size={24} />
          </button>
          <span className="eyebrow">DEPARTMENT OF EVERYDAY IRRITATIONS</span>
          <h2 id="form-title">FILE A GRIEVANCE.</h2>
          <p className="form-intro">
            Small problem. Strong feelings. You’re in the right place.
          </p>
          <label htmlFor="complaint">What’s annoying you?</label>
          <textarea
            id="complaint"
            maxLength={240}
            minLength={3}
            required
            placeholder="Go on. Get it off your chest."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="counter">{text.length} / 240</div>
          <label htmlFor="signature">
            Sign it <span>(optional)</span>
          </label>
          <input
            id="signature"
            maxLength={40}
            placeholder="Anonymous, if you prefer"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <div className="form-row">
            <label>
              File under
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Pick your paper</legend>
              <div className="swatches">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${c}`}
                    aria-label={`${c} paper`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                  >
                    {color === c && <Check size={19} />}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="guidelines">
            Swearing is fine. Racial slurs aren’t. No private details, threats,
            hate, or targeting real people.
          </p>
          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}
          <button className="file-button submit" disabled={busy === "submit"}>
            {busy === "submit" ? "FILING…" : "MAKE IT OFFICIAL"}{" "}
            <ArrowRight size={20} />
          </button>
        </form>
      </dialog>
    </main>
  );
}
