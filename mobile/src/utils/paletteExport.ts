import { Platform, Share } from 'react-native';
import { Palette } from '../api/palettes';
import { ColorData } from '../api/colors';

type FullPalette = Palette & { colors: ColorData[] };

function textRepresentation(palette: FullPalette): string {
  const list = palette.colors
    .map(c => `#${c.hex_code}${c.custom_name ? ` — ${c.custom_name}` : ''}`)
    .join('\n');
  return `${palette.name}\n${'─'.repeat(32)}\n${list}\n\nCreated with HexWorld`;
}

function luminanceTextColor(r: number, g: number, b: number): string {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Renders the palette to a real PNG on web (canvas → download).
 * Falls back to the OS share sheet with a text representation on native.
 */
export async function exportPalette(palette: FullPalette): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: textRepresentation(palette), title: palette.name });
    return;
  }

  const colors = palette.colors;
  const cols = Math.min(4, Math.max(1, colors.length));
  const rows = Math.max(1, Math.ceil(colors.length / cols));

  const PAD = 48;
  const SWATCH = 200;
  const GAP = 16;
  const TITLE_H = 90;
  const FOOTER_H = 56;

  const width = PAD * 2 + cols * SWATCH + (cols - 1) * GAP;
  const height = TITLE_H + PAD + rows * (SWATCH + 44) + (rows - 1) * GAP + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 40px -apple-system, system-ui, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(palette.name, PAD, PAD);

  ctx.fillStyle = '#666666';
  ctx.font = '400 18px -apple-system, system-ui, sans-serif';
  ctx.fillText(
    `${colors.length} color${colors.length !== 1 ? 's' : ''}`,
    PAD, PAD + 50
  );

  // Swatches
  colors.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (SWATCH + GAP);
    const y = TITLE_H + PAD + row * (SWATCH + 44 + GAP);

    // Rounded swatch
    const radius = 20;
    ctx.fillStyle = `#${c.hex_code}`;
    roundRect(ctx, x, y, SWATCH, SWATCH, radius);
    ctx.fill();

    // Hex label inside swatch (bottom-left)
    ctx.fillStyle = luminanceTextColor(c.r, c.g, c.b);
    ctx.font = '700 22px -apple-system, system-ui, sans-serif';
    ctx.fillText(`#${c.hex_code}`, x + 14, y + SWATCH - 32);

    // Name below swatch
    if (c.custom_name) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '500 16px -apple-system, system-ui, sans-serif';
      ctx.fillText(truncate(ctx, c.custom_name, SWATCH), x + 2, y + SWATCH + 10);
    }
  });

  // Footer
  ctx.fillStyle = '#444444';
  ctx.font = '600 18px -apple-system, system-ui, sans-serif';
  ctx.fillText('Created with HexWorld', PAD, height - FOOTER_H + 16);

  // Trigger download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${palette.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'palette'}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}
