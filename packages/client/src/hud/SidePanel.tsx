import { useEffect, useMemo, useRef, useState } from 'react';
import { toolToBuilding, type BuildingId, type HeroStateKind, type TranscriptLine } from '@agent-citadel/shared';
import { useWorld } from '../store';
import { useSettings } from '../settings';
import { useUi, buildingText } from '../i18n';
import { TEAM_COLORS } from '../game/placeholders';
import { clip, formatK } from '../util';

// Stała referencja — selektor zwracający świeże [] przy każdym wywołaniu
// wprawiłby useSyncExternalStore w nieskończoną pętlę renderów.
const NO_LINES: TranscriptLine[] = [];

/** Kolor + emoji per stan (karta pionka — od razu widać „co robi"). */
const STATE_STYLE: Record<HeroStateKind, { color: string; emoji: string }> = {
  working: { color: '#5dcaa5', emoji: '⚙️' },
  thinking: { color: '#85b7eb', emoji: '💭' },
  'awaiting-input': { color: '#ef9f27', emoji: '✋' },
  error: { color: '#f09595', emoji: '⚠️' },
  idle: { color: '#b4b2a9', emoji: '⏸️' },
  sleeping: { color: '#888780', emoji: '💤' },
  returning: { color: '#97c459', emoji: '🚶' },
};

/** Emoji budynku (dekoracyjne, wspólne dla obu motywów). */
const BUILDING_EMOJI: Record<BuildingId, string> = {
  citadel: '🏛️',
  tower: '🔭',
  forge: '🔨',
  library: '📚',
  mine: '⛏️',
  barracks: '👥',
  market: '📦',
  guild: '🔌',
};

function hexColor(index: number): string {
  const c = TEAM_COLORS[index % TEAM_COLORS.length];
  return `#${c.toString(16).padStart(6, '0')}`;
}

/** Panel wybranej sesji: karta pionka (stan, statystyki, zadanie, ostatnie akcje) + transkrypt. */
export function SidePanel() {
  const selected = useWorld((s) => s.selectedSessionId);
  const hero = useWorld((s) => (selected ? s.heroes[selected] : undefined));
  const peonsMap = useWorld((s) => s.peons);
  const missionsMap = useWorld((s) => s.missions);
  const lines = useWorld((s) => (selected ? s.transcripts[selected] ?? NO_LINES : NO_LINES));
  const select = useWorld((s) => s.select);
  const themeId = useSettings((s) => s.themeId);
  const lang = useSettings((s) => s.lang);
  const t = useUi();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lekki tick — odświeża czasy względne ("aktywny 12 min", "5m temu"), gdy nic
  // innego nie zmienia stanu (sesja bezczynna). Reszta i tak re-renderuje przy zdarzeniach.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!selected) return; // przy zamkniętym panelu nie tykaj (brak zbędnych re-renderów)
    const id = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines.length, selected]);

  // Derywacje z całych map — memo, by tick (co 10s) nie przeliczał ich bez zmiany danych.
  const helpers = useMemo(
    () => Object.values(peonsMap).filter((p) => p.parentSessionId === selected).length,
    [peonsMap, selected],
  );
  const mission = useMemo(
    () => Object.values(missionsMap).find((m) => m.sessionId === selected && m.status === 'active'),
    [missionsMap, selected],
  );

  if (!selected || !hero) return null;

  const now = Date.now();
  const st = STATE_STYLE[hero.state];
  const job = hero.state === 'working' ? hero.toolDetail ?? hero.currentTool : undefined;
  // Destynacja: dokąd jednostka zmierza na mapie (praca → budynek narzędzia; powrót → Twierdza).
  const destId: BuildingId | undefined =
    hero.state === 'working'
      ? toolToBuilding(hero.currentTool, hero.toolDetail)
      : hero.state === 'returning'
        ? 'citadel'
        : undefined;
  const destination = destId ? buildingText(themeId, destId, lang).label : undefined;

  return (
    <div className="hud-panel sidepanel">
      <div className="head">
        <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: hexColor(hero.teamColor), marginTop: 4, flex: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <strong>{hero.title}</strong>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              {hero.model ?? t.modelUnknown}
              {hero.gitBranch ? ` · ⎇ ${hero.gitBranch}` : ''}
              {hero.permissionMode ? ` · ${hero.permissionMode}` : ''}
            </div>
          </div>
        </div>
        <button className="ghost" onClick={() => select(undefined)}>
          ✕
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: `${st.color}29`,
          borderLeft: `3px solid ${st.color}`,
          padding: '8px 10px',
          fontSize: 13,
        }}
      >
        <span style={{ fontSize: 16 }}>{st.emoji}</span>
        <span>
          <b style={{ color: st.color }}>{t.states[hero.state]}</b>
          {job ? <span style={{ opacity: 0.85 }}> · {clip(job, 44)}</span> : null}
          {destination ? <span style={{ opacity: 0.6 }}> → {destination}</span> : null}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <Vital label={t.produced} value={formatK(hero.tokens.output)} />
        <Vital label={t.read} value={formatK(hero.tokens.input)} />
        <Vital label={t.active} value={fmtDuration(hero.startedAt, now)} />
        <Vital label={t.peons} value={String(helpers)} />
      </div>

      {mission && (
        <div>
          <Label text={t.currentTask} />
          <div style={{ fontSize: 12, lineHeight: 1.45, opacity: 0.9 }}>{clip(mission.prompt, 160)}</div>
        </div>
      )}

      {hero.recentActions && hero.recentActions.length > 0 && (
        <div>
          <Label text={t.recentActions} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            {hero.recentActions.map((a, i) => {
              const b = toolToBuilding(a.tool, a.detail);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, textAlign: 'center', flex: 'none' }}>{BUILDING_EMOJI[b]}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {buildingText(themeId, b, lang).label}
                    {a.detail ? <span style={{ opacity: 0.65 }}> · {a.detail}</span> : null}
                  </span>
                  <span style={{ opacity: 0.45, fontSize: 11, flex: 'none' }}>{relTime(a.ts, now, t.now)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="transcript" ref={scrollRef}>
        {lines.length === 0 && <div style={{ opacity: 0.5, fontSize: 12 }}>{t.transcriptHint}</div>}
        {lines.map((line, i) => (
          <div key={i} className={`line ${line.role}`}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#2a2926', borderRadius: 6, padding: '7px 9px' }}>
      <div style={{ fontSize: 11, opacity: 0.55 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, marginBottom: 5 }}>
      {text}
    </div>
  );
}

/** Czas trwania od startu sesji, np. "12 min" / "1h 5m". */
function fmtDuration(startedAt: string, now: number): string {
  const m = (now - Date.parse(startedAt)) / 60_000;
  if (!isFinite(m) || m < 1) return '<1 min';
  if (m < 60) return `${Math.round(m)} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${Math.round(m % 60)}m`;
}

/** Czas względny akcji: "teraz" / "5s" / "3m" / "2h". */
function relTime(ts: string, now: number, nowLabel: string): string {
  const s = Math.max(0, (now - Date.parse(ts)) / 1000);
  if (!isFinite(s) || s < 5) return nowLabel;
  if (s < 60) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m`;
  return `${Math.round(m / 60)}h`;
}
