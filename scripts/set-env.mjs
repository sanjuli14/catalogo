// Genera src/environments/environment.ts a partir de las variables de entorno.
// En local se leen de .env; en Cloudflare Pages, de las variables del proyecto.
import { mkdirSync, writeFileSync } from 'node:fs';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TURNSTILE_SITE_KEY'];
const missing = required.filter((name) => !process.env[name]);

if (missing.length) {
  console.error(`Faltan variables de entorno: ${missing.join(', ')}`);
  process.exit(1);
}

const environment = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  // Supabase exige el captcha de Turnstile al registrarse y al iniciar sesión.
  turnstileSiteKey: process.env.TURNSTILE_SITE_KEY,
};

mkdirSync('src/environments', { recursive: true });
writeFileSync(
  'src/environments/environment.ts',
  `// Archivo generado por scripts/set-env.mjs. No editar ni subir al repo.\n` +
    `export const environment = ${JSON.stringify(environment, null, 2)};\n`,
);
