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
const POINTS_PER_LEVEL = 250;

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
let currentLevel = 1;
let levelText;
let canSpawnEnemies = false;
let enemySpawnEvent = null;

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
    
    this.physics.pause();
}

function update() {
    if (gameOver) return;

    handlePlayerMovement();
    updateBackgrounds();
    handleEnemyShooting(this);
    cleanupOffscreenObjects();
    cleanupExplosions(this);
    checkLevelProgression(this);
}

function initializeGameState(scene) {
    score = 0;
    currentLevel = 1;
    gameOver = false;
    backgroundSpeed = 2;
    explosions = [];
    isMobile = !scene.sys.game.device.os.desktop;
    isTouching = false;
    isFiring = false;
    canSpawnEnemies = false;
}

function createBackgrounds(scene) {
    backgrounds = [
        scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'background1'),
        scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'background2'),
        scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'background3')
    ];
    backgrounds[1].setVisible(false);
    backgrounds[2].setVisible(false);
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
    levelText = scene.add.text(16, 40, 'Level: 1', { fontSize: '16px', fill: '#fff' });
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
    canSpawnEnemies = true;
    startEnemySpawning(scene);
    console.log("Game started, enemy spawning enabled");
}

function setupEvents(scene) {
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
}

function createSoundToggle(scene) {
    soundIcon = scene.add.image(GAME_WIDTH - 40, 40, 'soundOff')
        .setInteractive()
        .setScale(0.1);

    soundIcon.on('pointerdown', () => toggleMusic(scene));
}

function updateBackgrounds() {
    backgrounds[currentBackgroundIndex].tilePositionY -= backgroundSpeed;
    
    if (backgrounds[currentBackgroundIndex].tilePositionY <= -BACKGROUND_HEIGHT) {
        backgrounds[currentBackgroundIndex].tilePositionY = 0;
    }
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

function tryToFire(scene) {
    if (isFiring && !gameOver) {
        let bullet = bullets.create(player.x, player.y - 20, 'bullet');
        bullet.setVelocityY(-BULLET_SPEED);
        bullet.setScale(0.4);
        bullet.setTint(0xFF0000);
    }
}

function startEnemySpawning(scene) {
    if (enemySpawnEvent) {
        enemySpawnEvent.remove();
    }
    enemySpawnEvent = scene.time.addEvent({
        delay: ENEMY_SPAWN_DELAY,
        callback: () => spawnEnemy(scene),
        callbackScope: scene,
        loop: true
    });
    console.log("Enemy spawning event created");
}

function spawnEnemy(scene) {
    if (gameOver || !canSpawnEnemies) {
        console.log("Skipping enemy spawn: gameOver =", gameOver, "canSpawnEnemies =", canSpawnEnemies);
        return;
    }

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
            setupEnemy(enemy, enemyType, scene);
            console.log("Enemy spawned at", x);
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
    const speedMultiplier = 1 + (currentLevel - 1) * 0.5;
    enemy.setScale(enemyType.scale);
    enemy.body.setVelocityY(enemyType.speed * speedMultiplier);
    Object.assign(enemy, {
        shootInterval: enemyType.shootInterval / speedMultiplier,
        bulletSpeed: enemyType.bulletSpeed * speedMultiplier,
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
    this.physics.pause();
    canSpawnEnemies = false;
    player.clearTint();
    player.setPosition(GAME_WIDTH / 2, GAME_HEIGHT - 60);
    score = 0;
    currentLevel = 1;
    scoreText.setText('Score: 0');
    levelText.setText('Level: 1');
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

    console.log("Player respawned, pausing enemy spawning");

    setTimeout(() => {
        this.physics.resume();
        canSpawnEnemies = true;
        startEnemySpawning(this);
        console.log("Resuming enemy spawning after respawn");
    }, 2000);
}

function resetBackgrounds() {
    backgrounds.forEach((bg, index) => {
        bg.tilePositionY = 0;
        bg.setVisible(index === 0);
    });
    currentBackgroundIndex = 0;
}

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

function checkLevelProgression(scene) {
    const newLevel = Math.floor(score / POINTS_PER_LEVEL) + 1;
    if (newLevel > currentLevel) {
        currentLevel = newLevel;
        levelUp(scene);
    }
}

function levelUp(scene) {
    canSpawnEnemies = false;
    scene.physics.pause();

    enemies.clear(true, true);
    enemyBullets.clear(true, true);
    bullets.clear(true, true);

    const levelUpText = scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `Level ${currentLevel}`, {
        fontSize: '64px',
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 20, y: 10 }
    }).setOrigin(0.5);

    levelText.setText(`Level: ${currentLevel}`);
    changeBackground(scene);

    console.log("Level up, pausing enemy spawning");

    setTimeout(() => {
        levelUpText.destroy();
        scene.physics.resume();
        
        setTimeout(() => {
            canSpawnEnemies = true;
            startEnemySpawning(scene);
            console.log("Resuming enemy spawning after level up");
        }, 1000);
    }, 2000);
}

function changeBackground(scene) {
    backgrounds[currentBackgroundIndex].setVisible(false);
    currentBackgroundIndex = (currentBackgroundIndex + 1) % backgrounds.length;
    backgrounds[currentBackgroundIndex].setVisible(true);
    backgrounds[currentBackgroundIndex].tilePositionY = 0;
}

// Export any necessary functions or variables if needed
// export { game };