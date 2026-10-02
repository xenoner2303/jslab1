export function createInput(window) {
    let inputs = new Set(); // Set for key states - closure
    let justPressedKeys = new Set(); // clicked keys

    window.addEventListener('keydown', (event) => {
        if(!inputs.has(event.code) && event.repeat === false) {
            inputs.add(event.code);
            justPressedKeys.add(event.code);
        }
    });
    
    window.addEventListener('keyup', (event) => {
        inputs.delete(event.code);
    });

    return {
        isDown(name) {
            return inputs.has(name);
        },
        isJustPressed(name) {
            if(justPressedKeys.has(name)) {
                justPressedKeys.delete(name);
                return true;
            }

            return false;
        },
        clearJustPressed() {
            justPressedKeys.clear();
        }
    };
}
