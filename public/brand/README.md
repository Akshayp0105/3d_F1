# Brand assets — request list for Red Bull's brand team

Drop the **official** files here, using the filenames below. The code reads `manifest.json`.
A missing file renders a grey placeholder plate, so nothing breaks while assets are pending.

Format: SVG preferred. Otherwise PNG with transparent background, at least 4096 px on the long edge.

| Slot id | File | What it is | Where it goes on the car |
|---|---|---|---|
| `rb-wordmark` | `redbull-wordmark.svg` | "Red Bull" wordmark (red) | Front-wing upper element, rear-wing endplates, nose top |
| `rb-bulls` | `redbull-bulls-sun.svg` | Charging bulls + sun disc | Engine cover, floor emblem |
| `rb-bull-single` | `redbull-bull-single.svg` | Single charging bull | Sidepod / engine cover flank |
| `rbr-team-logo` | `rbr-team-logo.svg` | Red Bull Racing team logo | Cockpit surround, UI header |
| `car-number` | `car-number.svg` | Car number artwork | Nose tip, engine cover |
| `helmet` | `helmet-livery.png` | Driver helmet artwork (equirect / wrap) | Driver helmet |
| `sponsor-*` | `sponsor-<name>.svg` | One file per approved sponsor | Per `src/config/decals.ts` |

Also needed (not files):
- Official livery color values (matte navy, red, yellow) from the brand guidelines.
- The list of sponsor marks approved for this event build.
- Typeface licence / files if the UI should use Red Bull's brand font.
