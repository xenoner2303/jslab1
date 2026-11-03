export type Input = {
  isDown(name: string): boolean;
  isJustPressed(name: string): boolean;
  clearJustPressed(): void;
};

export function createInput(target: Window): Input {
  const inputs = new Set<string>();
  const justPressedKeys = new Set<string>();

  target.addEventListener('keydown', (event) => {
    if (!inputs.has(event.code) && !event.repeat) {
      inputs.add(event.code);
      justPressedKeys.add(event.code);
    }
  });

  target.addEventListener('keyup', (event) => {
    inputs.delete(event.code);
  });

  return {
    isDown(name) {
      return inputs.has(name);
    },
    isJustPressed(name) {
      if (!justPressedKeys.has(name)) return false;
      justPressedKeys.delete(name);
      return true;
    },
    clearJustPressed() {
      justPressedKeys.clear();
    },
  };
}
