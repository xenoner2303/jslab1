export function createInput(window) {
    let inputs = new Set(); // Set для зберігання станів клавіш - closure state
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

    return { // повертаєтсья обєкт з методом isDown
        isDown(name) {
            return inputs.has(name);
        },
        isJustPressed(name) { // просто в циклі перевіряє чи була натиснута клавіша, якщо так то видаляє її зі списку justPressedKeys ,а якщо вона затиснена, вонай й залишиться в списку inputs і буде доступна через isDown
            if(justPressedKeys.has(name)) {
                justPressedKeys.delete(name);
                return true;
            }

            return false;
        }
    };
}
