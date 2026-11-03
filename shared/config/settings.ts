// ship physics parameters
export const maxSpeed = 300 as const;
export const angleSpeed = 90 as const; // for second in degrees
export const maxThrust = 100 as const;
export const thrustIncrement = 20 as const;
export const thrustDecrement = 80 as const;
export const dragSpeed = 40 as const;
export const maxShipHp = 1 as const;
export const damageFromObjects = 1 as const;
export const damageFromMiniRocket = 2 as const;
export const shipRespawnTime = 2 as const; // in sec

// ship drawing params
export const shipWidth = 50 as const;
export const shipHeight = 80 as const;
export const shipFrontThurstColor = 'red' as const;
export const shipBackThurstColor = 'blue' as const;
export const shipThurstMultiplier = 1.2 as const;
export const shipThurstLineWidth = 2 as const;
export const shipThurstLineCount = 3 as const;
export const shipAnglePower = 3 as const;
export const gridColor = 'gray' as const;
export const explosionTtl = 1 as const;
export const explosionParticleCount = 16 as const;
export const explosionParticleMinSize = 2 as const;
export const explosionParticleMaxSize = 5 as const;
export const explosionParticleMaxSpeed = 50 as const;
export const explosionColors = ['#ff4500', '#ffee55'] as const;

// setup configuration
export const simulationTickRate = 30 as const;
export const step = 1 / simulationTickRate;
export const gridSize = 50 as const;
export const arenaWidth = 1200 as const;
export const arenaHeight = 800 as const;

// miniRockets
export const rocketTtl = 10 as const; // in seconds
export const miniRocketSpeed = 400 as const;
export const miniRocketHeight = 20 as const;
export const miniRocketWidth = 10 as const;
export const miniRocketFillStyle = 'gray' as const;
export const miniRocketFlameFillStyle = 'red' as const;

// bliblies
export const blibliesCount = 5 as const;
export const maxBliblieSpeed = 50 as const; // in seconds
export const bliblieHeight = 80 as const;
export const bliblieWidth = 60 as const;
export const bliblieScreamTimer = 5 as const;

// homing
export const homingDirectionChangeMultiplier = 0.1 as const;

// pickup
export const barrierShieldAdditionalRadius = 4 as const;
export const barrierShieldStrokeStyle = 'blue' as const;
export const barrierShieldLineWidth = 4 as const;
export const pickupItemsCount = 2 as const;
export const shieldWidth = 40 as const;
export const shieldHeight = 60 as const;

// lobby
export const lobbyRefresh = 5000 as const;
