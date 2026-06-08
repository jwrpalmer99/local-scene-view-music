# Local Scene View Music

A small Foundry VTT module that plays a scene's configured playlist sound locally when you view the scene, without needing to activate it.

Foundry normally starts a scene playlist when the scene is activated. This module also starts the configured scene sound when a user simply views a scene, making scene browsing and preparation feel closer to the final table experience.

## Features

- Plays the viewed scene's configured playlist sound locally.
- Does not broadcast playback changes to other users.
- Stops the previous viewed scene sound when switching to a different track.
- Keeps local preview playback continuous when multiple viewed scenes use the same sound.
- Pauses the active scene's music locally while previewing a different scene with different music.
- Can optionally pause the active scene's music while viewing scenes with no playlist sound.
- Can optionally leave the active scene's music playing while viewing other scenes.
- Resumes the active scene's music when returning to it.
- Provides client-side settings for preview volume, audio channel, active playlist pause behavior, and debug logging.

## Continuous Playback

If this module is already playing local preview music and you move between viewed scenes that use the same audio path and loop setting, the module keeps the existing sound playing instead of stopping and restarting it.

This is useful for groups of scenes that share the same background music, such as different map levels, day/night variants, or alternate views of the same location.

## Settings

Open **Configure Settings > Module Settings > Local Scene View Music**.

| Setting | Default | Description |
| --- | --- | --- |
| Volume | `0.8` | Volume used when the module plays a viewed scene sound locally. |
| Audio channel | `Music` | Foundry audio channel used for local scene-view playback. |
| Always pause active scene playlist | `false` | Pause the active scene playlist while viewing another scene, even if the viewed scene has no playlist sound. |
| Never pause active scene playlist | `false` | Keep the active scene playlist playing while viewing another scene. |
| Debug logging | `false` | Write local scene music playback decisions to the browser console. |

These settings are client-side, so each user can choose their own preview volume, channel, pause behavior, and logging preference.

If both active playlist pause settings are enabled, **Never pause active scene playlist** takes priority.

## Compatibility

- Minimum Foundry version: `13`
- Verified Foundry version: `14`

## Installation

Install the module using its manifest URL, then enable **Local Scene View Music** in your world's module list.

## Notes

- The module only affects local playback for the current user.
- Scene activation remains handled by Foundry's normal playlist behavior.
- Scenes without a configured playlist sound will stop any local view sound started by this module.
- By default, viewing a scene without a playlist sound resumes any active scene playlist that this module paused. Enable **Always pause active scene playlist** to keep the active scene playlist paused instead.
- Enable **Never pause active scene playlist** if you want active scene music to continue underneath viewed scene music.

## License

BSD-3-Clause
