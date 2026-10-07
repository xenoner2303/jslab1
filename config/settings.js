// ship physics parameters
export const maxSpeed = 300;
export const angleSpeed = 90; // for second in degrees
export const maxThrust = 100;
export const thrustIncrement = 20;
export const thrustDecrement = 80;
export const dragSpeed = 40;
export const maxShipHp = 5;
export const damageFromObjects = 1;
export const damageFromMiniRocket = 2;
export const shipRespawnTime = 2; // in sec
export const shipCollisionSlowMultiplier = 0.5

// ship drawing params
export const bulletWidth = 25;
export const bulletHeight = 40;
export const bulletFillStyle = '#e0a96d';
export const bulletStrokeStyle = 'black';
export const bulletLineWidth = 2;
export const bulletFrontThurstColor = 'red';
export const bulletBackThurstColor = 'blue';
export const bulletThurstMultiplier = 1.2;
export const bulletThurstLineWidth = 2;
export const bulletThurstLineCount = 3;
export const bulletAnglePower = 3;
export const gridColor = 'gray';
export const explosionTtl = 1;
export const explosionParticleCount = 16;
export const explosionParticleMinSize = 2;
export const explosionParticleMaxSize = 5;
export const explosionParticleMaxSpeed = 50;
export const explosionColors = ['#ff4500', '#ffee55'];

// setup configuration
export const step = 1 / 60;
export const gridSize = 50;

// miniRockets
export const rocketTtl = 10; // in seconds
export const miniRocketSpeed = 400;
export const miniRocketHeight = 20;
export const miniRocketWidth = 10;
export const miniRocketFillStyle = 'gray';
export const miniRocketFlameFillStyle = 'red';

// bliblies
export const blibliesCount = 5
export const maxBliblieSpeed = 50; // in seconds
export const bliblieHeight = 80;
export const bliblieWidth = 10;
export const bliblieFillStyle = 'purple';
export const bliblieEyeFillStyle = 'white';
export const bliblieStrokeStyle = 'black';
