function initHud() {
  const scoreE = document.querySelector('#score');
  const stepsE = document.querySelector('#steps');
  const fpsE = document.querySelector('#fps');
  const frameTimeE = document.querySelector('#frameTime');
  const msgE = document.getElementById('kill-msg');

  let hideTimeout = null;

  return {
    update(stats, score) {
      if (scoreE) scoreE.textContent = `Score: ${score} bliblies`;
      if (stepsE) stepsE.textContent = `Steps: ${stats.sps}`;
      if (fpsE) fpsE.textContent = `FPS: ${stats.fps.toFixed(2)}`;
      if (frameTimeE)
        frameTimeE.textContent = `Frame Time: ${stats.frameTime.toFixed(2)} ms`;
    },
    showKillMessage(count) {
      if (count < 2) return;
      const messages = {
        2: 'Double Kill!',
        3: 'Triple Kill!',
        4: 'Quadra Kill!',
        5: 'Penta Kill!',
      };

      msgE.textContent = messages[count] ?? 'Legendary!';
      msgE.style.display = 'block';

      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      hideTimeout = setTimeout(() => {
        msgE.classList.remove('visible');
        msgE.textContent = '';
      }, 2000);
    },
  };
}

export { initHud };
