# QiliChess mobile workspace

One Expo SDK 57 monorepo builds two separately published applications:

- `apps/qilichess`: QiliChess with the adult visual system, play, time controls, learning, review and profile.
- `apps/qilichesskids`: the same complete Qili product in the gamified Kids visual system, with the interactive 26-lesson Kids curriculum in its learning area.

Both apps use one shared native product shell, one API client, the existing Xiangqi rules engine and the existing curriculum. The apps share behavior and data while injecting different presentation and learning experiences; there is no WebView and no duplicated rules implementation.

The signed-out entry is a product welcome screen. A board is shown only after the user enters the product, opens Play, and chooses Computer or Online.

## Run locally

```bash
cd mobile
npm install
npm run start:qilichess
# or
npm run start:kids
```

Use `i` for iOS Simulator or `a` for an Android emulator in the Expo terminal. Direct commands are also available as `npm run ios:qilichess`, `npm run ios:kids`, `npm run android:qilichess`, and `npm run android:kids`.

## Validate

```bash
cd mobile
npm run check
```

App Store and Google Play signing, final icons, privacy disclosures and EAS project IDs remain release-owner inputs. Temporary identifiers are documented in `docs/release-config.md`.
