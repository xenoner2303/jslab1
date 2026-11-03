import type { LoopStats } from './loop.ts';

type Hud = {
  update(stats: LoopStats, score: number, correctionMagnitude?: number): void;
  showKillMessage(count: number): void;
};

function getElement(id: string): HTMLElement | null {
  const element = document.getElementById(id);
  return element;
}

export function initHud(): Hud {
  const scoreElement = getElement('score');
  const stepsElement = getElement('steps');
  const fpsElement = getElement('fps');
  const frameTimeElement = getElement('frameTime');
  const correctionElement = getElement('reconciliation-correction');
  const messageElement = getElement('kill-msg');
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    update(stats, score, correctionMagnitude) {
      if (scoreElement) scoreElement.textContent = `Score: ${score} bliblies`;
      if (stepsElement) stepsElement.textContent = `Steps: ${stats.sps}`;
      if (fpsElement) fpsElement.textContent = `FPS: ${stats.fps.toFixed(2)}`;
      if (frameTimeElement) {
        frameTimeElement.textContent = `Frame Time: ${stats.frameTime.toFixed(2)} ms`;
      }
      if (correctionElement && correctionMagnitude !== undefined) {
        correctionElement.textContent = `Reconciliation correction: ${correctionMagnitude.toFixed(2)} px`;
      }
    },
    showKillMessage(count) {
      if (count < 2 || !messageElement) return;
      const messages: Record<number, string> = {
        2: 'Double Kill!',
        3: 'Triple Kill!',
        4: 'Quadra Kill!',
        5: 'Penta Kill!',
      };

      messageElement.textContent = messages[count] ?? 'Legendary!';
      messageElement.style.display = 'block';
      if (hideTimeout) clearTimeout(hideTimeout);

      hideTimeout = setTimeout(() => {
        messageElement.classList.remove('visible');
        messageElement.textContent = '';
      }, 2000);
    },
  };
}
