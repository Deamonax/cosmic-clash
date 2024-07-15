// Global variables
let player;
let cursors;
let bullets;
let enemies;
let enemyBullets;
let score = 0;
let scoreText;
let gameOver = false;
let backgroundSpeed = 2;
let particleManager;
let explosions = [];
let isMobile = false;
let isTouching = false;
let touchX, touchY;
let isFiring = false;
let respawnButton;

let backgrounds = [];
let currentBackgroundIndex = 0;
let backgroundHeight = 2720; // Assuming each background is 1920 pixels tall (twice the screen height)

const enemyTypes = [
    { key: 'nebulaWraith', scale: 0.42, speed: 40, health: 2, shootInterval: 2500, bulletSpeed: 120, bulletColor: 0xFF8000, bulletScale: 0.6 },
    { key: 'plasmaBeetle', scale: 0.38, speed: 60, health: 1, shootInterval: 1800, bulletSpeed: 150, bulletColor: 0x00FF00, bulletScale: 0.5 },
    { key: 'voidWalker', scale: 0.25, speed: 30, health: 3, shootInterval: 3000, bulletSpeed: 100, bulletColor: 0x0000FF, bulletScale: 0.4 },
    { key: 'darkStinger', scale: 0.52, speed: 70, health: 1, shootInterval: 1500, bulletSpeed: 180, bulletColor: 0xFFFF00, bulletScale: 0.5 },
    { key: 'meteorCrusher', scale: 0.23, speed: 20, health: 4, shootInterval: 3500, bulletSpeed: 90, bulletColor: 0xFF00FF, bulletScale: 0.6 }
];

// Game configuration
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 540,
        height: 960
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    }
};

// Initialize the game
const game = new Phaser.Game(config);

function preload() {
    console.log("Preload function started");
    this.load.image('background1', 'assets/background.png');
    this.load.image('background2', 'assets/background2.png');
    this.load.image('background3', 'assets/background3.png');
    this.load.image('player', 'assets/player.png');
    this.load.svg('bullet', 'assets/shoot.svg');
    this.load.svg('particle', 'assets/particle.svg');
    
    enemyTypes.forEach(enemy => {
        const fileName = `assets/${enemy.key}.png`; 
        this.load.image(enemy.key, fileName);
        console.log(`Attempting to load PNG: ${fileName}`);
    });
}

function create() {
    console.log("Create function started");
    
    // Create all three backgrounds
    backgrounds = [
        this.add.tileSprite(270, 0, 540, backgroundHeight, 'background1'),
        this.add.tileSprite(270, -backgroundHeight, 540, backgroundHeight, 'background2'),
        this.add.tileSprite(270, -2 * backgroundHeight, 540, backgroundHeight, 'background3')
    ];

    player = this.physics.add.sprite(270, 900, 'player');
    player.setCollideWorldBounds(true);
    player.setScale(0.06);

    cursors = this.input.keyboard.createCursorKeys();

    bullets = this.physics.add.group();
    enemyBullets = this.physics.add.group();
    enemies = this.physics.add.group();

    scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '16px', fill: '#fff' });

    this.physics.add.collider(bullets, enemies, bulletHitEnemy, null, this);
    this.physics.add.collider(player, enemies, playerHitEnemy, null, this);
    this.physics.add.collider(player, enemyBullets, playerHitBullet, null, this);

    this.time.addEvent({
        delay: 1000,
        callback: spawnEnemy,
        callbackScope: this,
        loop: true
    });

    particleManager = this.add.particles('particle');

    // Check if the game is running on a mobile device
    isMobile = !this.sys.game.device.os.desktop;

    if (isMobile) {
        // Add touch events for moving the player and firing
        this.input.on('pointerdown', onTouchStart, this);
        this.input.on('pointermove', onTouchMove, this);
        this.input.on('pointerup', onTouchEnd, this);
    }

    // Continuous firing event
    this.time.addEvent({
        delay: 200,
        callback: tryToFire,
        callbackScope: this,
        loop: true
    });

    // Check if all textures loaded correctly
    ['bullet', 'particle', ...enemyTypes.map(e => e.key)].forEach(key => {
        if (this.textures.exists(key)) {
            console.log(`Texture for ${key} loaded successfully`);
        } else {
            console.error(`Failed to load texture for ${key}`);
        }
    });
}

function update() {
    if (gameOver) return;

    // Move all backgrounds down
    backgrounds.forEach(bg => {
        bg.y += backgroundSpeed;
    });

    // Check if we need to transition to the next background
    if (backgrounds[currentBackgroundIndex].y >= backgroundHeight) {
        // Move the current background to the end
        backgrounds[currentBackgroundIndex].y = backgrounds[(currentBackgroundIndex + 2) % 3].y - backgroundHeight;
        
        // Update the current background index
        currentBackgroundIndex = (currentBackgroundIndex + 1) % 3;
    }

    if (isMobile) {
        // Mobile controls
        if (isTouching) {
            const deltaX = touchX - player.x;
            const deltaY = touchY - player.y;
            player.setVelocity(deltaX * 5, deltaY * 5);
        } else {
            player.setVelocity(0);
        }
    } else {
        // Desktop controls
        player.setVelocity(0);
        if (cursors.left.isDown) {
            player.setVelocityX(-100);
        } else if (cursors.right.isDown) {
            player.setVelocityX(100);
        }
        if (cursors.up.isDown) {
            player.setVelocityY(-100);
        } else if (cursors.down.isDown) {
            player.setVelocityY(100);
        }

        if (cursors.space.isDown) {
            isFiring = true;
        } else {
            isFiring = false;
        }
    }

    enemies.children.entries.forEach((enemy) => {
        if (this.time.now > enemy.lastFired) {
            let bullet = enemyBullets.create(enemy.x, enemy.y + 20, 'bullet');
            bullet.setVelocityY(enemy.bulletSpeed);
            bullet.setScale(enemy.bulletScale);
            bullet.setTint(enemy.bulletColor);
            enemy.lastFired = this.time.now + enemy.shootInterval;
        }
    });

    // Explosion cleanup
    for (let i = explosions.length - 1; i >= 0; i--) {
        if (this.time.now > explosions[i].destroyTime) {
            explosions[i].emitter.stop();
            explosions.splice(i, 1);
        }
    }

    bullets.children.entries.forEach((bullet) => {
        if (bullet.y < 0) bullet.destroy();
    });
    enemyBullets.children.entries.forEach((bullet) => {
        if (bullet.y > 960) bullet.destroy();
    });

    // Remove enemies that have gone far off-screen
    enemies.children.entries.forEach((enemy) => {
        if (enemy.y > 1060) {
            enemy.destroy();
        }
    });
}

function tryToFire() {
    if (isFiring && !gameOver) {
        let bullet = bullets.create(player.x, player.y - 20, 'bullet');
        bullet.setVelocityY(-300);
        bullet.setScale(0.4);
        bullet.setTint(0xFF0000);
    }
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

function spawnEnemy() {
    if (gameOver) return;

    const minSpacing = 50; // Minimum spacing between enemies
    let attempts = 0;
    const maxAttempts = 10; // Maximum number of attempts to find a free spot

    while (attempts < maxAttempts) {
        const x = Phaser.Math.Between(25, 515);
        const enemyType = Phaser.Utils.Array.GetRandom(enemyTypes);
        
        // Check if the spot is free
        let spotIsFree = true;
        enemies.children.entries.forEach((existingEnemy) => {
            if (Math.abs(existingEnemy.x - x) < minSpacing && existingEnemy.y < 100) {
                spotIsFree = false;
            }
        });

        if (spotIsFree) {
            console.log(`Attempting to spawn enemy: ${enemyType.key}`);
            const enemy = enemies.create(x, 0, enemyType.key);
            if (!enemy.texture.key) {
                console.error(`Failed to create enemy with key: ${enemyType.key}`);
                enemy.destroy();
                return;
            }
            console.log(`Successfully spawned enemy: ${enemyType.key}`);
            enemy.setScale(enemyType.scale);
            enemy.body.setVelocityY(enemyType.speed);
            enemy.shootInterval = enemyType.shootInterval;
            enemy.bulletSpeed = enemyType.bulletSpeed;
            enemy.bulletColor = enemyType.bulletColor;
            enemy.bulletScale = enemyType.bulletScale;
            enemy.lastFired = this.time.now + Phaser.Math.Between(0, enemyType.shootInterval);
            return; // Successfully spawned an enemy, exit the function
        }

        attempts++;
    }

    console.log("Failed to find a free spot to spawn an enemy after " + maxAttempts + " attempts");
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

    emitter.explode(20, x, y);

    explosions.push({
        emitter: emitter,
        destroyTime: this.time.now + 1000 // Destroy after 1 second
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
    
    // Create respawn button
    respawnButton = this.add.text(270, 540, 'Respawn', { 
        fontSize: '32px', 
        fill: '#fff',
        backgroundColor: '#000',
        padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();
    
    respawnButton.on('pointerdown', respawnPlayer, this);

    this.add.text(270, 480, 'Game Over', { fontSize: '32px', fill: '#fff' }).setOrigin(0.5);
}

function playerHitBullet(player, bullet) {
    bullet.destroy();
    playerHitEnemy.call(this, player);
}

function respawnPlayer() {
    gameOver = false;
    this.physics.resume();
    player.clearTint();
    player.setPosition(270, 900);
    score = 0;
    scoreText.setText('Score: 0');
    respawnButton.destroy();
    
    // Clear all existing enemies and bullets
    enemies.clear(true, true);
    enemyBullets.clear(true, true);
    bullets.clear(true, true);

    // Remove 'Game Over' text
    this.children.getAll('type', 'Text').forEach((text) => {
        if (text.text === 'Game Over') {
            text.destroy();
        }
    });

    // Reset backgrounds
    backgrounds[0].y = 0;
    backgrounds[1].y = -backgroundHeight;
    backgrounds[2].y = -2 * backgroundHeight;
    currentBackgroundIndex = 0;
}