import type { Soundscape } from './soundscape';

const SPEAKER = 'M4 9h4l5-4v14l-5-4H4z';
const WAVES = 'M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12';
const OFF = 'M16.5 9.5l5 5M21.5 9.5l-5 5';

const STYLE = `
#sound-toggle {
  position: fixed; top: 12px; right: 12px; z-index: 5;
  width: 56px; height: 56px; padding: 0; border: 0; border-radius: 50%;
  background: rgba(255, 255, 255, 0.72); box-shadow: 0 2px 8px rgba(0, 40, 80, 0.18);
  display: grid; place-items: center; touch-action: manipulation;
}
#sound-toggle svg { width: 30px; height: 30px; fill: none; stroke: #2f5d4a; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
#sound-toggle .speaker { fill: #2f5d4a; }
`;

/** Round button in a corner that turns the ambient sound off and on. */
export function mountSoundButton(sound: Soundscape): void {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.append(style);
  const button = document.createElement('button');
  button.id = 'sound-toggle';
  button.type = 'button';
  const render = () => {
    const muted = sound.muted;
    button.setAttribute('aria-label', muted ? 'Remettre le son' : 'Couper le son');
    button.setAttribute('aria-pressed', String(muted));
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="speaker" d="${SPEAKER}"/><path d="${muted ? OFF : WAVES}"/></svg>`;
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sound.setMuted(!sound.muted);
    render();
  });
  render();
  document.body.append(button);
}
