// Constants and configurations
const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const BACKGROUND_HEIGHT = 2720;
const PLAYER_SPEED = 100;
const BULLET_SPEED = 300;
const ENEMY_SPAWN_DELAY = 1000;
const FIRE_DELAY = 200;
const EXPLOSION_PARTICLE_COUNT = 20;
const EXPLOSION_DURATION = 1000;

const ENEMY_TYPES = [
    { key: 'nebulaWraith', scale: 0.42, speed: 40, health: 2, shootInterval: 2500, bulletSpeed: 120, bulletColor: 0xFF8000, bulletScale: 0.6 },
    { key: 'plasmaBeetle', scale: 0.38, speed: 60, health: 1, shootInterval: 1800, bulletSpeed: 150, bulletColor: 0x00FF00, bulletScale: 0.5 },
    { key: 'voidWalker', scale: 0.25, speed: 30, health: 3, shootInterval: 3000, bulletSpeed: 100, bulletColor: 0x0000FF, bulletScale: 0.4 },
    { key: 'darkStinger', scale: 0.52, speed: 70, health: 1, shootInterval: 1500, bulletSpeed: 180, bulletColor: 0xFFFF00, bulletScale: 0.5 },
    { key: 'meteorCrusher', scale: 0.23, speed: 20, health: 4, shootInterval: 3500, bulletSpeed: 90, bulletColor: 0xFF00FF, bulletScale: 0.6 }
];

// Game state
let player, cursors, bullets, enemies, enemyBullets, score, scoreText, gameOver, backgroundSpeed, particleManager, explosions, isMobile, isTouching, touchX, touchY, isFiring, respawnButton;
let backgrounds = [];
let currentBackgroundIndex = 0;
let backgroundMusic, soundIcon, isMusicPlaying = false;
let startButton;

// Game configuration
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 } }
    }
};

// Initialize the game
const game = new Phaser.Game(config);

function preload() {
    this.load.image('background1', 'assets/background.png');
    this.load.image('background2', 'assets/background2.png');
    this.load.image('background3', 'assets/background3.png');
    this.load.image('player', 'assets/player.png');
    this.load.svg('bullet', 'assets/shoot.svg');
    this.load.svg('particle', 'assets/particle.svg');
    
    ENEMY_TYPES.forEach(enemy => {
        this.load.image(enemy.key, `assets/${enemy.key}.png`);
    });

    // Load music and sound icons
    this.load.audio('backgroundMusic', 'assets/music.mp3');
    this.load.image('soundOn', 'assets/sound-on.png');
    this.load.image('soundOff', 'assets/sound-off.png');
}

function create() {
    initializeGameState(this);
    createBackgrounds(this);
    createPlayer(this);
    createEnemies(this);
    createUI(this);
    setupCollisions(this);
    createStartButton(this);
    
    // Don't start the game loop yet
    this.physics.pause();
}

function update() {
    if (gameOver) return;

    handlePlayerMovement();
    updateBackgrounds();
    handleEnemyShooting(this);
    cleanupOffscreenObjects();
    cleanupExplosions(this);
}

// Initialization functions
function initializeGameState(scene) {
    score = 0;
    gameOver = false;
    backgroundSpeed = 2;
    explosions = [];
    isMobile = !scene.sys.game.device.os.desktop;
    isTouching = false;
    isFiring = false;
}

function createBackgrounds(scene) {
    backgrounds = [
        scene.add.tileSprite(GAME_WIDTH / 2, 0, GAME_WIDTH, BACKGROUND_HEIGHT, 'background1'),
        scene.add.tileSprite(GAME_WIDTH / 2, -BACKGROUND_HEIGHT, GAME_WIDTH, BACKGROUND_HEIGHT, 'background2'),
        scene.add.tileSprite(GAME_WIDTH / 2, -2 * BACKGROUND_HEIGHT, GAME_WIDTH, BACKGROUND_HEIGHT, 'background3')
    ];
}

function createPlayer(scene) {
    player = scene.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 60, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(0.06);
    cursors = scene.input.keyboard.createCursorKeys();
}

function createEnemies(scene) {
    bullets = scene.physics.add.group();
    enemyBullets = scene.physics.add.group();
    enemies = scene.physics.add.group();
}

function createUI(scene) {
    scoreText = scene.add.text(16, 16, 'Score: 0', { fontSize: '16px', fill: '#fff' });
    particleManager = scene.add.particles('particle');
}

function setupCollisions(scene) {
    scene.physics.add.collider(bullets, enemies, bulletHitEnemy, null, scene);
    scene.physics.add.collider(player, enemies, playerHitEnemy, null, scene);
    scene.physics.add.collider(player, enemyBullets, playerHitBullet, null, scene);
}

function createStartButton(scene) {
    startButton = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Start Game', {
        fontSize: '32px',
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive();

    startButton.on('pointerdown', () => startGame(scene));
}

function startGame(scene) {
    startButton.destroy();
    scene.physics.resume();
    setupEvents(scene);
    setupInputHandling(scene);
    setupAudioContext(scene);
    setupBackgroundMusic(scene);
    createSoundToggle(scene);
}

function setupEvents(scene) {
    scene.time.addEvent({
        delay: ENEMY_SPAWN_DELAY,
        callback: spawnEnemy,
        callbackScope: scene,
        loop: true
    });

    scene.time.addEvent({
        delay: FIRE_DELAY,
        callback: () => tryToFire(scene),
        loop: true
    });
}

function setupInputHandling(scene) {
    if (isMobile) {
        scene.input.on('pointerdown', onTouchStart, scene);
        scene.input.on('pointermove', onTouchMove, scene);
        scene.input.on('pointerup', onTouchEnd, scene);
    }
}

function setupAudioContext(scene) {
    scene.sound.once('unlocked', () => {
        console.log('Audio unlocked');
    });
}

function setupBackgroundMusic(scene) {
    backgroundMusic = scene.sound.add('backgroundMusic', { loop: true, volume: 0.5 });
    // Don't autoplay the music
}

function createSoundToggle(scene) {
    soundIcon = scene.add.image(GAME_WIDTH - 40, 40, 'soundOff')
        .setInteractive()
        .setScale(0.1);

    soundIcon.on('pointerdown', () => toggleMusic(scene));
}

// Update functions
function updateBackgrounds() {
    backgrounds.forEach(bg => {
        bg.y += backgroundSpeed;
        if (bg.y >= BACKGROUND_HEIGHT) {
            bg.y = backgrounds[(backgrounds.indexOf(bg) + 2) % 3].y - BACKGROUND_HEIGHT;
        }
    });
    currentBackgroundIndex = backgrounds.findIndex(bg => bg.y < BACKGROUND_HEIGHT && bg.y >= 0);
}

function handlePlayerMovement() {
    if (isMobile) {
        if (isTouching) {
            const deltaX = touchX - player.x;
            const deltaY = touchY - player.y;
            player.setVelocity(deltaX * 5, deltaY * 5);
        } else {
            player.setVelocity(0);
        }
    } else {
        player.setVelocity(0);
        if (cursors.left.isDown) player.setVelocityX(-PLAYER_SPEED);
        else if (cursors.right.isDown) player.setVelocityX(PLAYER_SPEED);
        if (cursors.up.isDown) player.setVelocityY(-PLAYER_SPEED);
        else if (cursors.down.isDown) player.setVelocityY(PLAYER_SPEED);

        isFiring = cursors.space.isDown;
    }
}

function handleEnemyShooting(scene) {
    enemies.children.entries.forEach((enemy) => {
        if (scene.time.now > enemy.lastFired) {
            let bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'bullet');
            bullet.setVelocityY(enemy.bulletSpeed);
            bullet.setScale(enemy.bulletScale);
            bullet.setTint(enemy.bulletColor);
            enemy.lastFired = scene.time.now + enemy.shootInterval;
        }
    });
}

function cleanupOffscreenObjects() {
    bullets.children.entries.forEach((bullet) => {
        if (bullet.y < 0) bullet.destroy();
    });
    enemyBullets.children.entries.forEach((bullet) => {
        if (bullet.y > GAME_HEIGHT) bullet.destroy();
    });
    enemies.children.entries.forEach((enemy) => {
        if (enemy.y > GAME_HEIGHT + 100) enemy.destroy();
    });
}

function cleanupExplosions(scene) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        if (scene.time.now > explosions[i].destroyTime) {
            explosions[i].emitter.stop();
            explosions.splice(i, 1);
        }
    }
}

// Gameplay functions
function tryToFire(scene) {
    if (isFiring && !gameOver) {
        let bullet = bullets.create(player.x, player.y - 20, 'bullet');
        bullet.setVelocityY(-BULLET_SPEED);
        bullet.setScale(0.4);
        bullet.setTint(0xFF0000);
    }
}

function spawnEnemy() {
    if (gameOver) return;

    const minSpacing = 50;
    const maxAttempts = 10;

    for (let attempts = 0; attempts < maxAttempts; attempts++) {
        const x = Phaser.Math.Between(25, GAME_WIDTH - 25);
        const enemyType = Phaser.Utils.Array.GetRandom(ENEMY_TYPES);
        
        if (isSpotFree(x, minSpacing)) {
            const enemy = enemies.create(x, 0, enemyType.key);
            if (!enemy.texture.key) {
                console.error(`Failed to create enemy with key: ${enemyType.key}`);
                enemy.destroy();
                return;
            }
            setupEnemy(enemy, enemyType, this);
            return;
        }
    }

    console.log(`Failed to find a free spot to spawn an enemy after ${maxAttempts} attempts`);
}

function isSpotFree(x, minSpacing) {
    return !enemies.children.entries.some(
        (existingEnemy) => Math.abs(existingEnemy.x - x) < minSpacing && existingEnemy.y < 100
    );
}

function setupEnemy(enemy, enemyType, scene) {
    enemy.setScale(enemyType.scale);
    enemy.body.setVelocityY(enemyType.speed);
    Object.assign(enemy, {
        shootInterval: enemyType.shootInterval,
        bulletSpeed: enemyType.bulletSpeed,
        bulletColor: enemyType.bulletColor,
        bulletScale: enemyType.bulletScale,
        lastFired: scene.time.now + Phaser.Math.Between(0, enemyType.shootInterval)
    });
}

function createExplosion(x, y) {
    const emitter = particleManager.createEmitter({
        x: x,
        y: y,
        speed: { min: 100, max: 200 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.4, end: 0.1 },
        blendMode: 'SCREEN',
        lifespan: 800,
        gravityY: 50
    });

    emitter.explode(EXPLOSION_PARTICLE_COUNT, x, y);

    explosions.push({
        emitter: emitter,
        destroyTime: this.time.now + EXPLOSION_DURATION
    });
}

function bulletHitEnemy(bullet, enemy) {
    bullet.destroy();
    createExplosion.call(this, enemy.x, enemy.y);
    enemy.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
}

function playerHitEnemy(player, enemy) {
    gameOver = true;
    this.physics.pause();
    player.setTint(0xff0000);
    createExplosion.call(this, player.x, player.y);
    
    respawnButton = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Respawn', { 
        fontSize: '32px', 
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();
    
    respawnButton.on('pointerdown', respawnPlayer, this);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'Game Over', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
}

function playerHitBullet(player, bullet) {
    bullet.destroy();
    playerHitEnemy.call(this, player);
}

function respawnPlayer() {
    gameOver = false;
    this.physics.resume();
    player.clearTint();
    player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 60);
    score = 0;
    scoreText.setText('Score: 0');
    respawnButton.destroy();
    
    enemies.clear(true, true);
    enemyBullets.clear(true, true);
    bullets.clear(true, true);

    this.children.getAll('type', 'Text').forEach((text) => {
        if (text.text === 'Game Over') {
            text.destroy();
        }
    });

    resetBackgrounds();
}

function resetBackgrounds() {
    backgrounds[0].y = 0;
    backgrounds[1].y = -BACKGROUND_HEIGHT;
    backgrounds[2].y = -2 * BACKGROUND_HEIGHT;
    currentBackgroundIndex = 0;
}

// Input handling for mobile
function onTouchStart(pointer) {
    isTouching = true;
    isFiring = true;
    touchX = pointer.x;
    touchY = pointer.y;
}

function onTouchMove(pointer) {
    if (isTouching) {
        touchX = pointer.x;
        touchY = pointer.y;
    }
}

function onTouchEnd() {
    isTouching = false;
    isFiring = false;
}

function toggleMusic(scene) {
    isMusicPlaying = !isMusicPlaying;
    if (isMusicPlaying) {
        backgroundMusic.play();
        soundIcon.setTexture('soundOn');
    } else {
        backgroundMusic.stop();
        soundIcon.setTexture('soundOff');
    }
}