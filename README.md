# Local Scene View Music

A small Foundry VTT module that plays a scene's configured playlist sound locally when you view the scene, without needing to activate it.

Foundry normally starts a scene playlist when the scene is activated. This module also starts the configured scene sound when a user simply views a scene, making scene browsing and preparation feel closer to the final table experience.

## Features

- Plays the viewed scene's configured playlist sound locally.
- Does not broadcast playback changes to other users.
- Stops the previous viewed scene sound when switching to a different track.
- Keeps playback continuous when multiple scenes use the same sound.
- Pauses the active scene's music locally while previewing a different scene with different music.
- Resumes the active scene's music when returning to it.
- Provides client-side settings for preview volume and audio channel.

## Continuous Playback

If you move between scenes that use the same audio path and loop setting, the module keeps the existing sound playing instead of stopping and restarting it.

This is useful for groups of scenes that share the same background music, such as different map levels, day/night variants, or alternate views of the same location.

## Settings

Open **Configure Settings > Module Settings > Local Scene View Music**.

| Setting | Default | Description |
| --- | --- | --- |
| Volume | `0.8` | Volume used when the module plays a viewed scene sound locally. |
| Audio channel | `Music` | Foundry audio channel used for local scene-view playback. |

These settings are client-side, so each user can choose their own preview volume and channel.

## Compatibility

- Minimum Foundry version: `13`
- Verified Foundry version: `14`

## Installation

Install the module using its manifest URL, then enable **Local Scene View Music** in your world's module list.

## Notes

- The module only affects local playback for the current user.
- Scene activation remains handled by Foundry's normal playlist behavior.
- Scenes without a configured playlist sound will stop any local view sound started by this module.

## License

BSD-3-Clause
