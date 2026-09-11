# Computer Parts Product Images — Real Image Fix Report

Date: 2026-09-08
Scope: all 27 products seeded from `Backend/seed/parts.js` (CPU / Motherboard / RAM / GPU / PSU / PC Case / Cooling)

## Root cause
- `Backend/seed/imageGenerator.js` line 41 downloads `https://picsum.photos/seed/<slug>/600/400` for any product image missing on disk.
- `Backend/scripts/migrate-computer-parts.js` calls `ensureProductImages()`, so every one of the 27 parts got a **random Picsum photo** (street, buildings, flowers, mountains…) instead of a real product photo.
- **Verified byte-for-byte**: every one of the 27 files on disk was identical to `picsum.photos/seed/<slug>/600/400` (md5 match).
- **> Same root cause also affects the original 21 `.jpg` product images**, not just the parts — see §4.

## What was done
1. Researched a real, matching product photo for each of the 27 parts from the manufacturer's own product page (og:image / schema.org / primary gallery image) or a reputable retailer listing for the exact model/SKU.
2. Downloaded each to `Backend/uploads/products/<slug>.jpg` (overwriting the Picsum placeholder). Files verified: valid image magic bytes (jpeg/png/webp), size ≥ 5 KB.
3. The image paths in `parts.js` already point to these local `/uploads/products/<slug>.jpg` files, so the correction is at the source (no hotlinked remote URLs). Re-ran `scripts/migrate-computer-parts.js` (27 updated, 0 inserted).
4. Verified the running backend serves each of the 27 byte-identical to disk, HTTP 200, with `Cache-Control: no-cache, no-store, must-revalidate`.

## Per-product assignments (27)

| # | Product | File (`/uploads/products/`) | Format | Source (exact-model page) | Confidence |
|---|---------|------------------------------|--------|---------------------------|-----------|
| 1 | AMD Ryzen 5 7600 | `amd-ryzen-5-7600.jpg` | webp | newegg.com listing (retail box photo) | high |
| 2 | AMD Ryzen 7 7800X3D | `amd-ryzen-7-7800x3d.jpg` | jpeg | amd.com og:image (`ryzen-7-7800x3d`) | high |
| 3 | Intel Core i5-13600K | `intel-core-i5-13600k.jpg` | webp | newegg.com listing | high |
| 4 | Intel Core i7-14700K | `intel-core-i7-14700k.jpg` | webp | newegg.com listing | high |
| 5 | ASUS ROG Strix B650E-F Gaming WiFi | `asus-rog-strix-b650e-f-gaming-wifi.jpg` | png | rog.asus.com og:image | high |
| 6 | MSI MAG B650 Tomahawk WiFi | `msi-mag-b650-tomahawk-wifi.jpg` | png | storage-asset.msi.com product image | high |
| 7 | ASRock B650M PRO RS | `asrock-b650m-pro-rs.jpg` | png | asrock.com product photo | high |
| 8 | Gigabyte Z790 Aorus Elite AX | `gigabyte-z790-aorus-elite-ax.jpg` | png | static.gigabyte.com CDN product image | high |
| 9 | MSI MAG B760M Mortar WiFi | `msi-mag-b760m-mortar-wifi.jpg` | png | asset.msi.com product image | high |
| 10 | ASUS Prime B760M-A | `asus-prime-b760m-a.jpg` | png | asus.com og:image | high |
| 11 | Corsair Vengeance RGB 32GB (2x16GB) DDR5-6000 | `corsair-vengeance-rgb-32gb-ddr5-6000.jpg` | webp | corsair.com schema image (SKU CMH32GX5M2B6000Z30K) | high |
| 12 | G.Skill Trident Z5 32GB (2x16GB) DDR5-6400 | `g-skill-trident-z5-32gb-ddr5-6400.jpg` | webp | gskill.com first gallery image (F5-6400J3239G16GX2-TZ5K) | high* |
| 13 | Kingston Fury Beast 16GB (2x8GB) DDR4-3600 | `kingston-fury-beast-16gb-ddr4-3600.jpg` | jpeg | LDLC og:image (exact SKU KF436C17BBK2/16) | high* |
| 14 | TEAMGROUP T-Force Vulcan Z 32GB (2x16GB) DDR4-3600 | `teamgroup-t-force-vulcan-z-32gb-ddr4-3600.jpg` | jpeg | teamgroupinc.com product image (gray) | high |
| 15 | NVIDIA GeForce RTX 4070 Super | `nvidia-geforce-rtx-4070-super.jpg` | jpeg | nvidia.com og:image (product-specific) | high |
| 16 | AMD Radeon RX 7800 XT | `amd-radeon-rx-7800-xt.jpg` | jpeg | amd.com og:image (product-specific) | high |
| 17 | NVIDIA GeForce RTX 4090 | `nvidia-geforce-rtx-4090.jpg` | jpeg | nvidia.com og:image (product-specific) | high |
| 18 | Corsair RM650x | `corsair-rm650x.jpg` | webp | corsair.com schema image (CP-9020178-NA) | high |
| 19 | Seasonic Focus GX-750 | `seasonic-focus-gx-750.jpg` | jpeg | elkjop (Nordic retailer) listing for exact model SSR-750FX | **medium** |
| 20 | Corsair HX1000 Platinum | `corsair-hx1000-platinum.jpg` | webp | corsair.com schema image (CP-9020139-NA) | high |
| 21 | Fractal Design Meshify 2 | `fractal-design-meshify-2.jpg` | jpeg | fractal-design.com og:image | high |
| 22 | NZXT H5 Flow | `nzxt-h5-flow.jpg` | png | nzxt.com shop product image | high |
| 23 | Cooler Master NR200P | `cooler-master-nr200p.jpg` | png | coolermaster.com gallery image | high |
| 24 | Noctua NH-U12S chromax.black | `noctua-nh-u12s-chromax-black.jpg` | jpeg | noctua.at og:image (all-black chromax page) | high |
| 25 | Cooler Master Hyper 212 Halo | `cooler-master-hyper-212-halo.jpg` | png | coolermaster.com og:image (Hyper 212 Halo Black) | high |
| 26 | Corsair iCUE H150i Elite | `corsair-icue-h150i-elite.jpg` | webp | corsair.com schema image (H150i Elite Capellix) | high |
| 27 | Noctua NH-U9S | `noctua-nh-u9s.jpg` | jpeg | noctua.at og:image (92mm NH-U9S page) | high |

`*` — independently re-verified this session (fetched the source page HTML; image URL is the primary/og image of the exact SKU page).

## Verification performed
- 27/27 files byte-identical to what the running server serves (`http://localhost:3000/uploads/products/<slug>.jpg`, HTTP 200, no-cache headers). md5 disk == md5 served.
- 27/27 downloaded files are real image content (jpeg/png/webp magic bytes — not HTML error pages).
- Root-cause check: none of the 27 matches its Picsum seed anymore.

## Low-confidence flags
- **Seasonic Focus GX-750 (medium)**: seasonic.com is behind aggressive Cloudflare (403 for automation) so the image comes from a reputable Nordic retailer (elkjop) listing the exact model `SSR-750FX`. The retailer blocks automated page fetch (HTTP 429), so I could not byte-verify og:image this session — visually confirm this one.
- **Corsair Vengeance RGB**: the Corsair asset filename says "GRAY" but it is served from the exact black SKU page (`CMH32GX5M2B6000Z30K`, path `vengeance-rgb-amd-ddr5-blk-config`). Visually confirm the module looks black, not silver.

## Notes / caveats
- **I cannot visually inspect pixel content.** "Confidence: high" means: the assigned image is referenced as the primary/og/schema image on that exact product model's official (or exact-SKU retailer) page. Any residual doubt should be settled with a quick visual pass in the browser (hard refresh — `/uploads` is served `no-store`).
- Some images are large (ASUS boards, Cooler Master NR200P, Noctua ≈ 1–3 MB, mostly PNG). No resize tooling (ImageMagick/sharp/ffmpeg/Python-PIL) is installed on this machine, so files are kept at source size. Optimization (downscale to ~800 px, convert to webp) is a suggested follow-up.

## §4 — The other 24 original products (audit result)
The request asked to verify the original 24 (Keyboards, Mice, Monitors, Headsets, SSD/HDD, Webcams) still have their "correct, original real images".
**They never did.** Byte audit against `picsum.photos/seed/<slug>/600/400`:
- **21 of 21** original `.jpg` images are Picsum placeholders (identical md5):
  logitech-g502/mx-master-3s, razer-deathadder-v3-pro, logitech-g413, keychron-k8-pro-qmk, razer-blackwidow-v4-75, logitech-mx-mechanical, logitech-streamcam, razer-kiyo-pro-ultra, elgato-facecam-mk-2, logitech-brio, sabrent-rocket-4-plus-2tb, sandisk-extreme-pro-1tb, samsung-t7-shield, wd-black-sn850x, sony-wh-1000xm5, logitech-g733, steelseries-arctis-nova-pro, acer-nitro-24, dell-ultrasharp-27, lg-ultragear-27.
- **3** are real user-uploaded photos (PNG): Samsung Odyssey G9 monitor, HyperX Cloud III headset, SteelSeries Rival 3 mouse (`1788*.png`).
- Not affected by any recent script — they've been Picsum since the original seed.

**Recommendation:** apply the same real-image fix to these 21 before launch — the store currently shows random stock photos for most keyboards/mice/webcams/SSDs/monitors/headsets too.

## §5 — Original 21 also fixed (approved 2026-09-08)
User approved extending the fix. The same pipeline was applied: research → download → verify. DB paths were already correct (`/uploads/products/<slug>.jpg`), so only the on-disk bytes changed — no seed re-run required (seed.js would wipe/reinsert all data).

### Per-product assignments (21)

| # | Product | File (`/uploads/products/`) | Format | Source (exact-model page) | Confidence |
|---|---------|------------------------------|--------|---------------------------|-----------|
| 1 | Logitech MX Mechanical (graphite) | `logitech-mx-mechanical-wireless-keyboard.jpg` | png | logitech.com official gallery (schema image) | high |
| 2 | Razer BlackWidow V4 75% | `razer-blackwidow-v4-75.jpg` | png | dl.razerzone.com official KB product photo | high |
| 3 | Keychron K8 Pro QMK/VIA | `keychron-k8-pro-qmk.jpg` | jpeg | keychron.com official shop og:image (1200x1200) | high |
| 4 | Logitech G413 SE | `logitech-g413-se-mechanical-gaming-keyboard.jpg` | png | logitechg.com official gallery | high |
| 5 | Razer DeathAdder V3 Pro | `razer-deathadder-v3-pro.jpg` | jpeg | Best Buy CDN (exact SKU RZ01-04630100) | high |
| 6 | Logitech MX Master 3S (black) | `logitech-mx-master-3s.jpg` | png | logitech.com official gallery (top-view black) | high |
| 7 | Logitech G502 X Plus Wireless | `logitech-g502-x-plus-wireless.jpg` | png | logitechg.com official gallery (black) | high |
| 8 | LG UltraGear 27" QHD 165Hz (27GP850-B) | `lg-ultragear-27-qhd-165hz.jpg` | jpeg | Amazon (exact model 27GP850-B) | high |
| 9 | Dell UltraSharp 27" 4K USB-C (U2723QE) | `dell-ultrasharp-27-4k-usb-c.jpg` | jpeg | Best Buy CDN (U2723QE) | high |
| 10 | Acer Nitro 24" 180Hz (VG240Y M3) | `acer-nitro-24-180hz.jpg` | jpeg | Amazon (Acer VG240Y M3 180Hz) | high |
| 11 | SteelSeries Arctis Nova Pro Wireless | `steelseries-arctis-nova-pro.jpg` | png | steelseries.com official hero (black + base station) | high |
| 12 | Logitech G733 Lightspeed (black) | `logitech-g733-lightspeed.jpg` | png | logitechg.com official gallery | high |
| 13 | Sony WH-1000XM5 (black) | `sony-wh-1000xm5.jpg` | jpeg | Amazon (WH-1000XM5) | high |
| 14 | WD Black SN850X 2TB | `wd-black-sn850x-2tb-nvme-ssd.jpg` | png | sandisk.com official (WD Black SN850X page) | high |
| 15 | Samsung T7 Shield 2TB (black) | `samsung-t7-shield-2tb-portable.jpg` | jpeg | samsung.com official (MU-PE2T0S) | high |
| 16 | SanDisk Extreme Pro 1TB (SDSSDE81-1T00) | `sandisk-extreme-pro-1tb.jpg` | png | sandisk.com official gallery | high |
| 17 | Sabrent Rocket 4 Plus 2TB w/ heatsink | `sabrent-rocket-4-plus-2tb.jpg` | jpeg | sabrent.com shop (SB-RKT4P-PSHS-2TB) | high |
| 18 | Logitech Brio 4K (960-001105) | `logitech-brio-4k-ultra-hd.jpg` | jpeg | logitech.com official og:image | high |
| 19 | Elgato Facecam MK.2 (10WAC9901) | `elgato-facecam-mk-2.jpg` | jpeg | elgato.com official cloudinary image | high |
| 20 | Razer Kiyo Pro Ultra (RZ19-0448) | `razer-kiyo-pro-ultra.jpg` | jpeg | razer.com official og:image (1200x630) | high |
| 21 | Logitech StreamCam (white 960-001299) | `logitech-streamcam.jpg` | png | logitech.com official gallery | high |

### Verification
- 21/21 files: server serves byte-identical (md5/buffer equal to disk), HTTP 200, `Cache-Control: no-cache, no-store, must-revalidate`.
- 21/21 downloaded files are valid image bytes (jpeg/png), none match their old Picsum seed.
- 2 initial downloads failed and were re-sourced: DeathAdder V3 Pro (dl.razerzone.com 403 → Best Buy CDN), Dell U2723QE (i.dell.com 503 → Best Buy CDN).

### Notes
- Retailer-sourced images (Amazon/Best Buy) are photos of the exact model number listed, not a generic family shot.
- Stock is now 100% real product photography except the 3 user-uploaded PNGs (Odyssey G9, Cloud III, Rival 3), which were already real.