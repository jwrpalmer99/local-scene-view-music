const MODULE_ID = "local-scene-view-music";
const LOCAL_STOP_DELAY_MS = 30000;
const SETTINGS = {
  volume: "volume",
  channel: "channel",
  alwaysPauseActive: "alwaysPauseActive",
  neverPauseActive: "neverPauseActive",
  debugLogging: "debugLogging"
};

const LocalSceneViewMusic = {
  local: {
    sound: null,
    sceneId: null,
    key: null,
    stopTimeout: null
  },

  activatingSceneIds: new Set(),
  pausedActive: null,

  log(...args) {
    if (!game.settings.get(MODULE_ID, SETTINGS.debugLogging)) return;

    console.log(`${MODULE_ID} |`, ...args);
  },

  warn(...args) {
    console.warn(`${MODULE_ID} |`, ...args);
  },

  error(...args) {
    console.error(`${MODULE_ID} |`, ...args);
  },

  registerSettings() {
    game.settings.register(MODULE_ID, SETTINGS.volume, {
      name: "Volume",
      hint: "Volume used when we play sound for a viewed scene.",
      scope: "client",
      config: true,
      type: Number,
      default: 0.8,
      range: {
        min: 0,
        max: 1,
        step: 0.05
      }
    });

    game.settings.register(MODULE_ID, SETTINGS.channel, {
      name: "Audio channel",
      hint: "Audio channel for a viewed scene.",
      scope: "client",
      config: true,
      type: String,
      default: "music",
      choices: {
        music: "Music",
        environment: "Environment",
        interface: "Interface"
      }
    });

    game.settings.register(MODULE_ID, SETTINGS.alwaysPauseActive, {
      name: "Always pause active scene playlist",
      hint: "Pause the active scene playlist while viewing another scene, even if the viewed scene has no playlist sound.",
      scope: "client",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(MODULE_ID, SETTINGS.neverPauseActive, {
      name: "Never pause active scene playlist",
      hint: "Keep the active scene playlist playing while viewing another scene.",
      scope: "client",
      config: true,
      type: Boolean,
      default: false
    });

    game.settings.register(MODULE_ID, SETTINGS.debugLogging, {
      name: "Debug logging",
      hint: "Write local scene music playback decisions to the browser console.",
      scope: "client",
      config: true,
      type: Boolean,
      default: false
    });
  },

  getLocalPlaybackOptions(soundDoc) {
    return {
      src: soundDoc.path,
      volume: game.settings.get(MODULE_ID, SETTINGS.volume),
      loop: soundDoc.repeat ?? true,
      channel: game.settings.get(MODULE_ID, SETTINGS.channel)
    };
  },

  isActiveScene(scene) {
    return Boolean(
      scene && (
        scene.active ||
        game.scenes?.active?.id === scene.id ||
        this.activatingSceneIds.has(scene.id)
      )
    );
  },

  getSceneSound(scene) {
    const soundDoc = scene?.playlistSound;
    return soundDoc?.path ? soundDoc : null;
  },

  getSoundKey(soundDoc) {
    if (!soundDoc?.path) return null;

    return JSON.stringify({
      path: soundDoc.path,
      repeat: soundDoc.repeat ?? true
    });
  },

  clearDeferredLocalStop() {
    if (!this.local.stopTimeout) return;

    clearTimeout(this.local.stopTimeout);
    this.local.stopTimeout = null;
  },

  deferLocalStop(reason) {
    this.clearDeferredLocalStop();

    this.local.stopTimeout = setTimeout(() => {
      this.local.stopTimeout = null;
      this.stopLocalSound(reason);
    }, LOCAL_STOP_DELAY_MS);
  },

  async stopLocalSound(reason = "") {
    this.clearDeferredLocalStop();

    const sound = this.local.sound;
    this.local.sound = null;
    this.local.sceneId = null;
    this.local.key = null;

    if (!sound) return;

    try {
      await sound.stop();
      if (reason) this.log(`Stopped local view sound: ${reason}`);
    } catch (err) {
      this.warn("Failed to stop current local view sound", err);
    }
  },

  async playLocalSound(scene, soundDoc, soundKey) {
    try {
      this.local.sound = await foundry.audio.AudioHelper.play(
        this.getLocalPlaybackOptions(soundDoc),
        false
      );

      this.local.sceneId = scene.id;
      this.local.key = soundKey;
      this.log(`Playing local view sound for "${scene.name}"`, soundDoc.path);
    } catch (err) {
      this.error(`Failed to play local view sound for "${scene.name}"`, err);
    }
  },

  pauseSoundLocally(soundDoc) {
    const audio = soundDoc?.sound;
    if (!audio) return false;

    try {
      if (typeof audio.pause === "function") {
        audio.pause();
        return true;
      }

      if (typeof audio.stop === "function") {
        audio.stop();
        return true;
      }
    } catch (err) {
      this.warn(`Failed to pause playlist sound locally: ${soundDoc.name ?? soundDoc.path}`, err);
    }

    return false;
  },

  async resumeSoundLocally(soundDoc) {
    if (!soundDoc?.path) return false;

    try {
      const audio = soundDoc.sound;

      if (audio && typeof audio.play === "function") {
        const result = audio.play({
          volume: soundDoc.volume ?? 1,
          channel: CONST.AUDIO_CHANNELS.music,
          loop: soundDoc.repeat ?? true
        });

        if (result instanceof Promise) await result;
        return true;
      }

      await foundry.audio.AudioHelper.play(
        {
          src: soundDoc.path,
          volume: soundDoc.volume ?? 0.8,
          loop: soundDoc.repeat ?? true
        },
        false
      );

      return true;
    } catch (err) {
      this.warn(`Failed to resume playlist sound locally: ${soundDoc.name ?? soundDoc.path}`, err);
      return false;
    }
  },

  async pauseActiveSound(viewedScene) {
    if (game.settings.get(MODULE_ID, SETTINGS.neverPauseActive)) return;

    const activeScene = game.scenes?.active;
    if (!activeScene || activeScene.id === viewedScene?.id) return;

    const soundDoc = this.getSceneSound(activeScene);
    const soundKey = this.getSoundKey(soundDoc);
    if (!soundKey || this.pausedActive?.key === soundKey) return;

    if (!this.pauseSoundLocally(soundDoc)) return;

    this.pausedActive = { sceneId: activeScene.id, key: soundKey };
    this.log(`Paused active scene sound while viewing "${viewedScene?.name ?? "another scene"}"`, soundDoc.path);
  },

  async resumeActiveSound() {
    const paused = this.pausedActive;
    if (!paused) return;

    const activeScene = game.scenes?.active;
    const soundDoc = this.getSceneSound(activeScene);

    this.pausedActive = null;

    if (!activeScene || activeScene.id !== paused.sceneId || this.getSoundKey(soundDoc) !== paused.key) return;

    if (await this.resumeSoundLocally(soundDoc)) {
      this.log(`Resumed active scene sound for "${activeScene.name}"`, soundDoc.path);
    }
  },

  async handleCanvasReady(canvas) {
    this.clearDeferredLocalStop();

    const scene = canvas?.scene;
    if (!scene) return;

    if (this.isActiveScene(scene)) {
      await this.stopLocalSound("view returned to active scene");
      await this.resumeActiveSound();
      return;
    }

    if (this.local.sceneId === scene.id) return;

    const soundDoc = this.getSceneSound(scene);
    const soundKey = this.getSoundKey(soundDoc);

    if (!soundKey) {
      await this.stopLocalSound(`view changed to "${scene.name}"`);

      if (game.settings.get(MODULE_ID, SETTINGS.neverPauseActive)) {
        await this.resumeActiveSound();
      } else if (game.settings.get(MODULE_ID, SETTINGS.alwaysPauseActive)) {
        await this.pauseActiveSound(scene);
      } else {
        await this.resumeActiveSound();
      }

      this.log(`No playlist sound configured for viewed scene "${scene.name}"`);
      return;
    }

    if (this.local.sound && this.local.key === soundKey) {
      this.local.sceneId = scene.id;
      this.log(`Continuing local view sound for "${scene.name}"`, soundDoc.path);
      return;
    }

    await this.stopLocalSound(`view changed to "${scene.name}"`);

    if (game.settings.get(MODULE_ID, SETTINGS.neverPauseActive)) {
      await this.resumeActiveSound();
    } else {
      await this.pauseActiveSound(scene);
    }

    await this.playLocalSound(scene, soundDoc, soundKey);
  },

  async handleSceneBecomingActive(scene) {
    if (!scene) return;

    this.activatingSceneIds.add(scene.id);

    if (this.local.sceneId === scene.id) {
      await this.stopLocalSound(`"${scene.name}" became active`);
    }

    if (this.pausedActive?.sceneId === scene.id) {
      this.pausedActive = null;
    }
  },

  handleSceneActivationFinished(scene) {
    if (!scene) return;

    this.activatingSceneIds.delete(scene.id);

    if (this.local.sceneId === scene.id && this.isActiveScene(scene)) {
      this.stopLocalSound(`"${scene.name}" is active`);
    }
  }
};

Hooks.once("init", () => {
  LocalSceneViewMusic.registerSettings();
  LocalSceneViewMusic.log("Initializing");
});

Hooks.on("canvasReady", canvas => {
  LocalSceneViewMusic.handleCanvasReady(canvas);
});

Hooks.on("preUpdateScene", (scene, changes) => {
  if (changes?.active === true) {
    LocalSceneViewMusic.handleSceneBecomingActive(scene);
  }
});

Hooks.on("updateScene", (scene, changes) => {
  if (changes?.active === true) {
    LocalSceneViewMusic.handleSceneActivationFinished(scene);
  }
});

Hooks.on("canvasTearDown", () => {
  LocalSceneViewMusic.deferLocalStop("canvas tear down");
});
