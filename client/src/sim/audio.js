function initAudio(audioCtx, assets) {
  function playSound(soundId) {
    // closure
    if (!audioCtx || !assets[soundId]) return;

    const source = audioCtx.createBufferSource(); // audio source from decoded byte array
    source.buffer = assets[soundId];
    source.connect(audioCtx.destination);
    source.start(0);
  }

  return {
    playShoot() {
      playSound('shootRocket');
    },
    playExplosion() {
      playSound('explosion');
    },
    playHit(type) {
      if (type == 'bliblie') playSound('bliblieDie');
    },
    playEnvironmentSound(type) {
      if (type == 'bliblie') {
        const rand = Math.floor(Math.random() * 2) + 1;

        if (rand == 1) {
          playSound('bliblieSounds1');
        } else if (rand == 2) {
          playSound('bliblieSounds2');
        }
      }
    },
    playKillJoke(count, type) {
      if (type == 'bliblie') {
        if (count == 2) playSound('doubleKill');
        if (count == 3) playSound('tripleKill');
        if (count == 4) playSound('quadraKill');
        if (count == 5) playSound('pentaKill');
        if (count > 5) playSound('legendaryKill');
      }
    },
  };
}

export { initAudio };
