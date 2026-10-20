## Composition

There are three ways to add extra properties and behaviors to objects:

- **1) Inheritance** — inheriting behavior from a parent class.
- **2) Mixins** — adding new functions and properties to an object or prototype using `Object.assign`.
- **3) Behavior-as-data** — storing behavior functions in an object's fields.

Inheritance has one major disadvantage: it can be inflexible. When we need to combine different behaviors, we may have to create additional classes.
Mixins are more flexible because they allow us to combine different behaviors. However, the code must know the function names and how to call them. It also depends on whether these functions were added to the object.
I chose behavior-as-data because it allows us to combine behaviors and call them through an anonymous shared loop. In my project, behaviors are stored in the `behaviors` array.
This means I can dynamically add a new behavior to a `MiniRocket` in `World` using the `behavior(this, dt, context)` pattern. I do not need to write a separate function call because `Entity.update()` already calls all behaviors in a loop.

## Pickup

I implemented `Pickup` as a separate class that extends `Entity` and stores the name of the effect. This allows me to move the effect handling logic into the external `step()` method in `World`.
I did not implement the pickup as a behavior because it is not an active behavior. Instead, it is an object property that is processed when a collision occurs.
