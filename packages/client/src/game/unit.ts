import { AnimatedSprite, Container, Graphics, Text, type Spritesheet } from 'pixi.js';
import type { AgentKind, HeroStateKind } from '@agent-citadel/shared';
import type { Projection } from './projection';
import type { PathNode } from './pathfind';
import { buildUnitBody, labelStyle, teamColor } from './placeholders';
import { stateToAnimation } from './archetype';

const SPEED_GRID_PER_S = 2.2;
/** How long (s) the work bubble stays visible after content changes (then hide to declutter). */
const BUBBLE_TTL = 7;

/** Default sprite scale (fantasy/standard ~68px). Theme overrides via ThemeDef.heroSprite. */
const SPRITE_SCALE = 0.8;
/** Default foot anchor Y (fantasy/standard: row 57-59/68 -> 0.87). Overridden per theme. */
const SPRITE_FOOT_ANCHOR = 0.87;
/** Agent badge colors (Claude does not get a badge). */
const AGENT_BADGE_COLORS: Record<AgentKind, number | undefined> = {
  claude: undefined,
  codex: 0x10a37f, // OpenAI green
  opencode: 0xf59e0b, // amber-500
  koda: 0x8b5cf6, // violet-500
};

/**
 * Unit on the map (hero or peon): position on the logical grid,
 * waypoint movement, state overlays (aura, exclamation, smoke, zzz)
 * and a bubble with the work description.
 */
export class Unit {
  readonly container = new Container();
  gx: number;
  gy: number;
  private path: PathNode[] = [];
  private body: Container;
  private animated?: AnimatedSprite;
  private sheet?: Spritesheet;
  private aura = new Graphics();
  private crate = new Graphics();
  private teamRing = new Graphics();
  private selectionRing = new Graphics();
  private selected = false;
  private overlay = new Text({ text: '', style: labelStyle });
  private bubble = new Text({ text: '', style: { ...labelStyle, fontSize: 10 } });
  private nameTag: Text;
  private elapsed = Math.random() * 10;
  private state: HeroStateKind = 'idle';
  private bubbleUntil = 0; // elapsed time until the fresh bubble is shown
  private bubbleForced = false; // selected unit -> bubble always visible

  constructor(
    readonly id: string,
    readonly colorIndex: number,
    readonly isPeon: boolean,
    name: string,
    start: { gx: number; gy: number },
    private readonly projection: Projection,
    sheet?: Spritesheet | null,
    agent: AgentKind = 'claude',
    spriteScale: number = SPRITE_SCALE,
    spriteFootAnchor: number = SPRITE_FOOT_ANCHOR,
  ) {
    this.gx = start.gx;
    this.gy = start.gy;

    if (sheet) {
      // Real PixelLab sprite wrapped in Container so mirroring/dimming mechanics
      // (scale.x / alpha on this.body) keep working. update() chooses animation track.
      this.sheet = sheet;
      const sprite = new AnimatedSprite(sheet.animations.idle);
      sprite.anchor.set(0.5, spriteFootAnchor);
      sprite.scale.set(isPeon ? spriteScale * 0.8 : spriteScale);
      sprite.animationSpeed = 0.15;
      sprite.play();
      this.animated = sprite;
      this.body = new Container();
      this.body.addChild(sprite);
    } else {
      this.body = buildUnitBody(teamColor(colorIndex), isPeon);
    }

    // Team-color ring at the feet: ALWAYS visible (also under PixelLab sprite),
    // so the team is recognizable at a glance. Dark outline underneath for contrast.
    const ringRx = (isPeon ? 0.7 : 1) * 12;
    const ringRy = (isPeon ? 0.7 : 1) * 5.5;
    this.teamRing.ellipse(0, 2, ringRx, ringRy).stroke({ color: 0x14120c, width: 3.5, alpha: 0.5 });
    this.teamRing.ellipse(0, 2, ringRx, ringRy).stroke({ color: teamColor(colorIndex), width: 2.5, alpha: 0.95 });
    // Selection ring: white, pulsing, larger; distinguishes "selected" without losing team color.
    this.selectionRing.ellipse(0, 2, ringRx + 3.5, ringRy + 2).stroke({ color: 0xffffff, width: 2, alpha: 0.9 });
    this.selectionRing.visible = false;

    this.aura.circle(0, -12, 18).fill({ color: 0x7f77dd, alpha: 0.25 });
    this.aura.visible = false;

    // "loot" crate: peon carries it while returning to the hero
    this.crate.rect(-5, -8, 10, 8).fill(0x8a5a2a);
    this.crate.rect(-5, -8, 10, 3).fill(0xb07a3a);
    this.crate.rect(-1.5, -8, 3, 8).fill(0x5a3a1a);
    this.crate.position.set(isPeon ? 9 : 11, -14);
    this.crate.visible = false;

    this.overlay.anchor.set(0.5, 1);
    this.overlay.position.set(0, -34);

    this.bubble.anchor.set(0.5, 1);
    this.bubble.position.set(0, -44);

    this.nameTag = new Text({ text: name, style: { ...labelStyle, fontSize: isPeon ? 9 : 11 } });
    this.nameTag.anchor.set(0.5, 0);
    this.nameTag.position.set(0, 6);
    this.nameTag.alpha = 0.9;

    this.container.addChild(this.aura, this.selectionRing, this.teamRing, this.body, this.crate, this.overlay, this.bubble, this.nameTag);

    const badge = buildAgentBadge(agent);
    if (badge) this.container.addChild(badge);

    this.syncScreen();
  }

  setCrate(visible: boolean): void {
    this.crate.visible = visible;
  }

  setName(name: string): void {
    if (this.nameTag.text !== name) this.nameTag.text = name;
  }

  setPath(path: PathNode[]): void {
    this.path = path.filter((node) => Math.hypot(node.gx - this.gx, node.gy - this.gy) > 0.05);
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  /** Current state (for scene logic, for example only idle units wander). */
  get stateKind(): HeroStateKind {
    return this.state;
  }

  /** Selection from HUD; then the work bubble is visible without a time limit. */
  setBubbleForced(forced: boolean): void {
    this.bubbleForced = forced;
  }

  /** Selection from HUD/map: pulsing white ring at the selected unit's feet. */
  setSelected(on: boolean): void {
    if (this.selected === on) return;
    this.selected = on;
    this.selectionRing.visible = on;
    if (!on) this.selectionRing.scale.set(1);
  }

  setState(state: HeroStateKind, bubbleText?: string): void {
    this.state = state;
    this.aura.visible = state === 'thinking';
    this.overlay.text = state === 'awaiting-input' ? '!' : state === 'error' ? '✶' : state === 'sleeping' ? 'zzz' : '';
    this.overlay.style.fill = state === 'awaiting-input' ? 0xfac775 : state === 'error' ? 0xe24b4a : 0xb4b2a9;
    const newBubble = bubbleText ? clip(bubbleText, 34) : '';
    if (newBubble !== this.bubble.text) {
      this.bubble.text = newBubble;
      if (newBubble) this.bubbleUntil = this.elapsed + BUBBLE_TTL; // refresh TTL only on real change
    }
    const dimmed = state === 'sleeping';
    this.body.alpha = dimmed ? 0.45 : 1;
    this.nameTag.alpha = dimmed ? 0.45 : 0.9;
  }

  update(dtSeconds: number): void {
    this.elapsed += dtSeconds;

    // Sprite-backed unit: choose animation track (placeholder has procedural movement below).
    if (this.animated && this.sheet) {
      const anim = stateToAnimation(this.state, this.moving);
      const track = this.sheet.animations[anim];
      if (track && this.animated.textures !== track) {
        this.animated.textures = track;
        this.animated.play();
      }
    }

    if (this.path.length > 0) {
      const target = this.path[0];
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      const dist = Math.hypot(dx, dy);
      const step = SPEED_GRID_PER_S * dtSeconds;
      if (dist <= step) {
        this.gx = target.gx;
        this.gy = target.gy;
        this.path.shift();
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        // zwrot w kierunku ruchu (sprite i placeholder)
        this.body.scale.x = dx < -0.01 ? -1 : 1;
      }
      // procedural step animation: placeholder only (sprite has its own frames)
      if (!this.animated) {
        this.body.rotation = Math.sin(this.elapsed * 14) * 0.06;
        this.body.position.y = -Math.abs(Math.sin(this.elapsed * 14)) * 2;
      }
    } else {
      // "thinking" aura pulse works for both variants (engine overlay, not body)
      if (this.state === 'thinking') {
        this.aura.scale.set(1 + Math.sin(this.elapsed * 3) * 0.12);
      }
      if (!this.animated) {
        this.body.rotation = 0;
        if (this.state === 'working') {
          // "praca": rytmiczne pochylenie (kucie/kopanie)
          this.body.position.y = Math.abs(Math.sin(this.elapsed * 6)) * -1.5;
          this.body.rotation = Math.sin(this.elapsed * 6) * 0.1;
        } else if (this.state === 'thinking') {
          this.body.position.y = 0;
        } else {
          this.body.position.y = Math.sin(this.elapsed * 1.5) * 0.8;
        }
      }
    }

    if (this.overlay.text === '!') {
      this.overlay.position.y = -34 + Math.sin(this.elapsed * 5) * 3;
    }

    if (this.selected) this.selectionRing.scale.set(1 + Math.sin(this.elapsed * 4) * 0.08);

    // Bubble: fresh (after change) or when unit is selected; hidden the rest of the time.
    this.bubble.visible = this.bubble.text !== '' && (this.bubbleForced || this.elapsed < this.bubbleUntil);

    this.syncScreen();
  }

  private syncScreen(): void {
    const { x, y } = this.projection.toScreen(this.gx, this.gy);
    this.container.position.set(x, y);
    this.container.zIndex = this.projection.depth(this.gx, this.gy) + 100;
  }
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Small agent-origin badge (non-Claude only). Drawn procedurally, without assets. */
function buildAgentBadge(agent: AgentKind): Container | undefined {
  const color = AGENT_BADGE_COLORS[agent];
  if (!color) return undefined;
  
  const c = new Container();
  const g = new Graphics();
  g.circle(0, 0, 7).fill({ color }).stroke({ color: 0x0b0b0a, width: 1.5 });
  c.addChild(g);
  
  // Litera per agent
  const letterText = agent === 'codex' ? 'C' : agent === 'opencode' ? 'O' : agent === 'koda' ? 'K' : '?';
  const letter = new Text({ text: letterText, style: { ...labelStyle, fontSize: 9, fill: 0xffffff } });
  letter.anchor.set(0.5);
  c.addChild(letter);
  
  c.position.set(10, -30); // near the head, top-right corner of the unit
  return c;
}
