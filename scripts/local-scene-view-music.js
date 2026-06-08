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
      volume: game.settings.get(MODULE_ID, SETTINGS.volume),
      loop: soundDoc.repeat ?? true,
      context: game.audio[game.settings.get(MODULE_ID, SETTINGS.channel)]
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

  getScenePlaylist(scene) {
    const soundDoc = this.getSceneSound(scene);
    if (soundDoc?.parent?.name) return soundDoc.parent;

    const playlist = scene?.playlist;
    if (playlist?.sounds) return playlist;

    const playlistId = playlist ?? scene?._source?.playlist;
    return playlistId ? game.playlists?.get(playlistId) : null;
  },

  getPlaylistKey(playlist) {
    return playlist?.name ?? null;
  },

  scenesUseSamePlaylist(a, b) {
    const aKey = this.getPlaylistKey(this.getScenePlaylist(a));
    const bKey = this.getPlaylistKey(this.getScenePlaylist(b));

    return Boolean(aKey && bKey && aKey === bKey);
  },

  getSoundDocs(collection) {
    if (!collection) return [];

    let docs;
    if (Array.isArray(collection)) {
      docs = collection;
    } else if (Array.isArray(collection.contents)) {
      docs = collection.contents;
    } else if (typeof collection.values === "function") {
      docs = Array.from(collection.values());
    } else {
      docs = Array.from(collection);
    }

    return docs
      .map(entry => entry?.value ?? (Array.isArray(entry) ? entry[1] : entry))
      .filter(Boolean);
  },

  getPlaylistSounds(playlist) {
    return this.getSoundDocs(playlist?.sounds);
  },

  isSoundPlayingLocally(soundDoc) {
    const audio = soundDoc?.sound;
    return Boolean(soundDoc?.playing || audio?.playing);
  },

  getActiveSoundDocs(scene) {
    const playlist = this.getScenePlaylist(scene);
    const playlistPlayingSounds = this.getSoundDocs(playlist?.playingSounds).filter(soundDoc => soundDoc?.path);
    if (playlistPlayingSounds.length) return playlistPlayingSounds;

    const playingSounds = this.getPlaylistSounds(playlist).filter(soundDoc => {
      return soundDoc?.path && this.isSoundPlayingLocally(soundDoc);
    });

    if (playingSounds.length) return playingSounds;

    const sceneSound = this.getSceneSound(scene);
    return sceneSound ? [sceneSound] : [];
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
      this.local.sound = await game.audio.play(soundDoc.path, this.getLocalPlaybackOptions(soundDoc));

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
          loop: soundDoc.repeat ?? true,
          channel: soundDoc.channel || soundDoc.parent?.channel || "music",
          autoplay: true
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
    if (this.pausedActive?.sceneId === activeScene.id) return;

    const pausedSounds = [];

    for (const soundDoc of this.getActiveSoundDocs(activeScene)) {
      if (!this.pauseSoundLocally(soundDoc)) continue;
      pausedSounds.push(soundDoc);
    }

    if (!pausedSounds.length) return;

    this.pausedActive = { sceneId: activeScene.id, sounds: pausedSounds };
    this.log(
      `Paused active scene sound while viewing "${viewedScene?.name ?? "another scene"}"`,
      pausedSounds.map(soundDoc => soundDoc.path)
    );
  },

  async resumeActiveSound() {
    const paused = this.pausedActive;
    if (!paused) return;

    const activeScene = game.scenes?.active;
    this.pausedActive = null;

    if (!activeScene || activeScene.id !== paused.sceneId) return;

    const resumedSounds = [];

    for (const soundDoc of paused.sounds ?? []) {
      if (!soundDoc?.path) continue;
      if (!(await this.resumeSoundLocally(soundDoc))) continue;
      resumedSounds.push(soundDoc);
    }

    if (resumedSounds.length) {
      this.log(
        `Resumed active scene sound for "${activeScene.name}"`,
        resumedSounds.map(soundDoc => soundDoc.path)
      );
    }
  },

  async useActivePlaylistForView(scene) {
    const activeScene = game.scenes?.active;
    if (!this.scenesUseSamePlaylist(activeScene, scene)) return false;

    await this.stopLocalSound(`view changed to "${scene.name}" using active scene playlist`);
    await this.resumeActiveSound();
    this.log(`Continuing active scene playlist while viewing "${scene.name}"`, this.getScenePlaylist(scene)?.name);
    return true;
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

    if (await this.useActivePlaylistForView(scene)) return;

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
